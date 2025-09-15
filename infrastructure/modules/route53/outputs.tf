# Route53 Module Outputs

output "hosted_zone_id" {
  description = "The Route53 hosted zone ID"
  value       = data.aws_route53_zone.main.zone_id
}

output "hosted_zone_name" {
  description = "The Route53 hosted zone name"
  value       = data.aws_route53_zone.main.name
}

output "certificate_arn" {
  description = "The ARN of the ACM certificate"
  value       = aws_acm_certificate.main.arn
}

output "certificate_domain_name" {
  description = "The domain name of the ACM certificate"
  value       = aws_acm_certificate.main.domain_name
}

output "certificate_status" {
  description = "The status of the ACM certificate"
  value       = aws_acm_certificate.main.status
}

output "validation_record_fqdns" {
  description = "List of FQDNs built using the domain name and validation_domain"
  value       = [for record in aws_route53_record.cert_validation : record.fqdn]
}

output "subdomains" {
  description = "Map of subdomain names and their full FQDNs"
  value = {
    for key, subdomain in local.subdomains : key => "${subdomain}.${var.domain_name}"
  }
}

output "frontend_fqdn" {
  description = "Full domain name for frontend"
  value       = "${local.subdomains.frontend}.${var.domain_name}"
}

output "api_fqdn" {
  description = "Full domain name for API"
  value       = "${local.subdomains.api}.${var.domain_name}"
}

output "argocd_fqdn" {
  description = "Full domain name for ArgoCD"
  value       = "${local.subdomains.argocd}.${var.domain_name}"
}

output "grafana_fqdn" {
  description = "Full domain name for Grafana"
  value       = "${local.subdomains.grafana}.${var.domain_name}"
}

output "health_check_id" {
  description = "The ID of the Route53 health check"
  value       = var.create_health_check ? aws_route53_health_check.main[0].id : null
}

output "health_check_alarm_name" {
  description = "The name of the CloudWatch alarm for health check"
  value       = var.create_health_check ? aws_cloudwatch_metric_alarm.health_check[0].alarm_name : null
}