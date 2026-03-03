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

module.exports = async function (context, req) {
  try {
    if (!requireBotApiKey(context, req)) {
      return
    }

    const container = initCosmos()
    
    const { resources: players } = await container.items
      .query('SELECT c.id, c.characterName, c.dkpBalance FROM c ORDER BY c.dkpBalance DESC')
      .fetchAll()
    
    const canonicalMap = new Map()
    for (const player of players) {
      const characterKey = (player.characterKey || player.characterName || player.id || '').toString().toLowerCase().trim()
      const anchorKey = player.discordUserId || characterKey || player.id
      const existing = canonicalMap.get(anchorKey)

      if (!existing) {
        canonicalMap.set(anchorKey, {
          userId: player.id || player.userId || player.playerId,
          characterName: player.characterName || player.id,
          dkpBalance: Number(player.dkpBalance || 0)
        })
        continue
      }

      existing.dkpBalance += Number(player.dkpBalance || 0)
    }

    const simplified = Array.from(canonicalMap.values())
      .sort((a, b) => Number(b.dkpBalance || 0) - Number(a.dkpBalance || 0))
    
    context.res = {
      status: 200,
      body: simplified
    }
  } catch (error) {
    context.log.error('BotGetDkp error:', error)
    
    // If Cosmos isn't set up yet, return empty array
    context.res = {
      status: 200,
      body: []
    }
  }
}
