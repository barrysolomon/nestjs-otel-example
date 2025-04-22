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

# Print info message
print_info() {
  echo -e "${YELLOW}ℹ $1${NC}"
}

# Print error message
print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# Print status message
print_status() {
  echo -e "${YELLOW}[STATUS]${NC} $1"
}

# Function to list available contexts
list_contexts() {
  kubectl config get-contexts --output=name
}

# Function to switch context
switch_context() {
  local context=$1
  kubectl config use-context "$context"
  print_success "Switched to context: $context"
}

# Function to get current context
get_current_context() {
  kubectl config current-context
}

# Function to check if context exists
context_exists() {
  local context=$1
  kubectl config get-contexts --output=name | grep -q "^$context$"
}

# Function to wait for a resource to be created
wait_for_resource() {
    local resource_type=$1
    local resource_name=$2
    local namespace=$3
    local timeout=${4:-300}
    local interval=${5:-5}

    print_status "Waiting for $resource_type/$resource_name to be created..."
    local start_time=$(date +%s)
    while true; do
        if kubectl get $resource_type $resource_name -n $namespace &> /dev/null; then
            print_success "$resource_type/$resource_name created"
            return 0
        fi
        local current_time=$(date +%s)
        if [ $((current_time - start_time)) -gt $timeout ]; then
            print_error "Timeout waiting for $resource_type/$resource_name to be created"
            return 1
        fi
        sleep $interval
    done
}

# Function to wait for pods to be ready
wait_for_pods() {
    local namespace=$1
    local selector=$2
    local timeout=${3:-300}

    print_status "Waiting for pods with selector '$selector' to be ready in namespace '$namespace'..."
    kubectl wait --for=condition=ready pod -l $selector -n $namespace --timeout=${timeout}s
    print_success "Pods with selector '$selector' are ready"
}

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
  print_error "kubectl is not installed. Please install kubectl first."
  exit 1
fi

# Check if helm is installed
if ! command -v helm &> /dev/null; then
  print_error "helm is not installed. Please install helm first."
  exit 1
fi

# Cluster Selection
print_header "Cluster Selection"
current_context=$(get_current_context)
print_info "Current context: $current_context"

echo -e "\nAvailable contexts:"
contexts=($(list_contexts))
for i in "${!contexts[@]}"; do
  echo "$((i+1)). ${contexts[$i]}"
done

read -p $'\nSelect cluster (press Enter for current context): ' cluster_choice

if [ -z "$cluster_choice" ]; then
  print_info "Using current context: $current_context"
else
  if [[ "$cluster_choice" =~ ^[0-9]+$ ]] && [ "$cluster_choice" -ge 1 ] && [ "$cluster_choice" -le "${#contexts[@]}" ]; then
    selected_context="${contexts[$((cluster_choice-1))]}"
    switch_context "$selected_context"
  else
    print_error "Invalid selection. Using current context: $current_context"
  fi
fi

# Check if the cluster is accessible
if ! kubectl get nodes &> /dev/null; then
  print_error "Cannot access Kubernetes cluster. Please ensure your cluster is running and kubectl is properly configured."
  exit 1
fi

print_header "Creating Namespaces"
kubectl create namespace nestjs --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f -
print_success "Namespaces created"

print_header "Installing Prometheus Operator"
# Add the Prometheus Operator Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Check if Prometheus is already installed
if helm list -n observability --filter "prometheus" | grep -q "prometheus"; then
    print_info "Prometheus Operator is already installed. Updating..."
    helm upgrade prometheus prometheus-community/kube-prometheus-stack \
      --namespace observability \
      --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
      --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
      --set prometheus.prometheusSpec.probeSelectorNilUsesHelmValues=false \
      --set prometheus.prometheusSpec.scrapeConfigSelectorNilUsesHelmValues=false \
      --set prometheus.prometheusSpec.ruleSelectorNilUsesHelmValues=false \
      --set prometheus.prometheusSpec.alerting.alertmanagers[0].namespace=observability \
      --set prometheus.prometheusSpec.alerting.alertmanagers[0].name=prometheus-alertmanager \
      --set prometheus.prometheusSpec.alerting.alertmanagers[0].port=web
    print_success "Prometheus Operator updated"
else
    print_info "Installing Prometheus Operator..."
    helm install prometheus prometheus-community/kube-prometheus-stack \
      --namespace observability \
      --create-namespace \
      --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
      --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
      --set prometheus.prometheusSpec.probeSelectorNilUsesHelmValues=false \
      --set prometheus.prometheusSpec.scrapeConfigSelectorNilUsesHelmValues=false \
      --set prometheus.prometheusSpec.ruleSelectorNilUsesHelmValues=false \
      --set prometheus.prometheusSpec.alerting.alertmanagers[0].namespace=observability \
      --set prometheus.prometheusSpec.alerting.alertmanagers[0].name=prometheus-alertmanager \
      --set prometheus.prometheusSpec.alerting.alertmanagers[0].port=web
    print_success "Prometheus Operator installed"
fi

# Wait for CRDs to be created
print_header "Waiting for Prometheus Operator resources to be created"
wait_for_resource "crd" "servicemonitors.monitoring.coreos.com" "default"
wait_for_resource "crd" "podmonitors.monitoring.coreos.com" "default"
wait_for_resource "crd" "prometheuses.monitoring.coreos.com" "default"
wait_for_resource "crd" "alertmanagers.monitoring.coreos.com" "default"

# Wait for Prometheus Operator pods to be ready
print_header "Waiting for Prometheus Operator pods to be ready"
wait_for_pods "observability" "release=prometheus"
wait_for_pods "observability" "app.kubernetes.io/name=prometheus"
wait_for_pods "observability" "app.kubernetes.io/name=alertmanager"

# Wait for Prometheus to be ready to accept ServiceMonitors
print_header "Waiting for Prometheus to be ready"
wait_for_resource "service" "prometheus-kube-prometheus-prometheus" "observability"
wait_for_pods "observability" "app.kubernetes.io/name=prometheus"

print_success "Prometheus Operator setup complete"

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

print_header "Setting up Grafana Dashboards"
read -p "Do you want to install/update Grafana Dashboards? (y/n): " install_grafana
if [[ "$install_grafana" =~ ^[Yy]$ ]]; then
    print_info "Installing/updating Grafana components..."
    kubectl apply -f k8s/loki-datasource.yaml -n observability
    kubectl apply -f k8s/grafana-dashboards.yaml -n observability
    print_success "Grafana configurations updated"
else
    print_info "Skipping Grafana setup"
fi

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