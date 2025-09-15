# ECR Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "car-booking"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "eks_node_group_role_arn" {
  description = "ARN of the EKS node group IAM role for ECR access"
  type        = string
}

variable "image_tag_mutability" {
  description = "The tag mutability setting for the repository (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "MUTABLE"
}

variable "scan_on_push" {
  description = "Indicates whether images are scanned after being pushed to the repository"
  type        = bool
  default     = true
}

variable "encryption_type" {
  description = "The encryption type to use for the repository (AES256 or KMS)"
  type        = string
  default     = "AES256"
  validation {
    condition     = contains(["AES256", "KMS"], var.encryption_type)
    error_message = "Encryption type must be either AES256 or KMS."
  }
}

variable "max_image_count" {
  description = "Maximum number of images to keep in each repository"
  type        = number
  default     = 10
}

variable "untagged_image_retention_days" {
  description = "Number of days to retain untagged images"
  type        = number
  default     = 7
}

variable "kms_key_deletion_window_in_days" {
  description = "The waiting period, specified in number of days, for KMS key deletion"
  type        = number
  default     = 7
}

variable "kms_key_enable_key_rotation" {
  description = "Specifies whether key rotation is enabled for KMS key"
  type        = bool
  default     = true
}

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}