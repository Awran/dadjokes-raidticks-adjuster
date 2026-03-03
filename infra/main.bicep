targetScope = 'resourceGroup'

param location string = resourceGroup().location

module cosmosDb 'cosmos.bicep' = {
  name: 'cosmosDbDeployment'
  params: {
    location: location
  }
}

output COSMOS_ENDPOINT string = cosmosDb.outputs.cosmosEndpoint
output COSMOS_KEY string = cosmosDb.outputs.cosmosKey
output COSMOS_DATABASE_ID string = cosmosDb.outputs.cosmosDatabaseId
