# ArgoCD Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "car-booking"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "argocd_domain" {
  description = "Domain name for ArgoCD server"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

variable "git_repository_url" {
  description = "Git repository URL for ArgoCD to monitor"
  type        = string
  default     = "https://github.com/forevertux/car-booking.git"
}

variable "argocd_chart_version" {
  description = "Version of ArgoCD Helm chart"
  type        = string
  default     = "5.46.8"
}

variable "admin_password" {
  description = "Admin password for ArgoCD"
  type        = string
  default     = ""
  sensitive   = true
}

variable "admin_group" {
  description = "Admin group for RBAC"
  type        = string
  default     = "car-booking:admins"
}

variable "developer_group" {
  description = "Developer group for RBAC"
  type        = string
  default     = "car-booking:developers"
}

variable "enable_oidc" {
  description = "Enable OIDC authentication"
  type        = bool
  default     = false
}

variable "oidc_issuer_url" {
  description = "OIDC issuer URL"
  type        = string
  default     = ""
}

variable "oidc_client_id" {
  description = "OIDC client ID"
  type        = string
  default     = ""
}

variable "oidc_client_secret" {
  description = "OIDC client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_notifications" {
  description = "Enable ArgoCD notifications"
  type        = bool
  default     = false
}

variable "create_cli_token" {
  description = "Create CLI token for programmatic access"
  type        = bool
  default     = false
}

variable "cli_token" {
  description = "CLI token for ArgoCD access"
  type        = string
  default     = ""
  sensitive   = true
}

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}