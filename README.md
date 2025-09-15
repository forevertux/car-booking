# 🚐 Car Booking System - EKS Portfolio Project

A modern, cloud-native car booking system built with microservices architecture, deployed on Amazon EKS using GitOps practices.

## 🏗️ Architecture Overview

- **Frontend**: React.js with TypeScript and Tailwind CSS
- **Backend**: Node.js microservices (Express.js)
- **Infrastructure**: Amazon EKS with Terraform
- **Database**: Amazon RDS (MySQL)
- **CI/CD**: GitHub Actions + ArgoCD (GitOps)
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
├── .github/workflows/        # CI/CD pipelines
└── docs/                     # Documentation
```

## 🚀 Quick Start

### Prerequisites

- AWS CLI configured
- Terraform >= 1.0
- kubectl
- Docker
- Node.js 18+

### 1. Deploy Infrastructure

```bash
cd terraform/environments/dev
terraform init
terraform plan
terraform apply
```

### 2. Configure kubectl

```bash
aws eks update-kubeconfig --region eu-west-1 --name car-booking-dev
```

### 3. Deploy Applications

```bash
# Using ArgoCD (GitOps)
kubectl apply -f k8s-manifests/argocd/
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
- **GitHub Actions**: CI/CD pipelines
- **Prometheus**: Metrics collection
- **Grafana**: Observability dashboards
- **Kustomize**: Kubernetes configuration management

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

## 🚀 CI/CD Pipeline

1. **Code Push** → GitHub repository
2. **Build** → Docker images (GitHub Actions)
3. **Test** → Automated testing
4. **Push** → ECR registry
5. **Deploy** → ArgoCD sync (GitOps)
6. **Monitor** → Prometheus/Grafana

## 📝 Documentation

- [Infrastructure Setup](docs/infrastructure.md)
- [Application Deployment](docs/deployment.md)
- [Monitoring Guide](docs/monitoring.md)
- [Troubleshooting](docs/troubleshooting.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Live Demo**: Coming soon
- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/forevertux/car-booking/issues)

---

**Built with ❤️ for learning cloud-native technologies**