require('../lib/ensureCrypto')
const { randomUUID } = require('crypto')
const { CosmosClient } = require('@azure/cosmos')
const { requireAdminRole } = require('../lib/swaAuth')

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
  return createResult.resource
}

module.exports = async function (context, req) {
  try {
    const principal = requireAdminRole(context, req)
    if (!principal) {
      return
    }

    const backup = req.body || {}
    const uploadPayload = backup?.apiReplay?.uploadRaid?.payload
    const settlementCalls = Array.isArray(backup?.apiReplay?.auctionSettlementAdjustments)
      ? backup.apiReplay.auctionSettlementAdjustments
      : []

    if (!uploadPayload || !Array.isArray(uploadPayload.attendance) || uploadPayload.attendance.length === 0) {
      context.res = {
        status: 400,
        body: { error: 'Invalid backup payload: upload attendance is required' }
      }
      return
    }

    const localRaidId = uploadPayload.raidId
    const raidName = uploadPayload.raidName || `Raid ${localRaidId}`
    const raidDate = uploadPayload.raidDate || new Date().toISOString()
    const apiRaidId = `bot-raid-${localRaidId}`

    const containers = initCosmos()

    try {
      const existingRaid = await containers.raidsContainer.item(apiRaidId, apiRaidId).read()
      if (existingRaid?.resource) {
        context.res = {
          status: 409,
          body: { error: `Raid ${apiRaidId} already exists. Backup appears already imported.` }
        }
        return
      }
    } catch (error) {
      if (error.code !== 404) {
        throw error
      }
    }

    await containers.raidsContainer.items.create({
      id: apiRaidId,
      name: raidName,
      date: raidDate,
      attendanceCount: uploadPayload.attendance.length,
      source: 'backup_import',
      botRaidId: localRaidId,
      importedBy: principal.userDetails || principal.userId || 'admin',
      importedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    })

    let attendanceProcessed = 0
    for (const attendee of uploadPayload.attendance) {
      const userId = String(attendee.userId || '').trim()
      const characterName = attendee.characterName || attendee.displayName || attendee.name
      const adjustment = Number.parseFloat(attendee.adjustment ?? attendee.ticks)

      if (!userId || !characterName || Number.isNaN(adjustment)) {
        continue
      }

      const player = await getOrCreatePlayer(containers.playersContainer, userId, characterName)
      const newBalance = Number(player.dkpBalance || 0) + adjustment

      await containers.playersContainer.items.upsert({
        ...player,
        id: player.id || userId,
        userId: player.userId || userId,
        playerId: player.playerId || userId,
        characterKey: player.characterKey || normalizeCharacterKey(characterName),
        discordUserId: player.discordUserId || (isDiscordUserId(userId) ? userId : null),
        characterName,
        dkpBalance: newBalance,
        lastUpdated: new Date().toISOString()
      })

      await containers.transactionsContainer.items.create({
        id: `txn-${randomUUID()}`,
        playerId: player.id || userId,
        characterName,
        type: 'raid_attendance',
        amount: adjustment,
        raidId: apiRaidId,
        source: 'backup_import',
        timestamp: new Date().toISOString()
      })

      attendanceProcessed += 1
    }

    let settlementProcessed = 0
    for (const call of settlementCalls) {
      const payload = call?.payload || {}
      const userId = String(payload.userId || '').trim()
      const characterName = payload.characterName || userId
      const amount = Number.parseInt(payload.amount, 10)
      const reason = String(payload.reason || '').trim()

      if (!userId || Number.isNaN(amount) || amount === 0 || !reason) {
        continue
      }

      const transactionType = String(payload.transactionType || 'manual_adjustment').trim().toLowerCase()
      const normalizedType = transactionType === 'auction_win' ? 'auction_win' : 'manual_adjustment'

      const player = await getOrCreatePlayer(containers.playersContainer, userId, characterName)
      const newBalance = Number(player.dkpBalance || 0) + amount

      await containers.playersContainer.items.upsert({
        ...player,
        id: player.id || userId,
        userId: player.userId || userId,
        playerId: player.playerId || userId,
        characterName,
        dkpBalance: newBalance,
        lastUpdated: new Date().toISOString()
      })

      await containers.transactionsContainer.items.create({
        id: `txn-${randomUUID()}`,
        playerId: player.id || userId,
        characterName,
        type: normalizedType,
        amount,
        adjustmentReason: reason,
        raidId: payload.raidId || apiRaidId,
        source: 'backup_import',
        adjustedByUserId: payload.adjustedByUserId || null,
        adjustedByName: payload.adjustedByName || null,
        timestamp: new Date().toISOString()
      })

      settlementProcessed += 1
    }

    context.res = {
      status: 200,
      body: {
        success: true,
        raidId: apiRaidId,
        attendanceProcessed,
        settlementProcessed
      }
    }
  } catch (error) {
    context.log.error('ImportRaidBackup error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to import backup JSON' }
    }
  }
}
