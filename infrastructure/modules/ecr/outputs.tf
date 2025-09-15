# ECR Module Outputs

output "repository_urls" {
  description = "Map of ECR repository URLs"
  value = {
    for k, v in aws_ecr_repository.microservices : k => v.repository_url
  }
}

output "repository_arns" {
  description = "Map of ECR repository ARNs"
  value = {
    for k, v in aws_ecr_repository.microservices : k => v.arn
  }
}

output "repository_names" {
  description = "Map of ECR repository names"
  value = {
    for k, v in aws_ecr_repository.microservices : k => v.name
  }
}

output "registry_id" {
  description = "The registry ID where the repositories are located"
  value       = values(aws_ecr_repository.microservices)[0].registry_id
}

output "kms_key_id" {
  description = "The ID of the KMS key used for ECR encryption (if enabled)"
  value       = var.encryption_type == "KMS" ? aws_kms_key.ecr[0].key_id : null
}

output "kms_key_arn" {
  description = "The ARN of the KMS key used for ECR encryption (if enabled)"
  value       = var.encryption_type == "KMS" ? aws_kms_key.ecr[0].arn : null
}

# Individual repository outputs for easy access
output "user_service_repository_url" {
  description = "ECR repository URL for user service"
  value       = aws_ecr_repository.microservices["user-service"].repository_url
}

output "booking_service_repository_url" {
  description = "ECR repository URL for booking service"
  value       = aws_ecr_repository.microservices["booking-service"].repository_url
}

output "notification_service_repository_url" {
  description = "ECR repository URL for notification service"
  value       = aws_ecr_repository.microservices["notification-service"].repository_url
}

output "maintenance_service_repository_url" {
  description = "ECR repository URL for maintenance service"
  value       = aws_ecr_repository.microservices["maintenance-service"].repository_url
}

output "issues_service_repository_url" {
  description = "ECR repository URL for issues service"
  value       = aws_ecr_repository.microservices["issues-service"].repository_url
}

output "frontend_repository_url" {
  description = "ECR repository URL for frontend"
  value       = aws_ecr_repository.microservices["frontend"].repository_url
}