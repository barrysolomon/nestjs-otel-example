# OpenTelemetry NestJS Demo Installation Guide

This guide will help you set up the complete OpenTelemetry monitoring stack with a NestJS application in a Kubernetes cluster.

## Prerequisites

- A running Kubernetes cluster
- `kubectl` installed and configured to access your cluster
- Sufficient permissions to create namespaces, deployments, services, etc.

## Installation

### Automatic Installation

We provide an automated installation script that sets up everything for you:

```bash
./install.sh
```

This script will:
1. Create necessary namespaces (nestjs, observability)
2. Deploy the OpenTelemetry Collector
3. Configure network policies
4. Set up Grafana with pre-configured dashboards
5. Configure Loki for log collection
6. Deploy the NestJS demo application
7. Set up port forwarding for easy access

### Manual Installation

If you prefer to install components step by step:

1. Create namespaces:
   ```bash
   kubectl create namespace nestjs
   kubectl create namespace observability
   ```

2. Deploy OpenTelemetry Collector:
   ```bash
   kubectl apply -f k8s/otel-collector-config.yaml -n observability
   kubectl apply -f k8s/otel-collector-deployment.yaml -n observability
   kubectl apply -f k8s/otel-collector-service.yaml -n observability
   kubectl apply -f k8s/otel-collector-servicemonitor.yaml -n observability
   ```

3. Apply network policies:
   ```bash
   kubectl apply -f k8s/allow-monitoring.yaml
   kubectl apply -f k8s/allow-nestjs-to-otel.yaml
   ```

4. Set up Grafana:
   ```bash
   kubectl apply -f k8s/grafana-pv.yaml -n observability
   kubectl apply -f k8s/grafana-config.yaml -n observability
   kubectl apply -f k8s/grafana.yaml -n observability
   kubectl apply -f k8s/grafana-dashboard-configmap.yaml -n observability
   kubectl apply -f k8s/otel-collector-dashboard.yaml -n observability
   kubectl apply -f k8s/app-metrics-dashboard.yaml -n observability
   kubectl apply -f k8s/logs-dashboard.yaml -n observability
   kubectl apply -f k8s/loki-datasource.yaml -n observability
   ```

5. Configure Loki for logs:
   ```bash
   kubectl apply -f k8s/otel-collector-config-with-loki.yaml -n observability
   kubectl apply -f k8s/otel-collector-deployment-with-loki.yaml -n observability
   ```

6. Deploy NestJS Application:
   ```bash
   kubectl apply -f k8s/nestjs-app.yaml
   ```

## Accessing the Demo

### NestJS Application

Access the NestJS application UI at: http://localhost:8080

If port forwarding is not set up:
```bash
kubectl port-forward -n nestjs service/nestjs-app-service 8080:80
```

### Grafana Dashboards

Access Grafana at: http://localhost:3000

If port forwarding is not set up:
```bash
kubectl port-forward svc/grafana -n observability 3000:3000
```

Default credentials:
- Username: admin
- Password: admin

## Cleanup

To remove all resources created by this setup:

```bash
./cleanup.sh
```

The cleanup script will guide you through removing all components and optionally deleting the namespaces.

## Troubleshooting

### Check pod status
```bash
kubectl get pods -n nestjs
kubectl get pods -n observability
```

### View logs for the NestJS application
```bash
kubectl logs -n nestjs $(kubectl get pods -n nestjs -o jsonpath='{.items[0].metadata.name}')
```

### View logs for the OpenTelemetry Collector
```bash
kubectl logs -n observability $(kubectl get pods -n observability -l app=otel-collector -o jsonpath='{.items[0].metadata.name}')
```

### Restart deployments if needed
```bash
kubectl rollout restart deployment/nestjs-app -n nestjs
kubectl rollout restart deployment/otel-collector -n observability
``` 