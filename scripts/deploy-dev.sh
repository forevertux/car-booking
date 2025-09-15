#!/bin/bash

# Car Booking System - Development Environment Deployment Script
# This script deploys the infrastructure and applications to AWS EKS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if required tools are installed
    local tools=("terraform" "kubectl" "aws" "docker" "helm")
    for tool in "${tools[@]}"; do
        if ! command -v $tool &> /dev/null; then
            log_error "$tool is not installed. Please install it first."
            exit 1
        fi
    done

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Please run 'aws configure'."
        exit 1
    fi

    log_success "All prerequisites check passed!"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure with Terraform..."

    cd terraform/environments/dev

    # Check if terraform.tfvars exists
    if [ ! -f "terraform.tfvars" ]; then
        log_warning "terraform.tfvars not found. Copying from example..."
        cp terraform.tfvars.example terraform.tfvars
        log_warning "Please edit terraform.tfvars with your configuration and run the script again."
        exit 1
    fi

    # Initialize Terraform
    log_info "Initializing Terraform..."
    terraform init

    # Plan
    log_info "Creating Terraform plan..."
    terraform plan -out=tfplan

    # Apply
    log_info "Applying Terraform configuration..."
    terraform apply tfplan

    log_success "Infrastructure deployed successfully!"

    cd ../../..
}

configure_kubectl() {
    log_info "Configuring kubectl..."

    cd terraform/environments/dev

    # Get cluster name from Terraform output
    CLUSTER_NAME=$(terraform output -raw cluster_name)
    AWS_REGION=$(terraform output -raw aws_region || echo "eu-west-1")

    # Configure kubectl
    aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME

    log_success "kubectl configured for cluster: $CLUSTER_NAME"

    cd ../../..
}

wait_for_cluster() {
    log_info "Waiting for EKS cluster to be ready..."

    # Wait for nodes to be ready
    local retries=0
    local max_retries=30

    while [ $retries -lt $max_retries ]; do
        if kubectl get nodes | grep -q "Ready"; then
            log_success "EKS cluster is ready!"
            kubectl get nodes
            return 0
        fi

        log_info "Waiting for nodes to be ready... (attempt $((retries+1))/$max_retries)"
        sleep 30
        retries=$((retries+1))
    done

    log_error "Cluster nodes are not ready after $max_retries attempts"
    exit 1
}

deploy_applications() {
    log_info "Deploying applications to Kubernetes..."

    # Deploy base applications
    if [ -d "k8s-manifests/base" ]; then
        log_info "Applying base Kubernetes manifests..."
        kubectl apply -k k8s-manifests/base/
    fi

    # Deploy environment-specific applications
    if [ -d "k8s-manifests/overlays/dev" ]; then
        log_info "Applying dev environment manifests..."
        kubectl apply -k k8s-manifests/overlays/dev/
    fi

    log_success "Applications deployed successfully!"
}

show_cluster_info() {
    log_info "Cluster Information:"

    cd terraform/environments/dev

    # Get outputs from Terraform
    echo ""
    echo "=== EKS Cluster ==="
    terraform output cluster_name
    terraform output cluster_endpoint

    echo ""
    echo "=== ECR Repositories ==="
    terraform output ecr_repository_urls

    echo ""
    echo "=== Application URLs ==="
    terraform output application_urls

    echo ""
    echo "=== kubectl Configuration ==="
    terraform output kubectl_config_command

    echo ""
    echo "=== Docker Login ==="
    terraform output docker_login_command

    echo ""
    echo "=== Cost Estimation ==="
    terraform output estimated_monthly_cost

    cd ../../..
}

cleanup() {
    if [ "$1" = "destroy" ]; then
        log_warning "This will destroy all infrastructure. Are you sure? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            log_info "Destroying infrastructure..."
            cd terraform/environments/dev
            terraform destroy
            cd ../../..
            log_success "Infrastructure destroyed."
        else
            log_info "Cleanup cancelled."
        fi
    fi
}

main() {
    echo "==========================================="
    echo "🚐 Car Booking System - Dev Deployment"
    echo "==========================================="
    echo ""

    case "${1:-deploy}" in
        "deploy")
            check_prerequisites
            deploy_infrastructure
            configure_kubectl
            wait_for_cluster
            deploy_applications
            show_cluster_info
            ;;
        "infra")
            check_prerequisites
            deploy_infrastructure
            configure_kubectl
            show_cluster_info
            ;;
        "apps")
            configure_kubectl
            deploy_applications
            ;;
        "info")
            show_cluster_info
            ;;
        "destroy")
            cleanup destroy
            ;;
        "help"|"-h"|"--help")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  deploy    Deploy infrastructure and applications (default)"
            echo "  infra     Deploy only infrastructure"
            echo "  apps      Deploy only applications"
            echo "  info      Show cluster information"
            echo "  destroy   Destroy all infrastructure"
            echo "  help      Show this help message"
            ;;
        *)
            log_error "Unknown command: $1"
            echo "Use '$0 help' for usage information."
            exit 1
            ;;
    esac
}

main "$@"