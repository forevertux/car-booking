# Development Environment Variables

################################################################################
# General Variables
################################################################################

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "car-booking"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  # Set this in terraform.tfvars or via CLI
  # Example: "example.com"
}

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default = {
    Owner       = "DevOps Team"
    CostCenter  = "Engineering"
    Repository  = "car-booking"
  }
}

################################################################################
# EKS Variables
################################################################################

variable "cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "cluster_endpoint_private_access" {
  description = "Enable private API server endpoint"
  type        = bool
  default     = true
}

variable "cluster_endpoint_public_access" {
  description = "Enable public API server endpoint"
  type        = bool
  default     = true
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "List of CIDR blocks that can access the public API server endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# Node Group Configuration
variable "node_group_capacity_type" {
  description = "Type of capacity associated with the EKS Node Group (ON_DEMAND, SPOT)"
  type        = string
  default     = "SPOT"
}

variable "node_group_instance_types" {
  description = "Set of instance types associated with the EKS Node Group"
  type        = list(string)
  default     = ["t3.small", "t3.medium"]
}

variable "node_group_desired_size" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 2
}

variable "node_group_max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 4
}

variable "node_group_min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 1
}

################################################################################
# ECR Variables
################################################################################

variable "ecr_image_tag_mutability" {
  description = "The tag mutability setting for ECR repositories"
  type        = string
  default     = "MUTABLE"
}

variable "ecr_scan_on_push" {
  description = "Indicates whether images are scanned after being pushed to ECR"
  type        = bool
  default     = true
}

variable "ecr_encryption_type" {
  description = "The encryption type to use for ECR repositories"
  type        = string
  default     = "AES256"
}

################################################################################
# Route53 Variables
################################################################################

variable "route53_create_health_check" {
  description = "Whether to create Route53 health check"
  type        = bool
  default     = false
}

################################################################################
# Helm Chart Variables
################################################################################

variable "aws_load_balancer_controller_chart_version" {
  description = "Version of AWS Load Balancer Controller Helm chart"
  type        = string
  default     = "1.6.2"
}

variable "install_external_dns" {
  description = "Whether to install External DNS"
  type        = bool
  default     = false
}

variable "external_dns_chart_version" {
  description = "Version of External DNS Helm chart"
  type        = string
  default     = "1.13.1"
}

################################################################################
# ArgoCD Variables
################################################################################

variable "install_argocd" {
  description = "Whether to install ArgoCD"
  type        = bool
  default     = true
}

variable "argocd_chart_version" {
  description = "Version of ArgoCD Helm chart"
  type        = string
  default     = "5.46.8"
}

variable "argocd_admin_password" {
  description = "Admin password for ArgoCD (will be hashed)"
  type        = string
  default     = "admin123"
  sensitive   = true
}

################################################################################
# Monitoring Variables
################################################################################

variable "install_monitoring" {
  description = "Whether to install Prometheus and Grafana"
  type        = bool
  default     = false
}

variable "prometheus_chart_version" {
  description = "Version of Prometheus Helm chart"
  type        = string
  default     = "25.8.0"
}

variable "grafana_chart_version" {
  description = "Version of Grafana Helm chart"
  type        = string
  default     = "7.0.8"
}