#!/bin/bash
set -e

echo "=== Creating necessary namespaces ==="
kubectl create namespace nestjs --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace observability --dry-run=client -o yaml | kubectl apply -f -

echo "=== Deleting existing resources ==="
# Delete resources in specific order to avoid dependency issues
kubectl delete --ignore-not-found=true -n observability servicemonitor nestjs-app
kubectl delete --ignore-not-found=true -n observability servicemonitor otel-collector
kubectl delete --ignore-not-found=true -n observability servicemonitor loki

kubectl delete --ignore-not-found=true -n observability deployment prometheus-grafana
kubectl delete --ignore-not-found=true -n observability deployment otel-collector
kubectl delete --ignore-not-found=true -n observability deployment loki

kubectl delete --ignore-not-found=true -n observability configmap otel-collector-config
kubectl delete --ignore-not-found=true -n observability configmap nestjs-monitoring-dashboards
kubectl delete --ignore-not-found=true -n observability configmap prometheus-grafana-datasources

kubectl delete --ignore-not-found=true -n nestjs deployment nestjs-app
kubectl delete --ignore-not-found=true -n nestjs service nestjs-app-service

echo "=== Waiting for resources to be deleted ==="
sleep 10

echo "=== Setting up network policies ==="
kubectl apply -f k8s/allow-nestjs-to-otel.yaml
kubectl apply -f k8s/allow-monitoring.yaml

echo "=== Deploying Observability Stack ==="
# Install Prometheus with Helm if not installed
if ! kubectl get deployment -n observability prometheus-kube-prometheus-operator &> /dev/null; then
  echo "Installing Prometheus stack with Helm..."
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
  helm repo update
  helm install prometheus prometheus-community/kube-prometheus-stack \
    --namespace observability \
    --set grafana.enabled=true \
    --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false
fi

# Deploy OpenTelemetry collector
echo "=== Deploying OpenTelemetry Collector ==="
kubectl apply -f k8s/otel-collector-config.yaml
kubectl apply -f k8s/otel-collector-service.yaml
kubectl apply -f k8s/otel-collector-deployment-with-loki.yaml
kubectl apply -f k8s/otel-servicemonitor.yaml

# Deploy Loki
echo "=== Deploying Loki ==="
kubectl apply -f k8s/loki-deployment.yaml
kubectl apply -f k8s/loki-servicemonitor.yaml

# Configure Grafana
echo "=== Configuring Grafana ==="
kubectl apply -f k8s/grafana-datasources.yaml
kubectl apply -f k8s/grafana-dashboards.yaml

# Deploy NestJS application
echo "=== Deploying NestJS Application ==="
kubectl apply -f k8s/nestjs-app.yaml
kubectl apply -f k8s/nestjs-app-servicemonitor.yaml

echo "=== Setup Complete ==="
echo "Waiting for pods to be ready..."
kubectl wait --for=condition=Ready pod -l app=otel-collector -n observability --timeout=120s
kubectl wait --for=condition=Ready pod -l app=nestjs-app -n nestjs --timeout=120s

echo "=== Port forwarding setup ==="
echo "Run these commands in separate terminals to access services:"
echo "kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090"
echo "kubectl port-forward -n observability svc/prometheus-grafana 3000:80"
echo "kubectl port-forward -n nestjs svc/nestjs-app-service 3000:80"
echo "kubectl port-forward -n observability svc/otel-collector 8889:8889" 