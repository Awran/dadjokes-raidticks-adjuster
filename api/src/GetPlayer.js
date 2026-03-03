import { app } from '@azure/functions'
import { getContainer, CONTAINERS } from '../lib/cosmos.js'
import { getPlayerTransactions } from '../lib/models.js'

app.http('GetPlayer', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'players/{playerId}',
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
      const { resource: player } = await container.item(playerId, playerId).read()
      
      if (!player) {
        return {
          status: 404,
          jsonBody: { error: 'Player not found' }
        }
      }

      const transactions = await getPlayerTransactions(playerId, 100)
      
      return {
        status: 200,
        jsonBody: {
          player,
          transactions
        }
      }
    } catch (error) {
      context.error('Error fetching player:', error)
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch player' }
      }
    }
  }
})
