# Route53 Module for Car Booking System
# Creates DNS records for the application subdomains

locals {
  subdomains = {
    frontend = "auto-${var.environment}"
    api      = "api-${var.environment}"
    argocd   = "argocd-${var.environment}"
    grafana  = "grafana-${var.environment}"
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

################################################################################
# Data Sources
################################################################################

data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

################################################################################
# ACM Certificate for HTTPS
################################################################################

resource "aws_acm_certificate" "main" {
  domain_name       = "*.${var.domain_name}"
  validation_method = "DNS"

  subject_alternative_names = [
    var.domain_name,
    "*.${var.environment}.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = local.tags
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "5m"
  }
}

################################################################################
# Application Load Balancer Records
################################################################################

# These will be created by the ALB Ingress Controller
# We're just reserving the records here for reference

resource "aws_route53_record" "app_records" {
  for_each = var.create_alb_records ? local.subdomains : {}

  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${each.value}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }

  depends_on = [aws_acm_certificate_validation.main]
}

################################################################################
# Health Check (optional)
################################################################################

resource "aws_route53_health_check" "main" {
  count = var.create_health_check ? 1 : 0

  fqdn                            = "${local.subdomains.frontend}.${var.domain_name}"
  port                            = 443
  type                            = "HTTPS"
  resource_path                   = "/health"
  failure_threshold               = "3"
  request_interval                = "30"
  cloudwatch_alarm_region         = var.aws_region
  cloudwatch_alarm_name           = "${var.project_name}-${var.environment}-health-check"
  insufficient_data_health_status = "Failure"

  tags = merge(local.tags, {
    Name = "${var.project_name}-${var.environment}-health-check"
  })
}

################################################################################
# CloudWatch Alarm for Health Check
################################################################################

resource "aws_cloudwatch_metric_alarm" "health_check" {
  count = var.create_health_check ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-health-check"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors health check status"
  alarm_actions       = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  dimensions = {
    HealthCheckId = aws_route53_health_check.main[0].id
  }

  tags = local.tags
}