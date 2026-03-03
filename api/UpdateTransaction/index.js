require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { requireAdminRole } = require('../lib/swaAuth')

let cosmosClient, transactionsContainer, playersContainer

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
    transactionsContainer = database.container('transactions')
    playersContainer = database.container('players')
  }
  return { transactionsContainer, playersContainer }
}

module.exports = async function (context, req) {
  try {
    const principal = requireAdminRole(context, req)
    if (!principal) {
      return
    }
    
    const method = (req.method || 'PATCH').toUpperCase()
    const transactionId = req.params.transactionId
    const { delta, amount, reason } = req.body || {}
    
    if (!transactionId) {
      context.res = {
        status: 400,
        body: { error: 'Transaction ID required' }
      }
      return
    }
    
    const containers = initCosmos()
    
    // Get the transaction
    let transaction
    try {
      // We need to query since we don't have the partition key
      const { resources } = await containers.transactionsContainer.items
        .query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: transactionId }]
        })
        .fetchAll()
      
      if (resources.length === 0) {
        context.res = {
          status: 404,
          body: { error: 'Transaction not found' }
        }
        return
      }
      
      transaction = resources[0]
    } catch (error) {
      throw error
    }
    
    const playerId = transaction.playerId

    if (method === 'DELETE') {
      if (transaction.type !== 'adjustment') {
        context.res = {
          status: 400,
          body: { error: 'Only adjustment line items can be deleted' }
        }
        return
      }

      const { resource: player } = await containers.playersContainer.item(playerId, playerId).read()
      const reversedBalance = (player.dkpBalance || 0) - (transaction.amount || 0)

      await containers.playersContainer.item(playerId, playerId).replace({
        ...player,
        dkpBalance: reversedBalance,
        lastUpdated: new Date().toISOString()
      })

      await containers.transactionsContainer.item(transactionId, playerId).delete()

      context.res = {
        status: 200,
        body: {
          deletedTransactionId: transactionId,
          oldBalance: player.dkpBalance || 0,
          newBalance: reversedBalance
        }
      }
      return
    }

    if (typeof delta !== 'number' && typeof amount !== 'number') {
      context.res = {
        status: 400,
        body: { error: 'delta must be a number' }
      }
      return
    }

    const parsedDelta =
      typeof delta === 'number'
        ? delta
        : (typeof amount === 'number' ? amount - (transaction.amount || 0) : NaN)

    if (Number.isNaN(parsedDelta) || parsedDelta === 0) {
      context.res = {
        status: 400,
        body: { error: 'delta must be a non-zero number' }
      }
      return
    }

    const { resource: player } = await containers.playersContainer.item(playerId, playerId).read()

    const newBalance = (player.dkpBalance || 0) + parsedDelta
    await containers.playersContainer.item(playerId, playerId).replace({
      ...player,
      dkpBalance: newBalance,
      lastUpdated: new Date().toISOString()
    })

    const adjustmentTransaction = {
      id: `adj-${Date.now()}-${playerId}`,
      playerId,
      characterName: transaction.characterName,
      type: 'adjustment',
      amount: parsedDelta,
      raidId: transaction.raidId,
      parentTransactionId: transaction.id,
      adjustmentReason: reason || 'Manual adjustment',
      timestamp: new Date().toISOString()
    }

    await containers.transactionsContainer.items.create(adjustmentTransaction)

    context.res = {
      status: 200,
      body: {
        transaction: adjustmentTransaction,
        oldBalance: player.dkpBalance || 0,
        newBalance
      }
    }
  } catch (error) {
    context.log.error('UpdateTransaction error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to update transaction' }
    }
  }
}
