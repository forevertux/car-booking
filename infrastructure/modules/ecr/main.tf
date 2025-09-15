# ECR Module for Car Booking System
# Creates ECR repositories for all microservices

locals {
  microservices = [
    "user-service",
    "booking-service",
    "notification-service",
    "maintenance-service",
    "issues-service",
    "frontend"
  ]

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

################################################################################
# ECR Repositories
################################################################################

resource "aws_ecr_repository" "microservices" {
  for_each = toset(local.microservices)

  name                 = "${var.project_name}/${each.value}"
  image_tag_mutability = var.image_tag_mutability

  image_scanning_configuration {
    scan_on_push = var.scan_on_push
  }

  encryption_configuration {
    encryption_type = var.encryption_type
    kms_key         = var.encryption_type == "KMS" ? aws_kms_key.ecr[0].arn : null
  }

  tags = merge(local.tags, {
    Service = each.value
  })
}

################################################################################
# ECR Repository Policies
################################################################################

resource "aws_ecr_repository_policy" "microservices" {
  for_each = aws_ecr_repository.microservices

  repository = each.value.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPull"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root",
            var.eks_node_group_role_arn
          ]
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      },
      {
        Sid    = "AllowPush"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
          ]
        }
        Action = [
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
      }
    ]
  })
}

################################################################################
# ECR Lifecycle Policies
################################################################################

resource "aws_ecr_lifecycle_policy" "microservices" {
  for_each = aws_ecr_repository.microservices

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.max_image_count} images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = var.max_image_count
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images older than ${var.untagged_image_retention_days} days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.untagged_image_retention_days
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

################################################################################
# KMS Key for ECR (optional)
################################################################################

resource "aws_kms_key" "ecr" {
  count = var.encryption_type == "KMS" ? 1 : 0

  description             = "KMS key for ECR encryption"
  deletion_window_in_days = var.kms_key_deletion_window_in_days
  enable_key_rotation     = var.kms_key_enable_key_rotation

  tags = local.tags
}

resource "aws_kms_alias" "ecr" {
  count = var.encryption_type == "KMS" ? 1 : 0

  name          = "alias/${var.project_name}-ecr"
  target_key_id = aws_kms_key.ecr[0].key_id
}

################################################################################
# Data Sources
################################################################################

data "aws_caller_identity" "current" {}