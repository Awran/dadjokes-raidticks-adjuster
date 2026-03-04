require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { requireMemberRole } = require('../lib/swaAuth')

let cosmosClient, transactionsContainer, raidsContainer

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
    transactionsContainer = database.container('transactions')
    raidsContainer = database.container('raids')
  }

  return { transactionsContainer, raidsContainer }
}

function parseAuctionItem(reason = '') {
  const text = String(reason || '')
  const match = text.match(/auction\s+win:\s*(.+)$/i)
  if (!match) {
    return null
  }
  return match[1]?.trim() || null
}

function parseRaidLabelFromReason(reason = '') {
  const text = String(reason || '')
  const match = text.match(/^raid\s+(.+?)\s+auction\s+win:/i)
  if (!match) {
    return null
  }
  return match[1]?.trim() || null
}

function isAuctionSettlement(transaction) {
  const normalizedType = String(transaction.type || '').trim().toLowerCase()
  const reason = String(transaction.adjustmentReason || '')
  return (
    normalizedType === 'auction_win' ||
    transaction.adjustedByUserId === 'auction-system' ||
    transaction.adjustedByName === 'Auction Settlement' ||
    /auction\s+win:/i.test(reason)
  )
}

async function getRaidNameMap(transactions, raidsContainerRef) {
  const raidIds = [...new Set(
    transactions
      .map((transaction) => transaction.raidId)
      .filter((raidId) => typeof raidId === 'string' && raidId.trim() && raidId !== '-')
  )]

  if (raidIds.length === 0) {
    return {}
  }

  const raidNameMap = {}

  for (const raidId of raidIds) {
    try {
      const { resources } = await raidsContainerRef.items
        .query({
          query: 'SELECT TOP 1 * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: raidId }]
        })
        .fetchAll()

      const raid = resources?.[0]
      if (raid) {
        raidNameMap[raidId] = raid.name || raid.raidName || raid.id
      }
    } catch (_error) {
      // Leave unresolved raid names as-is and use fallback labels.
    }
  }

  return raidNameMap
}

module.exports = async function (context, _req) {
  try {
    const principal = requireMemberRole(context, _req)
    if (!principal) {
      return
    }

    const containers = initCosmos()

    const { resources: transactions } = await containers.transactionsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.type = @manualType OR c.type = @auctionType ORDER BY c.timestamp DESC',
        parameters: [
          { name: '@manualType', value: 'manual_adjustment' },
          { name: '@auctionType', value: 'auction_win' }
        ]
      })
      .fetchAll()

    const auctionTransactions = transactions.filter(isAuctionSettlement)
    const raidNameMap = await getRaidNameMap(auctionTransactions, containers.raidsContainer)

    const grouped = new Map()

    for (const transaction of auctionTransactions) {
      const itemName = parseAuctionItem(transaction.adjustmentReason)
      if (!itemName) {
        continue
      }

      const groupKey = itemName.toLowerCase()
      const existing = grouped.get(groupKey)
      const raidName =
        transaction.raidName ||
        raidNameMap[transaction.raidId] ||
        parseRaidLabelFromReason(transaction.adjustmentReason) ||
        (transaction.raidId ? `Raid ${transaction.raidId}` : '-')

      const winEntry = {
        id: transaction.id,
        timestamp: transaction.timestamp,
        raidId: transaction.raidId || null,
        raidName,
        itemName,
        winner: transaction.characterName || transaction.playerId || '-',
        winningBid: Math.abs(Number(transaction.amount || 0))
      }

      if (!existing) {
        grouped.set(groupKey, {
          itemName,
          totalWins: 1,
          latestTimestamp: transaction.timestamp,
          wins: [winEntry]
        })
        continue
      }

      existing.totalWins += 1
      existing.wins.push(winEntry)
      if (!existing.latestTimestamp || new Date(transaction.timestamp) > new Date(existing.latestTimestamp)) {
        existing.latestTimestamp = transaction.timestamp
      }
    }

    const items = Array.from(grouped.values())
      .map((group) => ({
        ...group,
        wins: group.wins
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 10)
      }))
      .sort((a, b) => new Date(b.latestTimestamp) - new Date(a.latestTimestamp))

    context.res = {
      status: 200,
      body: {
        itemCount: items.length,
        items
      }
    }
  } catch (error) {
    context.log.error('GetAuctionWins error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to fetch auction wins' }
    }
  }
}
