# Development Environment Outputs

################################################################################
# VPC Outputs
################################################################################

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

################################################################################
# EKS Outputs
################################################################################

output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "cluster_iam_role_arn" {
  description = "IAM role ARN associated with EKS cluster"
  value       = module.eks.cluster_iam_role_arn
}

output "node_group_iam_role_arn" {
  description = "IAM role ARN associated with EKS node group"
  value       = module.eks.node_group_iam_role_arn
}

output "cluster_oidc_issuer_url" {
  description = "The URL on the EKS cluster for the OpenID Connect identity provider"
  value       = module.eks.cluster_oidc_issuer_url
}

################################################################################
# ECR Outputs
################################################################################

output "ecr_repository_urls" {
  description = "Map of ECR repository URLs"
  value       = module.ecr.repository_urls
}

output "ecr_registry_id" {
  description = "ECR registry ID"
  value       = module.ecr.registry_id
}

################################################################################
# Route53 Outputs
################################################################################

output "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  value       = module.route53.hosted_zone_id
}

output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = module.route53.certificate_arn
}

output "frontend_fqdn" {
  description = "Frontend fully qualified domain name"
  value       = module.route53.frontend_fqdn
}

output "api_fqdn" {
  description = "API fully qualified domain name"
  value       = module.route53.api_fqdn
}

output "argocd_fqdn" {
  description = "ArgoCD fully qualified domain name"
  value       = module.route53.argocd_fqdn
}

output "grafana_fqdn" {
  description = "Grafana fully qualified domain name"
  value       = module.route53.grafana_fqdn
}

################################################################################
# IAM Outputs
################################################################################

output "aws_load_balancer_controller_role_arn" {
  description = "ARN of the AWS Load Balancer Controller IAM role"
  value       = module.load_balancer_controller_irsa_role.iam_role_arn
}

output "ebs_csi_driver_role_arn" {
  description = "ARN of the EBS CSI Driver IAM role"
  value       = module.ebs_csi_irsa_role.iam_role_arn
}

################################################################################
# kubectl Configuration
################################################################################

output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

################################################################################
# Application URLs
################################################################################

output "application_urls" {
  description = "URLs for accessing the application components"
  value = {
    frontend = "https://${module.route53.frontend_fqdn}"
    api      = "https://${module.route53.api_fqdn}"
    argocd   = "https://${module.route53.argocd_fqdn}"
    grafana  = "https://${module.route53.grafana_fqdn}"
  }
}

################################################################################
# Docker Commands
################################################################################

output "docker_login_command" {
  description = "Command to log in to ECR"
  value       = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${module.ecr.registry_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
}

################################################################################
# Cost Estimation
################################################################################

output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown"
  value = {
    eks_control_plane = "$73.00"
    worker_nodes      = "~$15.00 (2x t3.small spot instances)"
    alb              = "~$16.20"
    nat_gateway      = "~$32.40 (per AZ)"
    route53          = "~$0.50 per hosted zone"
    ecr              = "Free tier (500MB)"
    estimated_total  = "~$100-150 USD/month"
  }
}