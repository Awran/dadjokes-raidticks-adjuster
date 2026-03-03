require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { randomUUID } = require('crypto')
const { requireBotApiKey } = require('../lib/botAuth')

let cosmosClient, playersContainer, raidsContainer, transactionsContainer

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
    throw new Error(`Failed to query player ${userId}: ${error.message}`)
  }

  try {
    const now = new Date().toISOString()
    const canonicalId = discordUserId || characterKey || userId
    const newPlayer = {
      id: canonicalId,
      userId: canonicalId,
      playerId: canonicalId,
      discordUserId,
      characterKey: characterKey || canonicalId,
      characterName,
      dkpBalance: 0,
      createdAt: now,
      lastUpdated: now
    }

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
    if (!requireBotApiKey(context, req)) {
      return
    }

    const { raidId, raidName, raidDate, attendance } = req.body || {}
    
    if (!attendance || !Array.isArray(attendance) || attendance.length === 0) {
      context.res = {
        status: 400,
        body: { error: 'Attendance array required' }
      }
      return
    }

    const containers = initCosmos()
    
    // Create raid record
    const apiRaidId = `bot-raid-${raidId || Date.now()}`
    const raid = {
      id: apiRaidId,
      name: raidName || 'Discord Raid',
      date: raidDate || new Date().toISOString(),
      attendanceCount: attendance.length,
      source: 'discord_bot',
      botRaidId: raidId,
      createdAt: new Date().toISOString()
    }
    await containers.raidsContainer.items.create(raid)
    
    // Process each attendee
    const results = []
    for (const attendee of attendance) {
      const userId = attendee.userId
      const characterName = attendee.characterName || attendee.displayName || attendee.name
      const adjustmentRaw = attendee.adjustment ?? attendee.ticks
      const adjustment = typeof adjustmentRaw === 'number' ? adjustmentRaw : Number.parseFloat(adjustmentRaw)
      
      if (!userId || !characterName || Number.isNaN(adjustment)) {
        context.log.warn('Skipping invalid attendee:', { userId, characterName, adjustment })
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
      const newBalance = Number(player.dkpBalance || 0) + adjustment
      await containers.playersContainer.items.upsert({
        ...player,
        id: player.id || userId,
        userId: player.userId || userId,
        playerId: player.playerId || userId,
        discordUserId: player.discordUserId || (isDiscordUserId(userId) ? userId : null),
        characterKey: player.characterKey || normalizeCharacterKey(characterName),
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
        raidId: apiRaidId,
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
        throw error
      }
    }
    
    context.res = {
      status: 200,
      body: {
        raidId: apiRaidId,
        processed: results.length,
        results
      }
    }
  } catch (error) {
    context.log.error('BotUploadRaid error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to process raid' }
    }
  }
}
