require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { requireBotApiKey } = require('../lib/botAuth')

let cosmosClient, playersContainer

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
  }
  return playersContainer
}

function toPlayerResponse(player, requestedUserId) {
  return {
    userId: player.userId || player.playerId || player.id || requestedUserId,
    characterName: player.characterName || player.displayName || player.userId || player.id,
    dkpBalance: Number(player.dkpBalance || player.totalDkp || 0)
  }
}

module.exports = async function (context, req) {
  try {
    if (!requireBotApiKey(context, req)) {
      return
    }

    const userId = req.params.userId
    const characterName = (req.query?.characterName || '').trim().toLowerCase()
    const username = (req.query?.username || '').trim().toLowerCase()
    
    if (!userId) {
      context.res = {
        status: 400,
        body: { error: 'User ID required' }
      }
      return
    }
    
    const container = initCosmos()
    
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

    if (!player && (characterName || username)) {
      const names = [...new Set([characterName, username].filter(Boolean))]
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

    if (!player) {
      context.res = {
        status: 404,
        body: { error: 'Player not found' }
      }
      return
    }

    context.res = {
      status: 200,
      body: toPlayerResponse(player, userId)
    }
  } catch (error) {
    context.log.error('BotGetPlayerDkp error:', error)
    context.res = {
      status: 500,
      body: { error: 'Failed to fetch player DKP' }
    }
  }
}
