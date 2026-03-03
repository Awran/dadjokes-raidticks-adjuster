require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { requireAdminRole } = require('../lib/swaAuth')

let cosmosClient, playersContainer, transactionsContainer

function initCosmos() {
  if (!cosmosClient) {
    const endpoint = process.env.COSMOS_ENDPOINT
    const key = process.env.COSMOS_KEY
    const databaseId = process.env.COSMOS_DATABASE_ID || 'DkpDatabase'

    if (!endpoint || !key) {
      throw new Error('Cosmos DB not configured')
    }

    cosmosClient = new CosmosClient({ endpoint, key })
    const database = cosmosClient.database(databaseId)
    playersContainer = database.container('players')
    transactionsContainer = database.container('transactions')
  }

  return { playersContainer, transactionsContainer }
}

async function deletePlayerWithFallback(container, player) {
  const partitionCandidates = [player.id, player.userId, player.playerId].filter(Boolean)

  let lastError = null
  for (const partitionKey of partitionCandidates) {
    try {
      await container.item(player.id, partitionKey).delete()
      return
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('Failed to delete player')
}

module.exports = async function (context, req) {
  try {
    const principal = requireAdminRole(context, req)
    if (!principal) {
      return
    }

    const playerId = req.params.playerId
    if (!playerId) {
      context.res = {
        status: 400,
        body: { error: 'Player ID required' }
      }
      return
    }

    const containers = initCosmos()

    const { resources: players } = await containers.playersContainer.items
      .query({
        query: 'SELECT TOP 1 * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: playerId }]
      })
      .fetchAll()

    if (players.length === 0) {
      context.res = {
        status: 404,
        body: { error: 'Player not found' }
      }
      return
    }

    const player = players[0]

    const { resources: transactions } = await containers.transactionsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.playerId = @playerId',
        parameters: [{ name: '@playerId', value: playerId }]
      })
      .fetchAll()

    let deletedTransactions = 0
    for (const transaction of transactions) {
      try {
        await containers.transactionsContainer.item(transaction.id, transaction.playerId).delete()
        deletedTransactions += 1
      } catch (error) {
        context.log.warn(`Could not delete transaction ${transaction.id}:`, error.message)
      }
    }

    await deletePlayerWithFallback(containers.playersContainer, player)

    context.res = {
      status: 200,
      body: {
        success: true,
        deletedPlayer: playerId,
        deletedTransactions
      }
    }
  } catch (error) {
    context.log.error('DeletePlayer error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to delete player' }
    }
  }
}
