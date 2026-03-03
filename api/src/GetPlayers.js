import { app } from '@azure/functions'
import { getAllPlayers } from '../lib/models.js'

app.http('GetPlayers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'players',
  handler: async (request, context) => {
    try {
      const players = await getAllPlayers()
      
      return {
        status: 200,
        jsonBody: {
          players,
          count: players.length
        }
      }
    } catch (error) {
      context.error('Error fetching players:', error)
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch players' }
      }
    }
  }
})
