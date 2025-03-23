#!/bin/bash
set -e

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print section header
print_header() {
  echo -e "\n${BLUE}==== $1 ====${NC}"
}

# Print success message
print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Print info message
print_info() {
  echo -e "${YELLOW}ℹ $1${NC}"
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

print_header "Creating Namespaces"
kubectl create namespace nestjs --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f -
print_success "Namespaces created"

print_header "Setting up OpenTelemetry Collector"
kubectl apply -f k8s/otel-collector-config.yaml -n observability
kubectl apply -f k8s/otel-collector-deployment.yaml -n observability
kubectl apply -f k8s/otel-collector-service.yaml -n observability
kubectl apply -f k8s/otel-collector-servicemonitor.yaml -n observability
print_success "OpenTelemetry Collector deployed"

print_header "Setting up Network Policies"
kubectl apply -f k8s/allow-monitoring.yaml
kubectl apply -f k8s/allow-nestjs-to-otel.yaml
print_success "Network policies applied"

print_header "Setting up Grafana"
kubectl apply -f k8s/grafana-pv.yaml -n observability
kubectl apply -f k8s/grafana-config.yaml -n observability
kubectl apply -f k8s/grafana.yaml -n observability
kubectl apply -f k8s/grafana-dashboard-configmap.yaml -n observability
kubectl apply -f k8s/otel-collector-dashboard.yaml -n observability
kubectl apply -f k8s/app-metrics-dashboard.yaml -n observability
kubectl apply -f k8s/logs-dashboard.yaml -n observability
kubectl apply -f k8s/app-metrics-dashboard-simple.yaml -n observability
kubectl apply -f k8s/logs-dashboard-simple.yaml -n observability
kubectl apply -f k8s/loki-datasource.yaml -n observability
print_success "Grafana deployed with dashboards"

print_header "Setting up Loki (for logs)"
kubectl apply -f k8s/otel-collector-config-with-loki.yaml -n observability
kubectl apply -f k8s/otel-collector-deployment-with-loki.yaml -n observability
print_success "Loki configuration applied"

print_header "Deploying NestJS Application"
kubectl apply -f k8s/nestjs-app.yaml

print_success "Deployment complete!"

# Wait for pods to be ready
print_header "Waiting for pods to be ready"
kubectl rollout status deployment/nestjs-app -n nestjs
kubectl rollout status deployment/otel-collector -n observability

print_header "Setting up port forwarding"
echo "Setting up port forwarding for the NestJS application..."
echo "Press Ctrl+C to stop port forwarding when you're done"
kubectl port-forward -n nestjs service/nestjs-app-service 8080:80

print_info "You can access the application at http://localhost:8080"
print_info "You can access Grafana at (run in another terminal): kubectl port-forward svc/prometheus-grafana -n observability 3000:80"
print_info "For Grafana, the default credentials are admin/prom-operator" 