$ErrorActionPreference = "Stop"

function New-StrongPassword {
  param([int]$Len = 32)
  $lower   = "abcdefghijkmnopqrstuvwxyz".ToCharArray()
  $upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ".ToCharArray()
  $digits  = "23456789".ToCharArray()
  $special = "!@#$%_-".ToCharArray()
  $all = @($lower + $upper + $digits + $special)

  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  function Pick([char[]]$chars) {
    $b = New-Object byte[] 1
    $rng.GetBytes($b)
    return $chars[$b[0] % $chars.Length]
  }

  $pw = @()
  $pw += (Pick $lower)
  $pw += (Pick $upper)
  $pw += (Pick $digits)
  $pw += (Pick $special)
  for ($i = $pw.Count; $i -lt $Len; $i++) { $pw += (Pick $all) }
  $pw = $pw | Sort-Object { Get-Random }
  return (-join $pw)
}

$SubscriptionId = "24c48dc0-9cd8-47f0-9f25-cdd33073b389"
$ResourceGroup = "Netz-International"
$KeyVaultName = "netz-prod-kv"

$DbServer = "netz-prod-psql"
$DbName = "netz_platform"
$DbAdminUser = "netzadmin"

az account set --subscription $SubscriptionId | Out-Null

# Requer quota regional de vCPU/VM em eastus (Postgres Flexible + App Service)
$dbPassword = New-StrongPassword -Len 32

az deployment group create `
  --resource-group $ResourceGroup `
  --template-file "main.bicep" `
  --parameters "@prod.parameters.json" `
  --parameters deployCompute=true deployPostgres=true dbAdminPassword=$dbPassword | Out-Null

# Registra segredos pós-deploy (sem imprimir valores)
az keyvault secret set --vault-name $KeyVaultName --name "POSTGRES-PASSWORD" --value $dbPassword | Out-Null

$dbUrl = "postgresql+psycopg://$DbAdminUser:$dbPassword@$DbServer.postgres.database.azure.com/$DbName?sslmode=require"
az keyvault secret set --vault-name $KeyVaultName --name "DATABASE-URL" --value $dbUrl | Out-Null

Write-Host "OK: Bicep (full) aplicado e segredos registrados no Key Vault."

