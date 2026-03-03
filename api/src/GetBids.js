import { app } from '@azure/functions'
import { getRaidBids } from '../lib/models.js'

app.http('GetBids', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'bids/{raidId}',
  handler: async (request, context) => {
    try {
      const raidId = request.params.raidId
      
      if (!raidId) {
        return {
          status: 400,
          jsonBody: { error: 'Raid ID required' }
        }
      }

      const bids = await getRaidBids(raidId)
      
      return {
        status: 200,
        jsonBody: {
          bids,
          count: bids.length
        }
      }
    } catch (error) {
      context.error('Error fetching bids:', error)
      return {
        status: 500,
        jsonBody: { error: 'Failed to fetch bids' }
      }
    }
  }
})
