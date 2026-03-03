import { app } from '@azure/functions'
import { getRaidHistory } from '../lib/models.js'

app.http('GetRaids', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'raids',
  handler: async (request, context) => {
    try {
      const url = new URL(request.url)
      const limit = parseInt(url.searchParams.get('limit') || '50')
      
      const raids = await getRaidHistory(limit)
      
      return {
        status: 200,
        jsonBody: {
          raids,
          count: raids.length
        }
      }
    } catch (error) {
      context.error('Error fetching raids:', error)
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch raids' }
      }
    }
  }
})
