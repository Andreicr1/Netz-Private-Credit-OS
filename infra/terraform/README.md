## Terraform (baseline sem compute)

Este diretório contém um baseline Terraform equivalente ao deploy Bicep **sem recursos compute** (App Service / PostgreSQL),
porque a subscription está com quota regional de vCPU/VMs em `eastus` zerada no momento.

### Como usar

```powershell
cd infra/terraform
terraform init
terraform plan -var "subscription_id=24c48dc0-9cd8-47f0-9f25-cdd33073b389"
```

### O que este baseline cria

- **Key Vault**: `netz-prod-kv` (access policy para o operador conseguir `set/get/list` secrets)
- **Storage Account**: `netzprodstorage01` + containers `dataroom`, `evidence`, `monthly-reports`
- **Log Analytics Workspace** + **Application Insights** (workspace-based)

### Próximo passo (quando quota estiver liberada)

Adicionar os blocos de:

- PostgreSQL Flexible Server
- App Service Plan + Web App (com Managed Identity + Key Vault reference para `DATABASE-URL`)

