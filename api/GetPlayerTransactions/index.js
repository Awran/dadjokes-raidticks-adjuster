require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { randomUUID } = require('crypto')
const { requireAdminRole } = require('../lib/swaAuth')

let cosmosClient, playersContainer, transactionsContainer, raidsContainer

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
    raidsContainer = database.container('raids')
  }

  return { playersContainer, transactionsContainer, raidsContainer }
}

async function getRaidNameMap(transactions, raidsContainerRef) {
  const raidIds = [...new Set(
    transactions
      .map((transaction) => transaction.raidId)
      .filter((raidId) => typeof raidId === 'string' && raidId.trim() && raidId !== '-')
  )]

  if (raidIds.length === 0) {
    return {}
  }

  const raidNameMap = {}

  for (const raidId of raidIds) {
    try {
      const { resources } = await raidsContainerRef.items
        .query({
          query: 'SELECT TOP 1 * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: raidId }]
        })
        .fetchAll()

      const raid = resources?.[0]
      if (raid) {
        raidNameMap[raidId] = raid.name || raid.raidName || raid.id
      }
    } catch (_error) {
      // Leave unresolved raid names as-is and let UI fallback gracefully.
    }
  }

  return raidNameMap
}

module.exports = async function (context, req) {
  try {
    const method = (req.method || 'GET').toUpperCase()
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

    if (method === 'POST') {
      const principal = requireAdminRole(context, req)
      if (!principal) {
        return
      }

      const { amount, reason } = req.body || {}
      if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
        context.res = {
          status: 400,
          body: { error: 'Amount must be a positive number' }
        }
        return
      }

      const transaction = {
        id: `txn-${randomUUID()}`,
        playerId,
        characterName: player.characterName || player.id,
        type: 'manual_reward',
        amount,
        adjustmentReason: reason || 'Manual reward',
        timestamp: new Date().toISOString(),
        createdBy: principal.userDetails || 'admin'
      }

      await containers.transactionsContainer.items.create(transaction)

      const updatedPlayer = {
        ...player,
        dkpBalance: Number(player.dkpBalance || 0) + amount,
        lastUpdated: new Date().toISOString()
      }

      await containers.playersContainer.item(player.id, player.id).replace(updatedPlayer)

      context.res = {
        status: 201,
        body: {
          transaction,
          player: {
            id: updatedPlayer.id,
            characterName: updatedPlayer.characterName || updatedPlayer.id,
            dkpBalance: updatedPlayer.dkpBalance || 0
          }
        }
      }
      return
    }

    const { resources: transactions } = await containers.transactionsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.playerId = @playerId ORDER BY c.timestamp DESC',
        parameters: [{ name: '@playerId', value: playerId }]
      })
      .fetchAll()

    const raidNameMap = await getRaidNameMap(transactions, containers.raidsContainer)
    const enrichedTransactions = transactions.map((transaction) => ({
      ...transaction,
      raidName: transaction.raidName || raidNameMap[transaction.raidId] || null
    }))

    context.res = {
      status: 200,
      body: {
        player: {
          id: player.id,
          characterName: player.characterName || player.id,
          dkpBalance: player.dkpBalance || 0
        },
        transactions: enrichedTransactions
      }
    }
  } catch (error) {
    context.log.error('GetPlayerTransactions error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to fetch player transactions' }
    }
  }
}
