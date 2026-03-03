require('../lib/ensureCrypto')
const { CosmosClient } = require('@azure/cosmos')
const { requireAdminRole } = require('../lib/swaAuth')

let cosmosClient, raidsContainer, transactionsContainer, playersContainer

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
    playersContainer = database.container('players')
  }
  return { raidsContainer, transactionsContainer, playersContainer }
}

module.exports = async function (context, req) {
  try {
    const principal = requireAdminRole(context, req)
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
        query: 'SELECT * FROM c WHERE c.raidId = @raidId',
        parameters: [{ name: '@raidId', value: raidId }]
      })
      .fetchAll()

    // Reverse all transactions - subtract amounts from player balances
    for (const transaction of transactions) {
      const playerId = transaction.playerId
      
      try {
        const { resource: player } = await containers.playersContainer.item(playerId, playerId).read()
        
        // Reverse the transaction amount
        const newBalance = (player.dkpBalance || 0) - transaction.amount
        
        await containers.playersContainer.item(playerId, playerId).replace({
          ...player,
          dkpBalance: newBalance,
          lastUpdated: new Date().toISOString()
        })
      } catch (error) {
        context.log.warn(`Could not update player ${playerId}:`, error.message)
        // Continue deleting even if player update fails
      }
      
      // Delete transaction
      try {
        await containers.transactionsContainer.item(transaction.id, transaction.playerId).delete()
      } catch (error) {
        context.log.warn(`Could not delete transaction ${transaction.id}:`, error.message)
      }
    }

    // Delete the raid
    await containers.raidsContainer.item(raidId, raidId).delete()
    
    context.res = {
      status: 200,
      body: {
        success: true,
        deletedRaid: raidId,
        reversedTransactions: transactions.length
      }
    }
  } catch (error) {
    context.log.error('DeleteRaid error:', error)
    context.res = {
      status: 500,
      body: { error: error.message || 'Failed to delete raid' }
    }
  }
}
