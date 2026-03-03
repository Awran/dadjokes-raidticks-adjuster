require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { randomUUID } = require('crypto')
const { requireAdminRole } = require('../lib/swaAuth')

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

module.exports = async function (context, req) {
  try {
    const principal = requireAdminRole(context, req)
    if (!principal) {
      return
    }

    const raidId = req.params.raidId
    const amount = Number.parseFloat(req.body?.amount)
    const reasonRaw = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    const selectedPlayerIds = Array.isArray(req.body?.playerIds)
      ? req.body.playerIds
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      : []

    if (!raidId) {
      context.res = {
        status: 400,
        body: { error: 'Raid ID required' }
      }
      return
    }

    if (Number.isNaN(amount) || amount <= 0) {
      context.res = {
        status: 400,
        body: { error: 'amount must be a positive number' }
      }
      return
    }

    if (!reasonRaw) {
      context.res = {
        status: 400,
        body: { error: 'reason is required' }
      }
      return
    }

    const reason = reasonRaw
    const containers = initCosmos()

    const { resources: raidTransactions } = await containers.transactionsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.raidId = @raidId ORDER BY c.timestamp ASC',
        parameters: [{ name: '@raidId', value: raidId }]
      })
      .fetchAll()

    const baseTransactions = raidTransactions.filter((transaction) =>
      transaction &&
      transaction.playerId &&
      transaction.type !== 'adjustment' &&
      !transaction.parentTransactionId
    )

    const participantMap = new Map()
    for (const transaction of baseTransactions) {
      if (!participantMap.has(transaction.playerId)) {
        participantMap.set(transaction.playerId, transaction)
      }
    }

    const targetParticipantMap =
      selectedPlayerIds.length > 0
        ? new Map(
            [...participantMap.entries()].filter(([playerId]) => selectedPlayerIds.includes(String(playerId)))
          )
        : participantMap

    if (targetParticipantMap.size === 0) {
      context.res = {
        status: selectedPlayerIds.length > 0 ? 400 : 200,
        body: {
          success: selectedPlayerIds.length === 0,
          raidId,
          amount,
          reason,
          awardedCount: 0,
          participants: 0,
          message: selectedPlayerIds.length > 0
            ? 'No selected players were found in this raid.'
            : 'No raid participants found to award.'
        }
      }
      return
    }

    let awardedCount = 0
    const failures = []
    for (const [playerId, parentTransaction] of targetParticipantMap.entries()) {
      try {
        const { resource: player } = await containers.playersContainer.item(playerId, playerId).read()
        if (!player) {
          failures.push(`${playerId}: player not found`)
          continue
        }

        const newBalance = Number(player.dkpBalance || 0) + amount
        await containers.playersContainer.item(playerId, playerId).replace({
          ...player,
          dkpBalance: newBalance,
          lastUpdated: new Date().toISOString()
        })

        const awardTransaction = {
          id: `award-${randomUUID()}`,
          playerId,
          characterName: parentTransaction.characterName || player.characterName || playerId,
          type: 'adjustment',
          amount,
          raidId,
          parentTransactionId: parentTransaction.id,
          adjustmentReason: reason,
          source: 'raid_award',
          adjustedByUserId: principal.userId || null,
          adjustedByName: principal.userDetails || 'Raid Award',
          timestamp: new Date().toISOString()
        }

        await containers.transactionsContainer.items.create(awardTransaction)
        awardedCount += 1
      } catch (error) {
        failures.push(`${playerId}: ${error.message}`)
      }
    }

    context.res = {
      status: 200,
      body: {
        success: failures.length === 0,
        raidId,
        amount,
        reason,
        awardedCount,
        participants: targetParticipantMap.size,
        failedCount: failures.length,
        failures: failures.slice(0, 25)
      }
    }
  } catch (error) {
    context.log.error('AwardRaid error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to apply raid award' }
    }
  }
}
