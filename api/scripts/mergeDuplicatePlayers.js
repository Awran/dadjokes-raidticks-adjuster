// Merge duplicate player records and re-anchor transactions
// Usage:
//   node api/scripts/mergeDuplicatePlayers.js            # dry-run
//   node api/scripts/mergeDuplicatePlayers.js --apply    # apply changes

const { CosmosClient } = require('@azure/cosmos')

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

function getDiscordId(player) {
  const candidates = [player.discordUserId, player.id, player.userId, player.playerId]
  for (const candidate of candidates) {
    if (isDiscordUserId(candidate)) {
      return candidate
    }
  }
  return null
}

function getPlayerCanonicalKey(player) {
  const characterKey = normalizeCharacterKey(player.characterKey || player.characterName)
  if (characterKey) {
    return `character:${characterKey}`
  }

  const discordId = getDiscordId(player)
  if (discordId) {
    return `discord:${discordId}`
  }

  return `id:${player.id}`
}

function chooseCanonicalPlayer(players) {
  const sorted = [...players].sort((a, b) => {
    const aHasDiscord = getDiscordId(a) ? 1 : 0
    const bHasDiscord = getDiscordId(b) ? 1 : 0
    if (aHasDiscord !== bHasDiscord) return bHasDiscord - aHasDiscord

    const aBalance = Number(a.dkpBalance || 0)
    const bBalance = Number(b.dkpBalance || 0)
    if (aBalance !== bBalance) return bBalance - aBalance

    const aCreated = new Date(a.createdAt || a._ts || 0).getTime()
    const bCreated = new Date(b.createdAt || b._ts || 0).getTime()
    return aCreated - bCreated
  })

  return sorted[0]
}

async function safeDeletePlayer(container, player) {
  const candidates = [player.id, player.userId, player.playerId].filter(Boolean)
  let lastError = null

  for (const partitionKey of candidates) {
    try {
      await container.item(player.id, partitionKey).delete()
      return true
    } catch (error) {
      lastError = error
    }
  }

  if (lastError) {
    throw lastError
  }

  return false
}

async function moveTransaction(container, transaction, targetPlayerId) {
  const updated = {
    ...transaction,
    playerId: targetPlayerId,
    migratedFromPlayerId: transaction.playerId,
    lastModified: new Date().toISOString(),
  }

  let createPayload = { ...updated }
  try {
    await container.items.create(createPayload)
  } catch (error) {
    if (error.code === 409) {
      createPayload.id = `${transaction.id}-migrated-${Date.now()}`
      await container.items.create(createPayload)
    } else {
      throw error
    }
  }

  await container.item(transaction.id, transaction.playerId).delete()
}

async function main() {
  const apply = process.argv.includes('--apply')

  const endpoint = process.env.COSMOS_ENDPOINT
  const key = process.env.COSMOS_KEY
  const databaseId = process.env.COSMOS_DATABASE_ID || 'DkpDatabase'

  if (!endpoint || !key) {
    console.error('❌ COSMOS_ENDPOINT and COSMOS_KEY must be set in environment')
    process.exit(1)
  }

  const client = new CosmosClient({ endpoint, key })
  const database = client.database(databaseId)
  const playersContainer = database.container('players')
  const transactionsContainer = database.container('transactions')

  const { resources: players } = await playersContainer.items
    .query('SELECT * FROM c')
    .fetchAll()

  const groups = new Map()
  for (const player of players) {
    const key = getPlayerCanonicalKey(player)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(player)
  }

  const duplicateGroups = [...groups.values()].filter(group => group.length > 1)

  let mergedPlayers = 0
  let movedTransactions = 0
  let deletedPlayers = 0

  console.log(`Scanned players: ${players.length}`)
  console.log(`Duplicate groups: ${duplicateGroups.length}`)

  for (const group of duplicateGroups) {
    const canonical = chooseCanonicalPlayer(group)
    const duplicates = group.filter(player => player.id !== canonical.id)

    const canonicalId = canonical.id
    const mergedBalance = group.reduce((sum, player) => sum + Number(player.dkpBalance || 0), 0)
    const mergedName = canonical.characterName || group.find(p => p.characterName)?.characterName || canonical.id
    const mergedCharacterKey = normalizeCharacterKey(canonical.characterKey || mergedName || canonical.id)
    const mergedDiscordId = getDiscordId(canonical)

    console.log('\n---')
    console.log(`Canonical: ${canonicalId} (${mergedName})`)
    console.log(`Merge count: ${duplicates.length}`)
    console.log(`Merged DKP: ${mergedBalance}`)

    for (const duplicate of duplicates) {
      const { resources: txns } = await transactionsContainer.items
        .query({
          query: 'SELECT * FROM c WHERE c.playerId = @playerId',
          parameters: [{ name: '@playerId', value: duplicate.id }]
        })
        .fetchAll()

      console.log(`  Duplicate ${duplicate.id} -> transactions: ${txns.length}`)

      if (apply) {
        for (const txn of txns) {
          await moveTransaction(transactionsContainer, txn, canonicalId)
          movedTransactions += 1
        }

        await safeDeletePlayer(playersContainer, duplicate)
        deletedPlayers += 1
      } else {
        movedTransactions += txns.length
      }
    }

    if (apply) {
      await playersContainer.items.upsert({
        ...canonical,
        id: canonicalId,
        userId: canonical.userId || canonicalId,
        playerId: canonical.playerId || canonicalId,
        characterName: mergedName,
        characterKey: mergedCharacterKey,
        discordUserId: canonical.discordUserId || mergedDiscordId,
        dkpBalance: mergedBalance,
        lastUpdated: new Date().toISOString(),
      })
    }

    mergedPlayers += 1
  }

  console.log('\n=== Summary ===')
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log(`Groups merged: ${mergedPlayers}`)
  console.log(`Transactions to move${apply ? 'd' : ''}: ${movedTransactions}`)
  console.log(`Players deleted${apply ? '' : ' (would delete)'}: ${deletedPlayers || duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0)}`)

  if (!apply) {
    console.log('\nRun with --apply to perform the merge.')
  }
}

main().catch((error) => {
  console.error('❌ Merge failed:', error)
  process.exit(1)
})
