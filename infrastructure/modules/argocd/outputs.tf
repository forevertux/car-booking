# ArgoCD Module Outputs

output "argocd_namespace" {
  description = "ArgoCD namespace name"
  value       = kubernetes_namespace.argocd.metadata[0].name
}

output "argocd_server_url" {
  description = "ArgoCD server URL"
  value       = "https://${var.argocd_domain}"
}

output "argocd_admin_password_secret_name" {
  description = "Name of the secret containing ArgoCD admin password"
  value       = var.admin_password != "" ? kubernetes_secret.argocd_admin_password[0].metadata[0].name : null
}

output "argocd_cli_token_secret_name" {
  description = "Name of the secret containing ArgoCD CLI token"
  value       = var.create_cli_token ? kubernetes_secret.argocd_cli_token[0].metadata[0].name : null
}

output "repository_url" {
  description = "Git repository URL configured in ArgoCD"
  value       = var.git_repository_url
}

output "helm_release_name" {
  description = "Name of the ArgoCD Helm release"
  value       = helm_release.argocd.name
}

output "helm_release_status" {
  description = "Status of the ArgoCD Helm release"
  value       = helm_release.argocd.status
}