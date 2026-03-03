import { app } from '@azure/functions'
import { getAllPlayers } from '../lib/models.js'

app.http('BotGetDkp', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bot/dkp',
  handler: async (request, context) => {
    try {
      const players = await getAllPlayers()
      
      // Return simplified format for bot consumption
      const dkpList = players.map(p => ({
        userId: p.id,
        characterName: p.displayName,
        dkpBalance: p.totalDkp
      }))
      
      return {
        status: 200,
        jsonBody: dkpList
      }
    } catch (error) {
      context.error('Error fetching DKP for bot:', error)
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch DKP data' }
      }
    }
  }
})
