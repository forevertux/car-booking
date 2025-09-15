# 🚐 Car Booking System - EKS Portfolio Project

A modern, cloud-native car booking system built with microservices architecture, deployed on Amazon EKS using GitOps practices.

## 🏗️ Architecture Overview

- **Frontend**: React.js with TypeScript and Tailwind CSS
- **Backend**: Node.js microservices (Express.js)
- **Infrastructure**: Amazon EKS with Terraform
- **Database**: Amazon RDS (MySQL)
- **CI/CD**: ArgoCD (GitOps)
- **Monitoring**: Prometheus + Grafana
- **Load Balancing**: AWS Application Load Balancer

## 📁 Project Structure

```
├── terraform/                 # Infrastructure as Code
│   ├── modules/               # Reusable Terraform modules
│   │   ├── vpc/              # VPC and networking
│   │   ├── eks/              # EKS cluster configuration
│   │   ├── ecr/              # Container registry
│   │   ├── route53/          # DNS management
│   │   └── monitoring/       # Observability stack
│   └── environments/         # Environment-specific configs
│       ├── dev/              # Development environment
│       ├── staging/          # Staging environment
│       └── prod/             # Production environment
├── k8s-manifests/            # Kubernetes manifests
│   ├── base/                 # Base configurations
│   └── overlays/             # Environment overlays (Kustomize)
├── frontend/                 # React.js application
├── microservices/            # Node.js services
├── scripts/                  # Build and deployment scripts
└── docs/                     # Documentation
```

## 🚀 Quick Start

### Prerequisites

- AWS CLI configured
- Terraform >= 1.0
- kubectl
- Docker
- Node.js 18+

### 1. Clone and Setup

```bash
git clone https://github.com/forevertux/car-booking.git
cd car-booking
```

### 2. Deploy Infrastructure

```bash
# Copy and edit variables
cp infrastructure/environments/dev/terraform.tfvars.example infrastructure/environments/dev/terraform.tfvars
# Edit terraform.tfvars with your domain name

# Deploy infrastructure
./scripts/deploy-dev.sh infra
```

### 3. Build and Push Images

```bash
# Build all Docker images and push to ECR
./scripts/build-images.sh
```

### 4. Setup ArgoCD

```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Setup ArgoCD applications
kubectl apply -f argocd/
```

### 5. Access Applications

```bash
# Get ArgoCD admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port forward ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access ArgoCD at https://localhost:8080
# Username: admin, Password: from above command
```

## 🌐 Live Environments

- **Development**: `https://auto-dev.example.com`
- **Staging**: `https://auto-staging.example.com`
- **Production**: `https://auto.example.com`

## 🏷️ Microservices

| Service | Purpose | Port | Health Check |
|---------|---------|------|--------------|
| user-service | User management & auth | 3001 | `/health` |
| booking-service | Booking operations | 3002 | `/health` |
| notification-service | SMS/Email notifications | 3003 | `/health` |
| maintenance-service | Vehicle maintenance | 3004 | `/health` |
| issues-service | Issue reporting | 3005 | `/health` |

## 💰 Cost Optimization

- **Spot Instances**: 70% cost reduction on worker nodes
- **Auto Scaling**: Dynamic scaling based on demand
- **Resource Limits**: Kubernetes resource quotas
- **Estimated Monthly Cost**: ~$100-150 (dev environment)

## 🔧 Technology Stack

### Infrastructure
- **AWS EKS**: Managed Kubernetes service
- **Terraform**: Infrastructure as Code
- **AWS ALB**: Application Load Balancer
- **Route53**: DNS management
- **ECR**: Container registry

### Applications
- **React 19**: Modern frontend framework
- **TypeScript**: Type-safe development
- **Node.js 18**: Backend runtime
- **Express.js**: Web framework
- **MySQL**: Relational database

### DevOps
- **ArgoCD**: GitOps continuous delivery
- **Terraform**: Infrastructure as Code
- **Kustomize**: Kubernetes configuration management
- **Docker**: Containerization
- **ECR**: Container registry

## 📊 Monitoring & Observability

- **Health Checks**: Kubernetes liveness/readiness probes
- **Metrics**: Prometheus metrics collection
- **Dashboards**: Grafana visualization
- **Alerting**: Alert Manager integration
- **Logging**: CloudWatch Logs integration

## 🔐 Security

- **IAM Roles**: Least privilege access
- **Network Policies**: Pod-to-pod communication control
- **Secrets Management**: Kubernetes secrets
- **SSL/TLS**: End-to-end encryption
- **Security Groups**: Network-level firewall

## 🚀 Deployment Pipeline

1. **Infrastructure** → Deploy with Terraform
2. **Build** → Build Docker images locally
3. **Push** → Push images to ECR
4. **GitOps** → ArgoCD monitors repo for changes
5. **Deploy** → ArgoCD syncs applications automatically
6. **Monitor** → Built-in Kubernetes monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License

## 🔗 Links

- **Repository**: [GitHub](https://github.com/forevertux/car-booking)
- **Issues**: [GitHub Issues](https://github.com/forevertux/car-booking/issues)

---

**Built with ❤️ for learning cloud-native technologies**