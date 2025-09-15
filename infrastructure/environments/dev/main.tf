# Development Environment Configuration
# This is the main Terraform configuration for the development environment

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }

  # Uncomment and configure for remote state
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "car-booking/dev/terraform.tfstate"
  #   region = "eu-west-1"
  # }
}

################################################################################
# Provider Configuration
################################################################################

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}

################################################################################
# Local Variables
################################################################################

locals {
  name = "${var.project_name}-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

################################################################################
# VPC Module
################################################################################

module "vpc" {
  source = "../../modules/vpc"

  project_name = var.project_name
  environment  = var.environment

  additional_tags = var.additional_tags
}

################################################################################
# EKS Module
################################################################################

module "eks" {
  source = "../../modules/eks"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  vpc_cidr_block     = module.vpc.vpc_cidr_block
  private_subnet_ids = module.vpc.private_subnet_ids
  public_subnet_ids  = module.vpc.public_subnet_ids

  # EKS Configuration
  cluster_version                      = var.cluster_version
  cluster_endpoint_private_access      = var.cluster_endpoint_private_access
  cluster_endpoint_public_access       = var.cluster_endpoint_public_access
  cluster_endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs

  # Node Group Configuration
  node_group_capacity_type   = var.node_group_capacity_type
  node_group_instance_types  = var.node_group_instance_types
  node_group_desired_size    = var.node_group_desired_size
  node_group_max_size        = var.node_group_max_size
  node_group_min_size        = var.node_group_min_size

  additional_tags = var.additional_tags

  depends_on = [module.vpc]
}

################################################################################
# ECR Module
################################################################################

module "ecr" {
  source = "../../modules/ecr"

  project_name             = var.project_name
  environment              = var.environment
  eks_node_group_role_arn  = module.eks.node_group_iam_role_arn

  # ECR Configuration
  image_tag_mutability = var.ecr_image_tag_mutability
  scan_on_push         = var.ecr_scan_on_push
  encryption_type      = var.ecr_encryption_type

  additional_tags = var.additional_tags

  depends_on = [module.eks]
}

################################################################################
# Route53 Module
################################################################################

module "route53" {
  source = "../../modules/route53"

  project_name = var.project_name
  environment  = var.environment
  domain_name  = var.domain_name
  aws_region   = var.aws_region

  # Route53 Configuration
  create_health_check = var.route53_create_health_check

  additional_tags = var.additional_tags
}

################################################################################
# EKS OIDC Provider (for service accounts)
################################################################################

data "tls_certificate" "cluster" {
  url = module.eks.cluster_oidc_issuer_url
}

resource "aws_iam_openid_connect_provider" "cluster" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.cluster.certificates[0].sha1_fingerprint]
  url             = module.eks.cluster_oidc_issuer_url

  tags = local.tags
}

################################################################################
# AWS Load Balancer Controller IAM Role
################################################################################

module "load_balancer_controller_irsa_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"

  role_name = "${local.name}-aws-load-balancer-controller"

  attach_load_balancer_controller_policy = true

  oidc_providers = {
    ex = {
      provider_arn               = aws_iam_openid_connect_provider.cluster.arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }

  tags = local.tags
}

################################################################################
# EBS CSI Driver IAM Role
################################################################################

module "ebs_csi_irsa_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"

  role_name = "${local.name}-ebs-csi-driver"

  attach_ebs_csi_policy = true

  oidc_providers = {
    ex = {
      provider_arn               = aws_iam_openid_connect_provider.cluster.arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = local.tags
}

################################################################################
# Helm Charts
################################################################################

# AWS Load Balancer Controller
resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"
  version    = var.aws_load_balancer_controller_chart_version

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.load_balancer_controller_irsa_role.iam_role_arn
  }

  depends_on = [
    module.eks,
    module.load_balancer_controller_irsa_role,
  ]
}

# External DNS (optional)
resource "helm_release" "external_dns" {
  count = var.install_external_dns ? 1 : 0

  name       = "external-dns"
  repository = "https://kubernetes-sigs.github.io/external-dns/"
  chart      = "external-dns"
  namespace  = "kube-system"
  version    = var.external_dns_chart_version

  set {
    name  = "provider"
    value = "aws"
  }

  set {
    name  = "aws.region"
    value = var.aws_region
  }

  set {
    name  = "domainFilters[0]"
    value = var.domain_name
  }

  set {
    name  = "txtOwnerId"
    value = local.name
  }

  depends_on = [
    module.eks,
    helm_release.aws_load_balancer_controller,
  ]
}