# VPC Module for Car Booking System
# Creates a production-ready VPC with public and private subnets across multiple AZs

locals {
  name = "${var.project_name}-${var.environment}"

  vpc_cidr = "10.0.0.0/16"
  azs      = slice(data.aws_availability_zones.available.names, 0, 3)

  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  intra_subnets   = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

################################################################################
# VPC
################################################################################

resource "aws_vpc" "main" {
  cidr_block           = local.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name = "${local.name}-vpc"
    "kubernetes.io/cluster/${local.name}" = "shared"
  })
}

################################################################################
# Internet Gateway
################################################################################

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.tags, {
    Name = "${local.name}-igw"
  })
}

################################################################################
# Public Subnets
################################################################################

resource "aws_subnet" "public" {
  count = length(local.public_subnets)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnets[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.tags, {
    Name = "${local.name}-public-${local.azs[count.index]}"
    Type = "public"
    "kubernetes.io/cluster/${local.name}" = "shared"
    "kubernetes.io/role/elb" = "1"
  })
}

################################################################################
# Private Subnets
################################################################################

resource "aws_subnet" "private" {
  count = length(local.private_subnets)

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = local.azs[count.index]

  tags = merge(local.tags, {
    Name = "${local.name}-private-${local.azs[count.index]}"
    Type = "private"
    "kubernetes.io/cluster/${local.name}" = "shared"
    "kubernetes.io/role/internal-elb" = "1"
  })
}

################################################################################
# Intra Subnets (isolated, no internet access)
################################################################################

resource "aws_subnet" "intra" {
  count = length(local.intra_subnets)

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.intra_subnets[count.index]
  availability_zone = local.azs[count.index]

  tags = merge(local.tags, {
    Name = "${local.name}-intra-${local.azs[count.index]}"
    Type = "intra"
  })
}

################################################################################
# NAT Gateways (one per AZ for high availability)
################################################################################

resource "aws_eip" "nat" {
  count = length(local.private_subnets)

  domain = "vpc"

  depends_on = [aws_internet_gateway.main]

  tags = merge(local.tags, {
    Name = "${local.name}-nat-${local.azs[count.index]}"
  })
}

resource "aws_nat_gateway" "main" {
  count = length(local.private_subnets)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(local.tags, {
    Name = "${local.name}-nat-${local.azs[count.index]}"
  })

  depends_on = [aws_internet_gateway.main]
}

################################################################################
# Route Tables
################################################################################

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.tags, {
    Name = "${local.name}-public-rt"
  })
}

# Private Route Tables (one per AZ)
resource "aws_route_table" "private" {
  count = length(local.private_subnets)

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(local.tags, {
    Name = "${local.name}-private-rt-${local.azs[count.index]}"
  })
}

# Intra Route Table (no internet access)
resource "aws_route_table" "intra" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.tags, {
    Name = "${local.name}-intra-rt"
  })
}

################################################################################
# Route Table Associations
################################################################################

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "intra" {
  count = length(aws_subnet.intra)

  subnet_id      = aws_subnet.intra[count.index].id
  route_table_id = aws_route_table.intra.id
}