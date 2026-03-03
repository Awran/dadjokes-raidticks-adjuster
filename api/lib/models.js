import { getContainer, CONTAINERS } from './cosmos.js'

/**
 * Get or create a player record
 */
export const getOrCreatePlayer = async (userId, displayName) => {
  const container = await getContainer(CONTAINERS.PLAYERS)
  
  try {
    const { resource } = await container.item(userId, userId).read()
    return resource
  } catch (error) {
    // Player doesn't exist, create it
    const newPlayer = {
      id: userId,
      displayName,
      totalDkp: 0,
      lastUpdated: new Date().toISOString()
    }
    
    const { resource } = await container.items.create(newPlayer)
    return resource
  }
}

/**
 * Update player DKP balance
 */
export const updatePlayerDkp = async (playerId, dkpChange, reason, raidId = null) => {
  const container = await getContainer(CONTAINERS.PLAYERS)
  const { resource: player } = await container.item(playerId, playerId).read()
  
  player.totalDkp += dkpChange
  player.lastUpdated = new Date().toISOString()
  
  await container.item(playerId, playerId).replace(player)
  
  // Record transaction
  await createTransaction({
    playerId,
    amount: dkpChange,
    reason,
    raidId,
    timestamp: new Date().toISOString()
  })
  
  return player
}

/**
 * Create a transaction record
 */
export const createTransaction = async (transaction) => {
  const container = await getContainer(CONTAINERS.TRANSACTIONS)
  const txn = {
    id: `${transaction.playerId}-${Date.now()}`,
    ...transaction
  }
  const { resource } = await container.items.create(txn)
  return resource
}

/**
 * Get player transaction history
 */
export const getPlayerTransactions = async (playerId, limit = 50) => {
  const container = await getContainer(CONTAINERS.TRANSACTIONS)
  const query = {
    query: 'SELECT * FROM c WHERE c.playerId = @playerId ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit',
    parameters: [
      { name: '@playerId', value: playerId },
      { name: '@limit', value: limit }
    ]
  }
  
  const { resources } = await container.items.query(query).fetchAll()
  return resources
}

/**
 * Get all players with DKP balances
 */
export const getAllPlayers = async () => {
  const container = await getContainer(CONTAINERS.PLAYERS)
  const query = {
    query: 'SELECT * FROM c ORDER BY c.totalDkp DESC'
  }
  
  const { resources } = await container.items.query(query).fetchAll()
  return resources
}

/**
 * Create a raid record
 */
export const createRaid = async (raidData) => {
  const container = await getContainer(CONTAINERS.RAIDS)
  const raid = {
    id: `raid-${Date.now()}`,
    date: new Date().toISOString(),
    ...raidData
  }
  
  const { resource } = await container.items.create(raid)
  return resource
}

/**
 * Get raid history
 */
export const getRaidHistory = async (limit = 50) => {
  const container = await getContainer(CONTAINERS.RAIDS)
  const query = {
    query: 'SELECT * FROM c ORDER BY c.date DESC OFFSET 0 LIMIT @limit',
    parameters: [{ name: '@limit', value: limit }]
  }
  
  const { resources } = await container.items.query(query).fetchAll()
  return resources
}

/**
 * Create or update a bid
 */
export const saveBid = async (bidData) => {
  const container = await getContainer(CONTAINERS.BIDS)
  const bid = {
    id: `${bidData.raidId}-${bidData.playerId}-${bidData.item}`,
    timestamp: new Date().toISOString(),
    ...bidData
  }
  
  const { resource } = await container.items.upsert(bid)
  return resource
}

/**
 * Get bids for a raid
 */
export const getRaidBids = async (raidId) => {
  const container = await getContainer(CONTAINERS.BIDS)
  const query = {
    query: 'SELECT * FROM c WHERE c.raidId = @raidId',
    parameters: [{ name: '@raidId', value: raidId }]
  }
  
  const { resources } = await container.items.query(query).fetchAll()
  return resources
}
