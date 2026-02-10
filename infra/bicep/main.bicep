@description('Azure region for resources')
param location string = 'eastus'

@description('Resource group name (existing)')
param rgName string

@description('Project prefix')
param project string = 'netz'

@description('Environment (prod/dev)')
param env string = 'prod'

@description('Key Vault name')
param kvName string = '${project}-${env}-kv'

@description('ObjectId of the operator running the deployment (optional). If provided, grants secret set/get/list.')
param operatorObjectId string = ''

@description('Storage account name (lowercase, globally unique)')
param storageName string

@description('PostgreSQL flexible server name')
param dbServerName string = '${project}-${env}-psql'

@description('PostgreSQL database name')
param dbName string = 'netz_platform'

@description('PostgreSQL admin username')
param dbAdminUser string = 'netzadmin'

@secure()
@description('PostgreSQL admin password (will not be output)')
param dbAdminPassword string = ''

@description('Whether to deploy PostgreSQL Flexible Server (requires regional vCPU quota)')
param deployPostgres bool = true

@description('Whether to deploy compute resources (App Service Plan + Web App + RBAC). Requires regional vCPU quota.')
param deployCompute bool = true

@description('App Service plan name')
param planName string = '${project}-${env}-plan'

@description('Web App name (globally unique)')
param appName string = '${project}-${env}-api'

@description('Log Analytics workspace name')
param lawName string = '${project}-${env}-logs'

@description('Application Insights name')
param appInsightsName string = '${project}-${env}-insights'

@description('Azure AI Search service name (existing)')
param searchServiceName string = 'netz-internacional-search'

@description('Azure AI Search index name (created post-deploy)')
param searchIndexName string = 'fund-documents-index'

var tenantId = subscription().tenantId

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: false
    accessPolicies: empty(operatorObjectId) ? [] : [
      {
        tenantId: tenantId
        objectId: operatorObjectId
        permissions: {
          secrets: [
            'get'
            'list'
            'set'
          ]
        }
      }
    ]
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    publicNetworkAccess: 'Enabled'
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
  }
}

resource dataroom 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storage.name}/default/dataroom'
  properties: {}
}

resource evidence 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storage.name}/default/evidence'
  properties: {}
}

resource monthlyReports 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storage.name}/default/monthly-reports'
  properties: {}
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = if (deployPostgres) {
  name: dbServerName
  location: location
  sku: {
    name: 'Standard_D2s_v3'
    tier: 'GeneralPurpose'
  }
  properties: {
    version: '15'
    administratorLogin: dbAdminUser
    administratorLoginPassword: dbAdminPassword
    storage: {
      storageSizeGB: 128
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = if (deployPostgres) {
  name: '${postgres.name}/${dbName}'
  properties: {}
}

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: lawName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = if (deployCompute) {
  name: planName
  location: location
  sku: {
    name: 'S1'
    tier: 'Standard'
    size: 'S1'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2023-12-01' = if (deployCompute) {
  name: appName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appSettings: [
        { name: 'ENV', value: env }
        // Key Vault reference set; secret created post-deploy
        { name: 'DATABASE_URL', value: '@Microsoft.KeyVault(SecretUri=${kv.properties.vaultUri}secrets/DATABASE-URL)' }
        { name: 'AZURE_STORAGE_ACCOUNT', value: storageName }
        { name: 'AZURE_STORAGE_CONTAINER', value: 'evidence' }
        { name: 'AZURE_STORAGE_SAS_TTL_MINUTES', value: '30' }
        { name: 'SEARCH_SERVICE', value: searchServiceName }
        { name: 'SEARCH_INDEX', value: searchIndexName }
        { name: 'KEYVAULT_NAME', value: kvName }
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY', value: insights.properties.InstrumentationKey }
      ]
    }
    httpsOnly: true
  }
}

// Key Vault access policy for WebApp managed identity
resource kvPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2023-07-01' = if (deployCompute) {
  name: '${kv.name}/add'
  properties: {
    accessPolicies: [
      {
        tenantId: tenantId
        objectId: app.identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
  }
}

// Storage RBAC: WebApp identity can write blobs
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
resource storageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployCompute) {
  name: guid(storage.id, app.name, storageBlobDataContributorRoleId)
  scope: storage
  properties: {
    principalId: app.identity.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalType: 'ServicePrincipal'
  }
}

output keyVaultName string = kv.name
output storageAccountName string = storage.name
output postgresServerName string = deployPostgres ? postgres.name : ''
output webAppName string = deployCompute ? app.name : ''
output webAppPrincipalId string = deployCompute ? app.identity.principalId : ''
