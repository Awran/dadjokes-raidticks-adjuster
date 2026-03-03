import { app } from '@azure/functions'
import { requireAdmin } from '../lib/auth.js'
import { getOrCreatePlayer, updatePlayerDkp, createRaid } from '../lib/models.js'

const handler = async (request, context) => {
  try {
    const body = await request.json()
    const { attendance, raidName, raidDate, adjustments = {} } = body
    
    if (!attendance || !Array.isArray(attendance)) {
      return {
        status: 400,
        jsonBody: { error: 'Attendance array required' }
      }
    }

    // Create raid record
    const raid = await createRaid({
      name: raidName || 'Raid',
      date: raidDate || new Date().toISOString(),
      uploadedBy: request.user.email,
      attendanceCount: attendance.length
    })

    const results = []
    
    // Process each player's attendance
    for (const entry of attendance) {
      const { userId, displayName, ticks } = entry
      
      if (!userId || !displayName || typeof ticks !== 'number') {
        continue
      }

      // Get or create player
      const player = await getOrCreatePlayer(userId, displayName)
      
      // Apply adjustments if any
      const adjustment = adjustments[userId] || 0
      const finalTicks = ticks + adjustment
      
      // Award DKP
      const reason = `${raidName || 'Raid'} - ${raidDate || new Date().toISOString().split('T')[0]}`
      const updatedPlayer = await updatePlayerDkp(
        player.id,
        finalTicks,
        reason,
        raid.id
      )
      
      results.push({
        playerId: player.id,
        displayName: player.displayName,
        ticksAwarded: finalTicks,
        newBalance: updatedPlayer.totalDkp
      })
    }

    return {
      status: 200,
      jsonBody: {
        raid,
        results,
        message: `Successfully processed ${results.length} players`
      }
    }
  } catch (error) {
    context.error('Error uploading raid:', error)
    return {
      status: 500,
      jsonBody: { error: 'Failed to upload raid' }
    }
  }
}

app.http('UploadRaid', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'raids',
  handler: requireAdmin(handler)
})
