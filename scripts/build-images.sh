#!/bin/bash

# Build and Push Docker Images for Car Booking System
# This script builds all microservice images and pushes them to ECR

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-eu-west-1}
IMAGE_TAG=${IMAGE_TAG:-latest}
ECR_REGISTRY=""

# Services to build
SERVICES=("frontend" "user-service" "booking-service" "notification-service" "maintenance-service" "issues-service")

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

get_ecr_registry() {
    log_info "Getting ECR registry URL..."
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    ECR_REGISTRY="${account_id}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    log_success "ECR Registry: $ECR_REGISTRY"
}

login_to_ecr() {
    log_info "Logging into ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
    log_success "Successfully logged into ECR"
}

build_service() {
    local service=$1
    log_info "Building $service..."

    if [ "$service" = "frontend" ]; then
        docker build -t $ECR_REGISTRY/car-booking/$service:$IMAGE_TAG ./frontend/
    else
        docker build -t $ECR_REGISTRY/car-booking/$service:$IMAGE_TAG ./backend/$service/
    fi

    log_success "Built $service image"
}

push_service() {
    local service=$1
    log_info "Pushing $service to ECR..."

    # Create repository if it doesn't exist
    aws ecr describe-repositories --repository-names car-booking/$service --region $AWS_REGION >/dev/null 2>&1 || \
    aws ecr create-repository --repository-name car-booking/$service --region $AWS_REGION >/dev/null

    # Push image
    docker push $ECR_REGISTRY/car-booking/$service:$IMAGE_TAG

    # Also tag as latest
    docker tag $ECR_REGISTRY/car-booking/$service:$IMAGE_TAG $ECR_REGISTRY/car-booking/$service:latest
    docker push $ECR_REGISTRY/car-booking/$service:latest

    log_success "Pushed $service to ECR"
}

main() {
    echo "==========================================="
    echo "🐳 Car Booking System - Build Images"
    echo "==========================================="
    echo ""

    # Check prerequisites
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi

    # Get ECR registry
    get_ecr_registry

    # Login to ECR
    login_to_ecr

    # Build and push each service
    for service in "${SERVICES[@]}"; do
        echo ""
        log_info "Processing $service..."
        build_service $service
        push_service $service
        log_success "$service completed!"
    done

    echo ""
    echo "==========================================="
    log_success "All images built and pushed successfully!"
    echo "==========================================="
    echo ""
    echo "📋 Built images:"
    for service in "${SERVICES[@]}"; do
        echo "  • $ECR_REGISTRY/car-booking/$service:$IMAGE_TAG"
    done
    echo ""
    echo "🚀 Next steps:"
    echo "  1. Deploy infrastructure: ./scripts/deploy-dev.sh infra"
    echo "  2. Setup ArgoCD: kubectl apply -f argocd/"
    echo "  3. Sync applications via ArgoCD UI"
}

# Handle command line arguments
case "${1:-build}" in
    "build")
        main
        ;;
    "frontend")
        get_ecr_registry
        login_to_ecr
        build_service frontend
        push_service frontend
        ;;
    "backend")
        get_ecr_registry
        login_to_ecr
        for service in "${SERVICES[@]}"; do
            if [ "$service" != "frontend" ]; then
                build_service $service
                push_service $service
            fi
        done
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  build     Build and push all images (default)"
        echo "  frontend  Build and push only frontend"
        echo "  backend   Build and push only backend services"
        echo "  help      Show this help message"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for usage information."
        exit 1
        ;;
esac