require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')

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
    const container = initCosmos()
    
    const { resources: players } = await container.items
      .query('SELECT * FROM c ORDER BY c.dkpBalance DESC')
      .fetchAll()
    
    const canonicalMap = new Map()

    for (const player of players) {
      const characterKey = (player.characterKey || player.characterName || player.id || '').toString().toLowerCase().trim()
      const anchorKey = player.discordUserId || characterKey || player.id
      const existing = canonicalMap.get(anchorKey)

      if (!existing) {
        canonicalMap.set(anchorKey, {
          ...player,
          id: player.id || player.userId || player.playerId,
          userId: player.userId || player.id,
          playerId: player.playerId || player.id,
          characterName: player.characterName || player.id,
          dkpBalance: Number(player.dkpBalance || 0)
        })
        continue
      }

      existing.dkpBalance += Number(player.dkpBalance || 0)
      if (!existing.discordUserId && player.discordUserId) {
        existing.discordUserId = player.discordUserId
      }
      if (!existing.characterName && player.characterName) {
        existing.characterName = player.characterName
      }
    }

    const deduped = Array.from(canonicalMap.values())
      .sort((a, b) => Number(b.dkpBalance || 0) - Number(a.dkpBalance || 0))

    context.res = {
      status: 200,
      body: deduped
    }
  } catch (error) {
    context.log.error('GetPlayers error:', error)
    
    // If Cosmos isn't set up yet, return mock data
    context.res = {
      status: 200,
      body: []
    }
  }
}
