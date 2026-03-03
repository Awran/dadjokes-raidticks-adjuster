import './ensureCrypto.js'
import { CosmosClient } from '@azure/cosmos'

const endpoint = process.env.COSMOS_ENDPOINT
const key = process.env.COSMOS_KEY
const databaseId = process.env.COSMOS_DATABASE_ID || process.env.COSMOS_DATABASE || 'DkpDatabase'

let client = null
let database = null
let containers = {}

export const initCosmos = async () => {
  if (!client) {
    client = new CosmosClient({ endpoint, key })
    database = client.database(databaseId)
  }
  return database
}

export const getContainer = async (containerId) => {
  if (!containers[containerId]) {
    const db = await initCosmos()
    containers[containerId] = db.container(containerId)
  }
  return containers[containerId]
}

// Container names
export const CONTAINERS = {
  PLAYERS: 'players',
  RAIDS: 'raids',
  TRANSACTIONS: 'transactions',
  BIDS: 'bids',
  USERS: 'users'
}

// Initialize containers if they don't exist
export const ensureContainers = async () => {
  const db = await initCosmos()
  
  const containerConfigs = [
    { id: CONTAINERS.PLAYERS, partitionKey: '/id' },
    { id: CONTAINERS.RAIDS, partitionKey: '/id' },
    { id: CONTAINERS.TRANSACTIONS, partitionKey: '/playerId' },
    { id: CONTAINERS.BIDS, partitionKey: '/raidId' },
    { id: CONTAINERS.USERS, partitionKey: '/email' }
  ]

  for (const config of containerConfigs) {
    try {
      await db.containers.createIfNotExists(config)
    } catch (error) {
      console.error(`Error creating container ${config.id}:`, error)
    }
  }
}
