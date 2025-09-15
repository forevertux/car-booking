# Route53 Module Variables

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "car-booking"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the Route53 hosted zone"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "create_alb_records" {
  description = "Whether to create ALB DNS records"
  type        = bool
  default     = false
}

variable "alb_dns_name" {
  description = "DNS name of the ALB"
  type        = string
  default     = ""
}

variable "alb_zone_id" {
  description = "Zone ID of the ALB"
  type        = string
  default     = ""
}

variable "create_health_check" {
  description = "Whether to create Route53 health check"
  type        = bool
  default     = false
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for health check alarms"
  type        = string
  default     = null
}

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}