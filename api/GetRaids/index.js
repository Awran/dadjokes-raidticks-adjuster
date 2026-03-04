require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { requireMemberRole } = require('../lib/swaAuth')

let cosmosClient, raidsContainer

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
  }
  return raidsContainer
}

module.exports = async function (context, req) {
  try {
    const principal = requireMemberRole(context, req)
    if (!principal) {
      return
    }

    const container = initCosmos()
    
    const limit = parseInt(req.query.limit) || 50
    
    const { resources: raids } = await container.items
      .query({
        query: 'SELECT * FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit',
        parameters: [{ name: '@limit', value: limit }]
      })
      .fetchAll()
    
    context.res = {
      status: 200,
      body: raids
    }
  } catch (error) {
    context.log.error('GetRaids error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to fetch raids' }
    }
  }
}
