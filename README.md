# NestJS OpenTelemetry Example

This example demonstrates how to set up OpenTelemetry instrumentation in a NestJS application, with metrics, traces, and logs being collected and visualized in Grafana.

## Prerequisites

- Kubernetes cluster
- kubectl configured to use your cluster
- Helm installed

## Installation

1. Install the OpenTelemetry Operator:
```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update
helm install opentelemetry-operator open-telemetry/opentelemetry-operator -n observability --create-namespace
```

2. Install the observability stack (Prometheus, Grafana, Loki):
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack -n observability
```

3. Deploy the OpenTelemetry Collector:
```bash
kubectl apply -f otel-collector.yaml
```

4. Deploy the example application:
```bash
kubectl apply -f app-deployment.yaml
```

## Accessing the Dashboards

1. Port-forward the Grafana service:
```bash
kubectl port-forward -n observability svc/prometheus-grafana 3000:80
```

2. Access Grafana at http://localhost:3000
   - Default credentials: admin / prom-operator

## Verifying Dashboard Functionality

### 1. Metrics Dashboard

1. Navigate to the Metrics dashboard in Grafana
2. Verify that you see metrics from your NestJS application:
   - HTTP request counts
   - Response times
   - Error rates
   - Custom metrics (if configured)

### 2. Logs Dashboard

1. Navigate to the Logs dashboard in Grafana
2. Select the Loki datasource
3. Use the following query to see your application logs:
```
{service_name="nestjs-app"}
```

### 3. Traces Dashboard

1. Navigate to the Traces dashboard in Grafana
2. Verify that you see:
   - Service map showing your application
   - Trace spans for HTTP requests
   - Latency distributions
   - Error rates

## Testing Log Collection

A test script is included to help verify that logs are being properly collected and stored:

```bash
# Make the script executable
chmod +x test-logs.sh

# Run the test
./test-logs.sh
```

This script will:
1. Send sample INFO and ERROR logs to the OpenTelemetry Collector
2. Verify the logs are stored in Loki
3. Show available labels and query the test logs

## Troubleshooting

If you encounter issues with the dashboards:

1. Check the OpenTelemetry Collector logs:
```bash
kubectl logs -n observability -l app=otel-collector
```

2. Verify Prometheus is scraping metrics:
```bash
kubectl port-forward -n observability svc/prometheus-server 9090:9090
# Then visit http://localhost:9090 and check targets
```

3. Check Grafana datasource configuration:
```bash
kubectl get configmap -n observability -l grafana_datasource=1
```

4. Verify Grafana pod logs:
```bash
kubectl logs -n observability -l app.kubernetes.io/name=grafana
```

## Common Issues and Solutions

1. No data visible in Grafana:
   - Verify the datasource configuration is correct
   - Check that Prometheus is successfully scraping metrics
   - Ensure the OpenTelemetry Collector is running and configured correctly

2. Logs not appearing:
   - Verify Loki is running and accessible
   - Check the OpenTelemetry Collector's Loki exporter configuration
   - Ensure your application is sending logs to the collector

3. Metrics not showing up:
   - Verify Prometheus is configured to scrape the OpenTelemetry Collector
   - Check that your application is properly instrumented
   - Ensure the metrics endpoints are accessible

## Additional Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Grafana Documentation](https://grafana.com/docs/) 