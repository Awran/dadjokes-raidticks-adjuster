import { app } from '@azure/functions'
import { getContainer, CONTAINERS } from '../lib/cosmos.js'

app.http('BotGetPlayerDkp', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bot/dkp/{playerId}',
  handler: async (request, context) => {
    try {
      const playerId = request.params.playerId
      
      if (!playerId) {
        return {
          status: 400,
          jsonBody: { error: 'Player ID required' }
        }
      }

      const container = await getContainer(CONTAINERS.PLAYERS)
      
      try {
        const { resource: player } = await container.item(playerId, playerId).read()
        
        return {
          status: 200,
          jsonBody: {
            userId: player.id,
            characterName: player.displayName,
            dkpBalance: player.totalDkp
          }
        }
      } catch (error) {
        // Player not found
        return {
          status: 404,
          jsonBody: {
            userId: playerId,
            characterName: 'Unknown',
            dkpBalance: 0
          }
        }
      }
    } catch (error) {
      context.error('Error fetching player DKP for bot:', error)
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch player DKP' }
      }
    }
  }
})
