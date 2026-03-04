require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { requireAdminRole } = require('../lib/swaAuth')

module.exports = async function (context, req) {
  try {
    const principal = requireAdminRole(context, req)
    if (!principal) {
      return
    }

    const endpoint = process.env.COSMOS_ENDPOINT
    const key = process.env.COSMOS_KEY
    const databaseId = process.env.COSMOS_DATABASE_ID || 'DkpDatabase'
    
    if (!endpoint || !key) {
      context.res = {
        status: 500,
        body: { error: 'Cosmos DB not configured' }
      }
      return
    }
    
    const client = new CosmosClient({ endpoint, key })
    const database = client.database(databaseId)
    
    // Get container info
    const playersContainer = database.container('players')
    const raidsContainer = database.container('raids')
    const transactionsContainer = database.container('transactions')
    
    // Count items in each container
    const playersQuery = await playersContainer.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll()
    const raidsQuery = await raidsContainer.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll()
    const transactionsQuery = await transactionsContainer.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll()
    
    // Get a sample player if any exist
    const samplePlayersQuery = await playersContainer.items.query('SELECT TOP 5 * FROM c').fetchAll()
    const sampleRaidsQuery = await raidsContainer.items.query('SELECT TOP 5 * FROM c').fetchAll()
    const sampleTransactionsQuery = await transactionsContainer.items.query('SELECT TOP 5 * FROM c').fetchAll()
    
    context.res = {
      status: 200,
      body: {
        database: databaseId,
        containers: {
          players: {
            count: playersQuery.resources[0] || 0,
            samples: samplePlayersQuery.resources
          },
          raids: {
            count: raidsQuery.resources[0] || 0,
            samples: sampleRaidsQuery.resources
          },
          transactions: {
            count: transactionsQuery.resources[0] || 0,
            samples: sampleTransactionsQuery.resources
          }
        }
      }
    }
  } catch (error) {
    context.log.error('DebugContainers error:', error)
    context.res = {
      status: 500,
      body: { 
        error: error.message,
        code: error.code,
        stack: error.stack
      }
    }
  }
}
