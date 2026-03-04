require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { requireMemberRole } = require('../lib/swaAuth')

let cosmosClient, raidsContainer, transactionsContainer

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
    raidsContainer = database.container('raids')
    transactionsContainer = database.container('transactions')
  }
  return { raidsContainer, transactionsContainer }
}

module.exports = async function (context, req) {
  try {
    const principal = requireMemberRole(context, req)
    if (!principal) {
      return
    }

    const raidId = req.params.raidId
    
    if (!raidId) {
      context.res = {
        status: 400,
        body: { error: 'Raid ID required' }
      }
      return
    }
    
    const containers = initCosmos()
    
    // Get raid details
    let raid
    try {
      const { resource } = await containers.raidsContainer.item(raidId, raidId).read()
      raid = resource
    } catch (error) {
      if (error.code === 404) {
        context.res = {
          status: 404,
          body: { error: 'Raid not found' }
        }
        return
      }
      throw error
    }
    
    // Get all transactions for this raid
    const { resources: transactions } = await containers.transactionsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.raidId = @raidId ORDER BY c.timestamp',
        parameters: [{ name: '@raidId', value: raidId }]
      })
      .fetchAll()
    
    context.res = {
      status: 200,
      body: {
        ...raid,
        transactions
      }
    }
  } catch (error) {
    context.log.error('GetRaid error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to fetch raid details' }
    }
  }
}
