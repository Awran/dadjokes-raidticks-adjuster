import { app } from '@azure/functions'
import { requireAuth } from '../lib/auth.js'
import { saveBid } from '../lib/models.js'

const handler = async (request, context) => {
  try {
    const body = await request.json()
    const { raidId, playerId, item, amount } = body
    
    if (!raidId || !playerId || !item || typeof amount !== 'number') {
      return {
        status: 400,
        jsonBody: { error: 'raidId, playerId, item, and amount are required' }
      }
    }

    const bid = await saveBid({
      raidId,
      playerId,
      item,
      amount,
      submittedBy: request.user.email
    })
    
    return {
      status: 200,
      jsonBody: { bid }
    }
  } catch (error) {
    context.error('Error saving bid:', error)
    return {
      status: 500,
      jsonBody: { error: 'Failed to save bid' }
    }
  }
}

app.http('SaveBid', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'bids',
  handler: requireAuth(handler)
})
