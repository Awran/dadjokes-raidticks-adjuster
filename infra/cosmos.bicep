param location string = resourceGroup().location

@description('Cosmos DB Account Name')
param cosmosDbAccountName string = 'dadjokes-dkp-db'

@description('Database Name')
param databaseName string = 'DkpDatabase'

var cosmosDbAccountNameUnique = '${cosmosDbAccountName}-${uniqueString(resourceGroup().id)}'

// Create Cosmos DB Account with Serverless capacity
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosDbAccountNameUnique
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    disableKeyBasedMetadataWriteAccess: false
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
      maxIntervalInSeconds: 5
      maxStalenessPrefix: 100
    }
  }
}

// Create Database
resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// Define containers
var containers = [
  {
    name: 'players'
    partitionKey: '/id'
  }
  {
    name: 'raids'
    partitionKey: '/id'
  }
  {
    name: 'transactions'
    partitionKey: '/playerId'
  }
  {
    name: 'bids'
    partitionKey: '/playerId'
  }
  {
    name: 'users'
    partitionKey: '/id'
  }
]

// Create all containers
resource containers_resource 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = [for container in containers: {
  parent: cosmosDatabase
  name: container.name
  properties: {
    resource: {
      id: container.name
      partitionKey: {
        paths: [
          container.partitionKey
        ]
      }
    }
  }
}]

// Get connection keys
var cosmosDbKeys = cosmosAccount.listKeys()

// Outputs
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output cosmosKey string = cosmosDbKeys.primaryMasterKey
output cosmosDatabaseId string = databaseName
output cosmosAccountName string = cosmosDbAccountNameUnique
