require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { requireBotApiKey } = require('../lib/botAuth')

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

async function resolvePlayerByIdentity(container, userId, characterName, username) {
  let player = null

  try {
    const { resource } = await container.item(userId, userId).read()
    player = resource || null
  } catch (error) {
    if (error.code !== 404) {
      throw error
    }
  }

  if (!player) {
    const identityQuery = {
      query: `
        SELECT TOP 1 * FROM c
        WHERE c.userId = @userId OR c.playerId = @userId OR c.discordUserId = @userId
      `,
      parameters: [{ name: '@userId', value: userId }]
    }
    const { resources } = await container.items.query(identityQuery).fetchAll()
    player = resources[0] || null
  }

  const normalizedName = (characterName || '').trim().toLowerCase()
  const normalizedUsername = (username || '').trim().toLowerCase()

  if (!player && (normalizedName || normalizedUsername)) {
    const names = [...new Set([normalizedName, normalizedUsername].filter(Boolean))]
    const parameters = names.map((value, index) => ({ name: `@name${index}`, value }))
    const conditions = parameters.map((_, index) => `LOWER(c.characterName) = @name${index}`)

    const nameQuery = {
      query: `
        SELECT TOP 1 * FROM c
        WHERE ${conditions.join(' OR ')}
        ORDER BY c.lastUpdated DESC
      `,
      parameters
    }

    const { resources } = await container.items.query(nameQuery).fetchAll()
    player = resources[0] || null
  }

  return player
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
      // Best-effort enrichment only.
    }
  }

  return raidNameMap
}

module.exports = async function (context, req) {
  try {
    if (!requireBotApiKey(context, req)) {
      return
    }

    const userId = req.params.userId
    const characterName = (req.query?.characterName || '').trim()
    const username = (req.query?.username || '').trim()

    if (!userId) {
      context.res = {
        status: 400,
        body: { error: 'User ID required' }
      }
      return
    }

    const containers = initCosmos()
    const player = await resolvePlayerByIdentity(containers.playersContainer, userId, characterName, username)

    if (!player) {
      context.res = {
        status: 404,
        body: { error: 'Player not found' }
      }
      return
    }

    const { resources: transactions } = await containers.transactionsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.playerId = @playerId ORDER BY c.timestamp DESC',
        parameters: [{ name: '@playerId', value: player.id }]
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
          userId: player.userId || player.playerId || player.id,
          characterName: player.characterName || player.id,
          dkpBalance: Number(player.dkpBalance || 0)
        },
        transactions: enrichedTransactions
      }
    }
  } catch (error) {
    context.log.error('BotGetPlayerTransactions error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to fetch player transactions' }
    }
  }
}
