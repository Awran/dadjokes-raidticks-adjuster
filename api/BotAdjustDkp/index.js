require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { randomUUID } = require('crypto')
const { requireBotApiKey } = require('../lib/botAuth')

let cosmosClient, playersContainer, transactionsContainer

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
    transactionsContainer = database.container('transactions')
  }

  return { playersContainer, transactionsContainer }
}

function normalizeName(value) {
  return (value || '').toString().trim().toLowerCase()
}

async function resolvePlayer(container, userId, characterName) {
  try {
    const { resource } = await container.item(userId, userId).read()
    if (resource) {
      return resource
    }
  } catch (error) {
    if (error.code !== 404) {
      throw error
    }
  }

  const identityQuery = {
    query: `
      SELECT TOP 1 * FROM c
      WHERE c.userId = @userId OR c.playerId = @userId OR c.discordUserId = @userId
    `,
    parameters: [{ name: '@userId', value: userId }]
  }

  const { resources: identityMatches } = await container.items.query(identityQuery).fetchAll()
  if (identityMatches.length > 0) {
    return identityMatches[0]
  }

  const normalized = normalizeName(characterName)
  if (!normalized) {
    return null
  }

  const nameQuery = {
    query: 'SELECT TOP 1 * FROM c WHERE LOWER(c.characterName) = @name ORDER BY c.lastUpdated DESC',
    parameters: [{ name: '@name', value: normalized }]
  }

  const { resources: nameMatches } = await container.items.query(nameQuery).fetchAll()
  return nameMatches[0] || null
}

async function getOrCreatePlayer(container, userId, characterName) {
  const existing = await resolvePlayer(container, userId, characterName)
  if (existing) {
    return existing
  }

  const now = new Date().toISOString()
  const newPlayer = {
    id: userId,
    userId,
    playerId: userId,
    characterName,
    dkpBalance: 0,
    createdAt: now,
    lastUpdated: now
  }

  const { resource } = await container.items.create(newPlayer)
  return resource
}

module.exports = async function (context, req) {
  try {
    if (!requireBotApiKey(context, req)) {
      return
    }

    const {
      userId,
      characterName,
      amount,
      reason,
      transactionType,
      raidId,
      adjustedByUserId,
      adjustedByName
    } = req.body || {}

    if (!userId || typeof userId !== 'string') {
      context.res = {
        status: 400,
        body: { error: 'userId is required' }
      }
      return
    }

    if (!characterName || typeof characterName !== 'string') {
      context.res = {
        status: 400,
        body: { error: 'characterName is required' }
      }
      return
    }

    if (!Number.isInteger(amount) || amount === 0) {
      context.res = {
        status: 400,
        body: { error: 'amount must be a non-zero integer' }
      }
      return
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      context.res = {
        status: 400,
        body: { error: 'reason is required' }
      }
      return
    }

    const normalizedType = String(transactionType || 'manual_adjustment').trim().toLowerCase()
    const allowedTypes = new Set(['manual_adjustment', 'auction_win'])
    if (!allowedTypes.has(normalizedType)) {
      context.res = {
        status: 400,
        body: { error: 'transactionType must be manual_adjustment or auction_win' }
      }
      return
    }

    const containers = initCosmos()
    const player = await getOrCreatePlayer(containers.playersContainer, userId, characterName)

    const updatedPlayer = {
      ...player,
      characterName,
      dkpBalance: Number(player.dkpBalance || 0) + amount,
      lastUpdated: new Date().toISOString()
    }

    await containers.playersContainer.item(player.id, player.id).replace(updatedPlayer)

    const transaction = {
      id: `txn-${randomUUID()}`,
      playerId: player.id,
      characterName,
      type: normalizedType,
      amount,
      adjustmentReason: reason.trim(),
      source: 'discord_command',
      adjustedByUserId: adjustedByUserId || null,
      adjustedByName: adjustedByName || null,
      timestamp: new Date().toISOString()
    }

    if (typeof raidId === 'string' && raidId.trim()) {
      transaction.raidId = raidId.trim()
    }

    await containers.transactionsContainer.items.create(transaction)

    context.res = {
      status: 200,
      body: {
        success: true,
        userId: updatedPlayer.id,
        characterName: updatedPlayer.characterName,
        amount,
        reason: reason.trim(),
        newBalance: updatedPlayer.dkpBalance,
        transactionId: transaction.id
      }
    }
  } catch (error) {
    context.log.error('BotAdjustDkp error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to adjust DKP' }
    }
  }
}
