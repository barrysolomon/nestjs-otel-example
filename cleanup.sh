#!/bin/bash
set -e

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print section header
print_header() {
  echo -e "\n${BLUE}==== $1 ====${NC}"
}

# Print success message
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Print warning message
print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Confirm action
confirm() {
  read -p "$(echo -e ${YELLOW}"$1 [y/N] "${NC})" -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]]
}

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
  echo "kubectl is not installed. Please install kubectl first."
  exit 1
fi

# Check if the cluster is accessible
if ! kubectl get nodes &> /dev/null; then
  echo "Cannot access Kubernetes cluster. Please ensure your cluster is running and kubectl is properly configured."
  exit 1
fi

print_warning "This script will remove all resources created by the install.sh script."
if ! confirm "Are you sure you want to proceed?"; then
  echo "Cleanup aborted."
  exit 0
fi

print_header "Terminating Port Forwarding Processes"
pkill -f "kubectl port-forward" || true
print_success "Port forwarding processes terminated"

print_header "Removing NestJS Application"
kubectl delete -f k8s/nestjs-app.yaml --ignore-not-found=true
print_success "NestJS application removed"

print_header "Removing OpenTelemetry Collector"
kubectl delete -f k8s/otel-collector-servicemonitor.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/otel-collector-service.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/otel-collector-deployment.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/otel-collector-config.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/otel-collector-deployment-with-loki.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/otel-collector-config-with-loki.yaml --ignore-not-found=true -n observability
print_success "OpenTelemetry Collector removed"

print_header "Removing Grafana"
kubectl delete -f k8s/logs-dashboard.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/app-metrics-dashboard.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/otel-collector-dashboard.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/grafana-dashboard-configmap.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/loki-datasource.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/grafana.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/grafana-config.yaml --ignore-not-found=true -n observability
kubectl delete -f k8s/grafana-pv.yaml --ignore-not-found=true -n observability
print_success "Grafana removed"

print_header "Removing Network Policies"
kubectl delete -f k8s/allow-nestjs-to-otel.yaml --ignore-not-found=true
kubectl delete -f k8s/allow-monitoring.yaml --ignore-not-found=true
print_success "Network policies removed"

if confirm "Do you want to delete the nestjs and observability namespaces as well?"; then
  print_header "Removing Namespaces"
  kubectl delete namespace nestjs --ignore-not-found=true
  kubectl delete namespace observability --ignore-not-found=true
  print_success "Namespaces removed"
else
  print_warning "Namespaces 'nestjs' and 'observability' were preserved"
fi

print_success "Cleanup complete!" 