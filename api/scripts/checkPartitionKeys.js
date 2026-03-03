// Check Partition Keys - Verify container configurations
// Run with: node api/scripts/checkPartitionKeys.js

const { CosmosClient } = require('@azure/cosmos');

async function checkPartitionKeys() {
  const endpoint = process.env.COSMOS_ENDPOINT || 'YOUR_COSMOS_ENDPOINT';
  const key = process.env.COSMOS_KEY || 'YOUR_COSMOS_KEY';
  const databaseId = process.env.COSMOS_DATABASE_ID || 'DkpDatabase';

  console.log(`Checking database: ${databaseId}\n`);
  const client = new CosmosClient({ endpoint, key });
  const database = client.database(databaseId);

  const expectedPartitionKeys = {
    'players': '/id',
    'raids': '/id',
    'transactions': '/playerId',
    'bids': '/raidId',
    'users': '/id'
  };

  const containers = ['players', 'raids', 'transactions', 'bids', 'users'];
  
  for (const containerName of containers) {
    try {
      const container = database.container(containerName);
      const { resource: containerDef } = await container.read();
      
      const actualKey = containerDef.partitionKey.paths[0];
      const expectedKey = expectedPartitionKeys[containerName];
      const match = actualKey === expectedKey ? '✓' : '✗';
      
      console.log(`${match} ${containerName.padEnd(15)} Partition Key: ${actualKey.padEnd(12)} (Expected: ${expectedKey})`);
      
      if (actualKey !== expectedKey) {
        console.log(`  ⚠️  MISMATCH! Container needs to be recreated or code updated.`);
      }
    } catch (err) {
      console.error(`✗ ${containerName}: ${err.message}`);
    }
  }
  
  console.log('\n💡 If there are mismatches:');
  console.log('   Option 1: Delete containers in Azure Portal and let code recreate them');
  console.log('   Option 2: Update code to match existing partition keys');
}

checkPartitionKeys().catch(console.error);
