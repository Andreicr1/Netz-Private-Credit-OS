$ErrorActionPreference = "Stop"

$SubscriptionId = "24c48dc0-9cd8-47f0-9f25-cdd33073b389"
$ResourceGroup = "Netz-International"

az account set --subscription $SubscriptionId | Out-Null

az deployment group create `
  --resource-group $ResourceGroup `
  --template-file "main.bicep" `
  --parameters "@prod.parameters.json" | Out-Null

Write-Host "OK: Bicep (non-compute) aplicado."

