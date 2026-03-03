// Setup Cosmos DB Containers with correct partition keys
// Run with: node api/scripts/setupContainers.js
// This will DELETE existing containers and recreate them!

const { CosmosClient } = require('@azure/cosmos');

async function setupContainers() {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE_ID || 'DkpDatabase';

  if (!endpoint || !key) {
    console.error('❌ Error: COSMOS_ENDPOINT and COSMOS_KEY environment variables required');
    console.log('\nSet them first:');
    console.log('  $env:COSMOS_ENDPOINT="your-endpoint"');
    console.log('  $env:COSMOS_KEY="your-key"');
    return;
  }

  console.log(`🔄 Setting up database: ${databaseId}\n`);
  const client = new CosmosClient({ endpoint, key });

  // Ensure database exists
  const { database } = await client.databases.createIfNotExists({ id: databaseId });
  console.log(`✓ Database "${databaseId}" ready\n`);

  // Container configurations
  const containers = [
    { id: 'players', partitionKey: '/id', description: 'Player records with DKP balances' },
    { id: 'raids', partitionKey: '/id', description: 'Raid records' },
    { id: 'transactions', partitionKey: '/playerId', description: 'DKP transactions' },
    { id: 'bids', partitionKey: '/raidId', description: 'Item bid records' },
    { id: 'users', partitionKey: '/id', description: 'Admin user accounts' }
  ];

  for (const config of containers) {
    console.log(`📦 Container: ${config.id}`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Partition Key: ${config.partitionKey}`);

    try {
      // Check if container exists
      const container = database.container(config.id);
      try {
        const { resource } = await container.read();
        const currentPartitionKey = resource.partitionKey.paths[0];
        
        if (currentPartitionKey === config.partitionKey) {
          console.log(`   ✓ Already exists with correct partition key\n`);
          continue;
        } else {
          console.log(`   ⚠️  Exists with WRONG partition key: ${currentPartitionKey}`);
          console.log(`   🗑️  Deleting container...`);
          await container.delete();
          console.log(`   ✓ Deleted\n`);
        }
      } catch (err) {
        if (err.code !== 404) throw err;
        // Container doesn't exist, will create it
      }

      // Create container with correct partition key
      console.log(`   ➕ Creating with partition key: ${config.partitionKey}`);
      await database.containers.create({
        id: config.id,
        partitionKey: {
          paths: [config.partitionKey],
          version: 2
        }
      });
      console.log(`   ✓ Created successfully\n`);

    } catch (err) {
      console.error(`   ❌ Error: ${err.message}\n`);
    }
  }

  console.log('🎉 Container setup complete!');
  console.log('\nYou can now upload raids and player data will be created correctly.');
}

setupContainers().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
