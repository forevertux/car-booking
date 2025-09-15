# ArgoCD Module for Car Booking System
# Installs and configures ArgoCD using Helm

locals {
  name = "${var.project_name}-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

################################################################################
# ArgoCD Namespace
################################################################################

resource "kubernetes_namespace" "argocd" {
  metadata {
    name = "argocd"
    labels = {
      "app.kubernetes.io/name"    = "argocd"
      "app.kubernetes.io/part-of" = "argocd"
    }
  }
}

################################################################################
# ArgoCD Helm Release
################################################################################

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  namespace  = kubernetes_namespace.argocd.metadata[0].name
  version    = var.argocd_chart_version

  # ArgoCD configuration values
  values = [
    yamlencode({
      global = {
        domain = var.argocd_domain
      }

      server = {
        # Ingress configuration
        ingress = {
          enabled     = true
          ingressClassName = "alb"
          annotations = {
            "kubernetes.io/ingress.class"                    = "alb"
            "alb.ingress.kubernetes.io/scheme"               = "internet-facing"
            "alb.ingress.kubernetes.io/target-type"          = "ip"
            "alb.ingress.kubernetes.io/certificate-arn"      = var.certificate_arn
            "alb.ingress.kubernetes.io/ssl-redirect"         = "443"
            "alb.ingress.kubernetes.io/listen-ports"         = "[{\"HTTP\": 80}, {\"HTTPS\": 443}]"
            "alb.ingress.kubernetes.io/backend-protocol"     = "GRPC"
            "alb.ingress.kubernetes.io/healthcheck-path"     = "/healthz"
            "external-dns.alpha.kubernetes.io/hostname"      = var.argocd_domain
          }
          hosts = [var.argocd_domain]
          tls = [{
            hosts      = [var.argocd_domain]
            secretName = "argocd-server-tls"
          }]
        }

        # Server configuration
        config = {
          # OIDC configuration (optional)
          "oidc.config" = var.enable_oidc ? yamlencode({
            name         = "OIDC"
            issuer       = var.oidc_issuer_url
            clientId     = var.oidc_client_id
            clientSecret = var.oidc_client_secret
            requestedScopes = ["openid", "profile", "email", "groups"]
            requestedIDTokenClaims = {
              groups = {
                essential = true
              }
            }
          }) : ""

          # Repository credentials template
          "repositories" = yamlencode([
            {
              url  = var.git_repository_url
              type = "git"
            }
          ])

          # Application configuration
          "application.instanceLabelKey" = "argocd.argoproj.io/instance"
        }

        # RBAC configuration
        rbacConfig = {
          "policy.default" = "role:readonly"
          "policy.csv" = <<-EOF
            p, role:admin, applications, *, */*, allow
            p, role:admin, clusters, *, *, allow
            p, role:admin, repositories, *, *, allow
            p, role:developer, applications, get, */*, allow
            p, role:developer, applications, sync, */*, allow
            g, ${var.admin_group}, role:admin
            g, ${var.developer_group}, role:developer
          EOF
        }

        # Additional configuration
        extraArgs = [
          "--insecure=false"
        ]
      }

      # Repository server configuration
      repoServer = {
        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "200m"
            memory = "256Mi"
          }
        }
      }

      # Application controller configuration
      controller = {
        resources = {
          requests = {
            cpu    = "100m"
            memory = "128Mi"
          }
          limits = {
            cpu    = "500m"
            memory = "512Mi"
          }
        }
      }

      # Redis configuration
      redis = {
        resources = {
          requests = {
            cpu    = "50m"
            memory = "64Mi"
          }
          limits = {
            cpu    = "100m"
            memory = "128Mi"
          }
        }
      }

      # Dex configuration (if OIDC is disabled)
      dex = {
        enabled = var.enable_oidc ? false : true
      }

      # Notifications controller (optional)
      notifications = {
        enabled = var.enable_notifications
      }
    })
  ]

  depends_on = [kubernetes_namespace.argocd]

  timeout = 600
}

################################################################################
# ArgoCD Admin Password Secret
################################################################################

resource "kubernetes_secret" "argocd_admin_password" {
  count = var.admin_password != "" ? 1 : 0

  metadata {
    name      = "argocd-secret"
    namespace = kubernetes_namespace.argocd.metadata[0].name
    labels = {
      "app.kubernetes.io/name"    = "argocd-secret"
      "app.kubernetes.io/part-of" = "argocd"
    }
  }

  data = {
    "admin.password"     = bcrypt(var.admin_password)
    "admin.passwordMtime" = formatdate("2006-01-02T15:04:05Z", timestamp())
  }

  type = "Opaque"

  depends_on = [helm_release.argocd]
}

################################################################################
# ArgoCD CLI Token (for CI/CD access)
################################################################################

resource "kubernetes_secret" "argocd_cli_token" {
  count = var.create_cli_token ? 1 : 0

  metadata {
    name      = "argocd-cli-token"
    namespace = kubernetes_namespace.argocd.metadata[0].name
    labels = {
      "app.kubernetes.io/name"    = "argocd-cli-token"
      "app.kubernetes.io/part-of" = "argocd"
    }
  }

  data = {
    token = var.cli_token
  }

  type = "Opaque"
}