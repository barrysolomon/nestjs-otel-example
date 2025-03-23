# NestJS OpenTelemetry Example

This example demonstrates how to set up OpenTelemetry instrumentation in a NestJS application, with metrics, traces, and logs being collected and visualized in Grafana.

## Prerequisites

- Kubernetes cluster
- kubectl configured to use your cluster
- Helm installed

## Automated Installation

We've created a fully automated deployment script that handles everything for you:

```bash
./deploy-monitoring.sh
```

This will deploy the entire monitoring stack including Prometheus, Grafana, Loki, and the OpenTelemetry Collector. See [README-monitoring.md](README-monitoring.md) for detailed information about the monitoring setup.

## Manual Installation

If you prefer to install components manually:

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

## OpenTelemetry Configuration UI

This application includes a web UI to dynamically configure OpenTelemetry collectors without restarting. It allows you to:

- Switch between multiple collector endpoints
- Configure custom collector endpoints
- Test changes without affecting live telemetry collection

### Accessing the UI

```bash
# If port-forwarding to the application:
kubectl port-forward -n nestjs svc/nestjs-app-service 3001:80
# Then visit http://localhost:3001/otel-config

# If using LoadBalancer:
# Visit http://<your-app-external-ip>/otel-config
```

### Configuration Options

The UI provides three collector configuration options:

1. **Sawmills Collector** (default)
   - Pre-configured with Sawmills collector endpoints

2. **OpenTelemetry Collector**
   - Pre-configured with standard OpenTelemetry collector endpoints

3. **Custom Collector**
   - Configurable endpoints for traces, logs, and metrics
   - Allows connecting to any OTLP-compatible collector

### Test Mode

The UI includes a "Test Mode" option that:
- Stores configuration changes without restarting the OpenTelemetry SDK
- Allows testing the UI without disrupting active telemetry collection
- Provides a safe way to validate settings before applying them

### Using the API Directly

You can also interact with the configuration programmatically:

```bash
# Get current configuration
curl http://localhost:3001/api/otel-config

# Update configuration
curl -X POST -H "Content-Type: application/json" \
  -d '{"collectorType":"otel","testMode":true}' \
  http://localhost:3001/api/otel-config

# Set custom endpoints
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "collectorType":"custom",
    "tracesEndpoint":"http://my-collector:4318/v1/traces",
    "logsEndpoint":"http://my-collector:4318/v1/logs",
    "metricsEndpoint":"http://my-collector:4317/v1/metrics"
  }' \
  http://localhost:3001/api/otel-config
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

### Troubleshooting the OpenTelemetry Configuration UI

If you encounter issues with the configuration UI:

1. Verify the application is accessible:
```bash
curl http://localhost:3001/health
```

2. Check application logs for errors:
```bash
kubectl logs -n nestjs deployment/nestjs-app
```

3. If seeing "OTLP Exporter Error" messages:
   - Enable test mode to prevent actual reconnection attempts
   - Verify the collector endpoints are correct and accessible
   - Check network policies allow communication to the endpoints

4. For UI-specific issues:
   - Check browser console for JavaScript errors
   - Verify the API endpoints are accessible (`/api/otel-config`)
   - Try a different browser or clear cache

## Common Issues and Solutions

1. No data visible in Grafana:
   - Verify the datasource configuration is correct
   - Check that Prometheus is successfully scraping metrics
   - Ensure the OpenTelemetry Collector is running and configured correctly

2. Logs not appearing:
   - Verify Loki is running and accessible
   - Check the OpenTelemetry Collector's Loki exporter configuration
   - Make sure you're using the `otel/opentelemetry-collector-contrib` image which includes the Loki exporter
   - Ensure your application is sending logs to the collector
   - Check that your OpenTelemetry Collector configuration includes the Loki exporter in the logs pipeline

3. Metrics not showing up:
   - Verify Prometheus is configured to scrape the OpenTelemetry Collector
   - Check that your application is properly instrumented
   - Ensure the metrics endpoints are accessible

4. Configuration UI not updating collector:
   - Check if test mode is enabled, which prevents actual reconnection
   - Verify the collector endpoints are correctly formatted (include http:// prefix)
   - Ensure the application has permission to restart the OpenTelemetry SDK

## OpenTelemetry Collector Configuration

The OpenTelemetry Collector needs to be configured with the appropriate exporters for your observability tools:

1. For logs, make sure you:
   - Use the `otel/opentelemetry-collector-contrib` image instead of the base image
   - Include the Loki exporter in your configuration
   - Add Loki to the logs pipeline

Example configuration for logs:
```yaml
# otel-collector-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
  namespace: observability
data:
  config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: "0.0.0.0:4317"
          http:
            endpoint: "0.0.0.0:4318"
      prometheus:
        config:
          scrape_configs:
            - job_name: 'otel-collector'
              static_configs:
                - targets: ['localhost:8888']

    processors:
      batch: {}
      memory_limiter:
        check_interval: 1s
        limit_mib: 1000
        spike_limit_mib: 200

    exporters:
      debug:
        verbosity: detailed
      prometheus:
        endpoint: "0.0.0.0:8889"
      loki:
        endpoint: "http://loki:3100/loki/api/v1/push"

    service:
      telemetry:
        logs:
          level: "debug"
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [debug]
        metrics:
          receivers: [otlp, prometheus]
          processors: [memory_limiter, batch]
          exporters: [prometheus]
        logs:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [debug, loki]
```

```yaml
# otel-collector.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
  namespace: observability
  labels:
    app: otel-collector
spec:
  replicas: 1
  selector:
    matchLabels:
      app: otel-collector
  template:
    metadata:
      labels:
        app: otel-collector
    spec:
      containers:
        - name: otel-collector
          image: otel/opentelemetry-collector-contrib:0.96.0
          ports:
            - containerPort: 4317  # gRPC OTLP port
            - containerPort: 4318  # HTTP OTLP port
            - containerPort: 8889  # Prometheus exporter
          resources:
            requests:
              memory: "1Gi"
              cpu: "200m"
            limits:
              memory: "2Gi"
              cpu: "500m"
          volumeMounts:
            - name: otel-config
              mountPath: /etc/otel/config.yaml
              subPath: config.yaml
          args:
            - "--config=/etc/otel/config.yaml"
            - "--set=service.telemetry.logs.level=debug"
      volumes:
        - name: otel-config
          configMap:
            name: otel-collector-config

---
apiVersion: v1
kind: Service
metadata:
  name: otel-collector
  namespace: observability
spec:
  selector:
    app: otel-collector
  ports:
    - name: otlp-grpc
      port: 4317
      targetPort: 4317
    - name: otlp-http
      port: 4318
      targetPort: 4318
    - name: prometheus
      port: 8889
      targetPort: 8889
```

2. Install Loki for log storage:
```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm install loki grafana/loki-stack -n observability
```

3. Configure Grafana to use both Prometheus and Loki as datasources:
```bash
# Check existing datasources
kubectl get configmap -n observability -l grafana_datasource=1

# Restart Grafana to pick up changes
kubectl rollout restart deployment -n observability prometheus-grafana
```

## Additional Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Grafana Documentation](https://grafana.com/docs/) 