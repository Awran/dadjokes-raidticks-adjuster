require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { randomUUID } = require('crypto')
const { requireAdminRole } = require('../lib/swaAuth')

let cosmosClient, playersContainer, raidsContainer, transactionsContainer

function buildFallbackUserId(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }

  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function normalizeCharacterKey(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }

  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function isDiscordUserId(value) {
  return typeof value === 'string' && /^\d{15,25}$/.test(value)
}

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
    raidsContainer = database.container('raids')
    transactionsContainer = database.container('transactions')
  }
  return { playersContainer, raidsContainer, transactionsContainer }
}

async function getOrCreatePlayer(container, userId, characterName) {
  const characterKey = normalizeCharacterKey(characterName)
  const discordUserId = isDiscordUserId(userId) ? userId : null

  try {
    const { resources } = await container.items
      .query({
        query: `
          SELECT TOP 1 * FROM c
          WHERE c.id = @userId
            OR c.userId = @userId
            OR c.playerId = @userId
            OR (@discordUserId != '' AND c.discordUserId = @discordUserId)
            OR (@characterKey != '' AND (c.characterKey = @characterKey OR LOWER(c.characterName) = @characterKey))
          ORDER BY c.lastUpdated DESC
        `,
        parameters: [
          { name: '@userId', value: userId },
          { name: '@discordUserId', value: discordUserId || '' },
          { name: '@characterKey', value: characterKey }
        ]
      })
      .fetchAll()

    if (resources.length > 0) {
      const existing = resources[0]
      return {
        ...existing,
        characterName: characterName || existing.characterName,
        characterKey: characterKey || existing.characterKey,
        discordUserId: existing.discordUserId || discordUserId,
        userId: existing.userId || existing.id,
        playerId: existing.playerId || existing.id
      }
    }
  } catch (error) {
    throw new Error(`Failed to read player ${userId}: ${error.message}`)
  }

  const canonicalId = discordUserId || characterKey || userId
  const newPlayer = {
    id: canonicalId,
    userId: canonicalId,
    playerId: canonicalId,
    discordUserId,
    characterKey: characterKey || canonicalId,
    characterName,
    dkpBalance: 0,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  }
  
  try {
    const createResult = await container.items.create(newPlayer)
    if (!createResult || !createResult.resource) {
      throw new Error(`Create returned empty result for userId: ${userId}`)
    }
    return createResult.resource
  } catch (createError) {
    throw new Error(`Failed to create player ${userId}: ${createError.message}`)
  }
}

module.exports = async function (context, req) {
  try {
    const principal = requireAdminRole(context, req)
    if (!principal) {
      return
    }

    const { attendance, raidDate, raidName, adjustments = {} } = req.body || {}
    
    if (!attendance || !Array.isArray(attendance) || attendance.length === 0) {
      context.res = {
        status: 400,
        body: { error: 'Attendance array required' }
      }
      return
    }

    const containers = initCosmos()
    
    // Create raid record
    const raidId = `raid-${Date.now()}`
    const raid = {
      id: raidId,
      name: raidName || 'Unnamed Raid',
      date: raidDate || new Date().toISOString(),
      attendanceCount: attendance.length,
      createdAt: new Date().toISOString()
    }
    await containers.raidsContainer.items.create(raid)
    
    // Process each attendee
    const results = []
    const skipped = []
    for (const attendee of attendance) {
      const characterName = attendee.characterName || attendee.displayName || attendee.name
      const userId = attendee.userId || buildFallbackUserId(characterName)
      const ticksRaw = attendee.ticks ?? attendee.adjustment
      const baseTicks = typeof ticksRaw === 'number' ? ticksRaw : Number.parseFloat(ticksRaw)
      const manualAdjustmentRaw = adjustments[userId] ?? 0
      const manualAdjustment = typeof manualAdjustmentRaw === 'number'
        ? manualAdjustmentRaw
        : Number.parseFloat(manualAdjustmentRaw)
      const adjustment = baseTicks + (Number.isNaN(manualAdjustment) ? 0 : manualAdjustment)
      
      context.log('Processing attendee:', { userId, characterName, baseTicks, manualAdjustment, adjustment, raw: attendee })
      
      if (!userId || !characterName || Number.isNaN(baseTicks) || Number.isNaN(adjustment)) {
        context.log.warn('Skipping invalid attendee:', { userId, characterName, adjustment })
        skipped.push({ userId, characterName, reason: 'Invalid userId/name/ticks' })
        continue
      }
      
      try {
        // Get or create player
        const player = await getOrCreatePlayer(
          containers.playersContainer,
          userId,
          characterName
        )
        
        if (!player) {
          throw new Error(`Failed to get or create player: ${userId}`)
        }
        
        // Update balance
        const newBalance = (player.dkpBalance || 0) + adjustment
        await containers.playersContainer.items.upsert({
          ...player,
          id: player.id || userId,
          userId: player.userId || player.id || userId,
          playerId: player.playerId || player.id || userId,
          characterKey: player.characterKey || normalizeCharacterKey(characterName),
          discordUserId: player.discordUserId || (isDiscordUserId(userId) ? userId : null),
          characterName, // Update name in case it changed
          dkpBalance: newBalance,
          lastUpdated: new Date().toISOString()
        })
        
        // Create transaction
        const transaction = {
          id: `txn-${randomUUID()}`,
          playerId: player.id || userId,
          characterName,
          type: 'raid_attendance',
          amount: adjustment,
          raidId,
          timestamp: new Date().toISOString()
        }
        await containers.transactionsContainer.items.create(transaction)
        
        results.push({
          userId,
          characterName,
          adjustment,
          newBalance
        })
      } catch (error) {
        context.log.error(`Failed to process attendee ${userId}:`, error)
        skipped.push({ userId, characterName, reason: error.message })
      }
    }

    if (results.length === 0) {
      await containers.raidsContainer.item(raidId, raidId).delete()
      context.res = {
        status: 400,
        body: {
          error: 'No valid attendees were processed',
          skipped
        }
      }
      return
    }
    
    context.res = {
      status: 200,
      body: {
        raidId,
        processed: results.length,
        skipped: skipped.length,
        skippedDetails: skipped,
        results
      }
    }
  } catch (error) {
    context.log.error('UploadRaid error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to process raid' }
    }
  }
}
