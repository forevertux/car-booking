# EKS Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "car-booking"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where EKS cluster will be created"
  type        = string
}

variable "vpc_cidr_block" {
  description = "VPC CIDR block"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for EKS cluster"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for EKS cluster"
  type        = list(string)
}

# Cluster Configuration
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
  description = "List of CIDR blocks that can access the Amazon EKS public API server endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "cluster_enabled_log_types" {
  description = "List of control plane logging to enable"
  type        = list(string)
  default     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
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

variable "node_group_ami_type" {
  description = "Type of Amazon Machine Image (AMI) associated with the EKS Node Group"
  type        = string
  default     = "AL2_x86_64"
}

variable "node_group_disk_size" {
  description = "Disk size in GiB for worker nodes"
  type        = number
  default     = 20
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

variable "node_group_max_unavailable_percentage" {
  description = "Maximum percentage of nodes unavailable during update"
  type        = number
  default     = 25
}

# Add-on versions
variable "vpc_cni_addon_version" {
  description = "Version of the VPC CNI addon"
  type        = string
  default     = null
}

variable "coredns_addon_version" {
  description = "Version of the CoreDNS addon"
  type        = string
  default     = null
}

variable "kube_proxy_addon_version" {
  description = "Version of the Kube Proxy addon"
  type        = string
  default     = null
}

variable "ebs_csi_addon_version" {
  description = "Version of the EBS CSI addon"
  type        = string
  default     = null
}

# Service Account Role ARNs (optional, for IRSA)
variable "vpc_cni_service_account_role_arn" {
  description = "Service account role ARN for VPC CNI addon"
  type        = string
  default     = null
}

variable "ebs_csi_service_account_role_arn" {
  description = "Service account role ARN for EBS CSI addon"
  type        = string
  default     = null
}

# CloudWatch
variable "cloudwatch_log_group_retention_in_days" {
  description = "Number of days to retain log events in CloudWatch"
  type        = number
  default     = 14
}

# KMS
variable "kms_key_deletion_window_in_days" {
  description = "The waiting period, specified in number of days"
  type        = number
  default     = 7
}

variable "kms_key_enable_key_rotation" {
  description = "Specifies whether key rotation is enabled"
  type        = bool
  default     = true
}

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}