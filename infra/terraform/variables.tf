variable "subscription_id" {
  type        = string
  description = "Azure subscription ID"
}

variable "resource_group_name" {
  type        = string
  description = "Existing resource group name"
  default     = "Netz-International"
}

variable "location" {
  type    = string
  default = "eastus"
}

variable "project" {
  type    = string
  default = "netz"
}

variable "env" {
  type    = string
  default = "prod"
}

variable "key_vault_name" {
  type    = string
  default = "netz-prod-kv"
}

variable "storage_account_name" {
  type        = string
  description = "Must be lowercase and globally unique (<=24 chars)"
  default     = "netzprodstorage01"
}

variable "log_analytics_name" {
  type    = string
  default = "netz-prod-logs"
}

variable "app_insights_name" {
  type    = string
  default = "netz-prod-insights"
}

# NOTE:
# Compute resources (App Service, Postgres Flexible Server) are intentionally omitted
# from this baseline terraform because the subscription currently has 0 vCPU quota
# in East US. Add them back once quota is approved.

