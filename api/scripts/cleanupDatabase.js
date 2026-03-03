// Cleanup Script - Deletes all test data from Cosmos DB
// Run with: node api/scripts/cleanupDatabase.js

const { CosmosClient } = require('@azure/cosmos');

async function cleanup() {
  // Get connection info from environment or update these directly
  const endpoint = process.env.COSMOS_ENDPOINT || 'YOUR_COSMOS_ENDPOINT';
  const key = process.env.COSMOS_KEY || 'YOUR_COSMOS_KEY';
  const databaseId = process.env.COSMOS_DATABASE_ID || 'DkpDatabase';

  console.log(`Connecting to database: ${databaseId}`);
  const client = new CosmosClient({ endpoint, key });
  const database = client.database(databaseId);

  // Delete all items from each container
  const containers = ['players', 'raids', 'transactions', 'bids', 'users'];
  
  for (const containerName of containers) {
    console.log(`\nProcessing container: ${containerName}`);
    const container = database.container(containerName);
    
    try {
      // Get all items
      const { resources: items } = await container.items
        .query('SELECT c.id, c._partitionKey FROM c')
        .fetchAll();
      
      console.log(`Found ${items.length} items in ${containerName}`);
      
      // Delete each item
      for (const item of items) {
        const partitionKeyValue = item._partitionKey || item.id;
        try {
          await container.item(item.id, partitionKeyValue).delete();
          console.log(`  Deleted: ${item.id}`);
        } catch (err) {
          console.error(`  Failed to delete ${item.id}:`, err.message);
        }
      }
      
      console.log(`✓ Cleaned ${containerName}`);
    } catch (err) {
      console.error(`✗ Error processing ${containerName}:`, err.message);
    }
  }
  
  console.log('\n🎉 Cleanup complete!');
}

cleanup().catch(console.error);
