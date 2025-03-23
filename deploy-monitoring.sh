#!/bin/bash
set -e

echo "🚀 Deploying monitoring stack for NestJS OpenTelemetry example..."

# Create observability namespace if it doesn't exist
if ! kubectl get namespace observability &> /dev/null; then
  echo "📁 Creating observability namespace..."
  kubectl create namespace observability
fi

# Add Helm repositories
echo "📦 Adding Helm repositories..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Deploy Prometheus
echo "🔥 Deploying Prometheus..."
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace observability \
  --set prometheus.service.port=9090 \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.serviceMonitorSelector.matchLabels.release=prometheus \
  --set grafana.enabled=true \
  --set grafana.sidecar.dashboards.enabled=true \
  --set grafana.sidecar.dashboards.label=grafana_dashboard \
  --set grafana.sidecar.datasources.enabled=true \
  --set grafana.sidecar.datasources.label=grafana_datasource

# Wait for Prometheus to be ready
echo "⏳ Waiting for Prometheus to be ready..."
kubectl rollout status statefulset/prometheus-prometheus-kube-prometheus-prometheus -n observability

# Deploy Loki
echo "🔥 Deploying Loki..."
helm upgrade --install loki grafana/loki-stack \
  --namespace observability \
  --set loki.persistence.enabled=true \
  --set loki.persistence.size=10Gi \
  --set promtail.enabled=true

# Wait for Loki to be ready
echo "⏳ Waiting for Loki to be ready..."
kubectl rollout status statefulset/loki -n observability

# Deploy OpenTelemetry Collector
echo "🔥 Deploying OpenTelemetry Collector..."
kubectl apply -f k8s/otel-collector.yaml

# Configure Grafana datasources
echo "🔧 Configuring Grafana datasources..."
kubectl apply -f k8s/grafana-datasources.yaml

# Apply ServiceMonitor for OpenTelemetry Collector
echo "🔧 Configuring ServiceMonitor for OpenTelemetry Collector..."
kubectl apply -f k8s/otel-servicemonitor.yaml

# Apply dashboard ConfigMaps
echo "📊 Creating dashboard ConfigMap..."
kubectl apply -f k8s/grafana-dashboards.yaml

# Port-forward Grafana
echo "🔌 Setting up port-forwarding for Grafana..."
GRAFANA_POD=$(kubectl get pods -n observability -l "app.kubernetes.io/name=grafana" -o jsonpath="{.items[0].metadata.name}")
kubectl wait --for=condition=Ready pod/$GRAFANA_POD -n observability --timeout=300s

# Get Grafana admin password
ADMIN_PASSWORD=$(kubectl get secret -n observability prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 --decode)

echo "✅ Monitoring stack deployment completed!"
echo ""
echo "🌐 Access Grafana:"
echo "   - Run: kubectl port-forward svc/prometheus-grafana -n observability 3000:80"
echo "   - URL: http://localhost:3000"
echo "   - Username: admin"
echo "   - Password: $ADMIN_PASSWORD"
echo ""
echo "🔍 Dashboards should appear automatically in Grafana."
echo ""
echo "🌐 Access Prometheus:"
echo "   - Run: kubectl port-forward svc/prometheus-kube-prometheus-prometheus -n observability 9090:9090"
echo "   - URL: http://localhost:9090" 