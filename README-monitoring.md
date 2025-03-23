# NestJS OpenTelemetry Monitoring

This repository contains an automated monitoring setup for a NestJS application using OpenTelemetry, Prometheus, Grafana, and Loki.

## Architecture

The monitoring stack consists of the following components:

1. **OpenTelemetry Collector**: Receives telemetry data from the NestJS application and exports it to Prometheus and Loki.
2. **Prometheus**: Stores metrics data and provides a query interface.
3. **Loki**: Stores logs data and provides a query interface.
4. **Grafana**: Provides dashboards for visualizing metrics and logs.

## Dashboards

The following dashboards are automatically provisioned:

1. **NestJS Application Metrics**: Shows API call counts, rates, and endpoint-specific metrics.
2. **Application Logs**: Shows logs from the application with filtering by severity.
3. **OpenTelemetry Collector**: Shows metrics from the OpenTelemetry Collector itself.

## Automated Deployment

### Prerequisites

- Kubernetes cluster
- kubectl configured to access the cluster
- Helm 3

### Deployment

To deploy the entire monitoring stack, run:

```bash
./deploy-monitoring.sh
```

This script will:

1. Create the `observability` namespace if it doesn't exist
2. Add required Helm repositories
3. Deploy Prometheus with Grafana using the kube-prometheus-stack chart
4. Deploy Loki using the loki-stack chart
5. Deploy the OpenTelemetry Collector
6. Configure Grafana datasources for Prometheus and Loki
7. Create a ServiceMonitor for the OpenTelemetry Collector
8. Apply dashboard ConfigMaps
9. Deploy a dashboard provisioner to automatically import dashboards into Grafana

### Accessing Grafana

After the deployment is complete, you can access Grafana by running:

```bash
kubectl port-forward svc/prometheus-grafana -n observability 3000:80
```

Then open http://localhost:3000 in your browser. The script will output the credentials for Grafana.

### Accessing Prometheus

To access Prometheus directly, you can run:

```bash
kubectl port-forward svc/prometheus-kube-prometheus-prometheus -n observability 9090:9090
```

Then open http://localhost:9090 in your browser.

## Troubleshooting

If the dashboards are not automatically provisioned, you can check the logs of the provisioner job:

```bash
kubectl logs job/grafana-dashboard-provisioner -n observability
```

If you encounter issues with the OpenTelemetry Collector, you can check its logs:

```bash
kubectl logs -l app=otel-collector -n observability
```

## Manual Dashboard Import

If you need to manually import the dashboards, you can extract the dashboard JSON files by running:

```bash
kubectl get configmap app-metrics-dashboard -n observability -o jsonpath="{.data['app-metrics-dashboard\.json']}" > app-metrics.json
kubectl get configmap logs-dashboard -n observability -o jsonpath="{.data['logs-dashboard\.json']}" > logs-dashboard.json
kubectl get configmap otel-collector-dashboard -n observability -o jsonpath="{.data['otel-collector-dashboard\.json']}" > otel-collector-dashboard.json
```

Then import them into Grafana through the UI:

1. Go to Dashboards → Import
2. Upload the JSON file or paste its contents
3. Select the Prometheus datasource for metrics dashboards and Loki for logs dashboards
4. Click Import

## Cleaning Up

To remove the monitoring stack, run:

```bash
kubectl delete namespace observability
```

This will delete all the resources created by the deployment script. 