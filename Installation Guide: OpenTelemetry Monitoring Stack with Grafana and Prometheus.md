# Installation Guide: OpenTelemetry Monitoring Stack with Grafana and Prometheus

This guide walks through installing the complete OpenTelemetry monitoring stack for Kubernetes, including validation steps.

## Prerequisites

- Kubernetes cluster with kubectl configured
- Helm (for Prometheus installation)
- Network access to your cluster

## 1. Create the Observability Namespace

```bash
kubectl create namespace observability
```

Validation:
```bash
kubectl get namespace observability
```

## 2. Install Prometheus Stack

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack --namespace observability
```

Validation:
```bash
kubectl get pods -n observability
```
Expected: Prometheus, Alertmanager, and Grafana pods running.

## 3. Deploy the OpenTelemetry Collector

```bash
kubectl apply -f k8s/otel-collector-config.yaml
kubectl apply -f k8s/otel-collector-deployment.yaml
kubectl apply -f k8s/otel-collector-service.yaml
```

Validation:
```bash
kubectl get pods -n observability -l app=otel-collector
kubectl get svc -n observability otel-collector
```
Expected: OpenTelemetry Collector pod running and service available.

## 4. Configure ServiceMonitor for the OpenTelemetry Collector

```bash
kubectl apply -f k8s/otel-collector-servicemonitor.yaml
```

Validation:
```bash
kubectl get servicemonitor -n observability otel-collector
```
Expected: ServiceMonitor resource created.

## 5. Apply Grafana Dashboards

```bash
kubectl apply -f k8s/grafana-dashboard-configmap.yaml
kubectl apply -f k8s/otel-collector-dashboard.yaml
```

Validation:
```bash
kubectl get configmap -n observability -l grafana_dashboard=1
```
Expected: ConfigMaps with Grafana dashboards listed.

## 6. Create Persistent Storage for Grafana (Optional)

```bash
kubectl apply -f k8s/grafana-pv.yaml
```

Validation:
```bash
kubectl get pv grafana-pv
kubectl get pvc -n observability grafana-pvc
```
Expected: PV created and PVC bound.

## 7. Set Up Network Policies

```bash
kubectl apply -f k8s/allow-monitoring.yaml
kubectl apply -f k8s/allow-nestjs-to-otel.yaml
```

Validation:
```bash
kubectl get networkpolicy -A
```
Expected: Network policies created.

## 8. Deploy the NestJS Application

```bash
kubectl apply -f k8s/nestjs-app.yaml
```

Validation:
```bash
kubectl get pods -n nestjs
kubectl get svc -n nestjs
```
Expected: NestJS application pod running and service available.

## 9. Using the OpenTelemetry Configuration UI

The application includes a web-based configuration UI that allows you to dynamically switch between different OpenTelemetry collectors without restarting the application.

### Accessing the Configuration UI

Access the OpenTelemetry Configuration UI by navigating to:

```bash
# If using port-forwarding
kubectl port-forward -n nestjs svc/nestjs-app-service 3001:80
# Then open http://localhost:3001/otel-config in your browser

# If using LoadBalancer
NESTJS_IP=$(kubectl get svc -n nestjs nestjs-app-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
# Then open http://$NESTJS_IP/otel-config in your browser
```

### Available Configuration Options

The UI allows you to:

1. **Choose a collector type**:
   - Sawmills Collector (default)
   - OpenTelemetry Collector
   - Custom Collector (define your own endpoints)

2. **Enable Test Mode**:
   - When enabled, configuration changes are saved but the OpenTelemetry SDK is not restarted
   - Useful for testing without affecting the actual telemetry pipeline

3. **Configure Custom Endpoints** (for Custom Collector):
   - Traces endpoint (e.g., `http://custom-collector:4318/v1/traces`)
   - Logs endpoint (e.g., `http://custom-collector:4318/v1/logs`)
   - Metrics endpoint (e.g., `http://custom-collector:4317/v1/metrics`)

### Testing the Configuration UI

1. **Using the Web UI**:
   - Open the configuration page in your browser
   - Switch between different collector types
   - Check the "Current Configuration" section to see the active settings
   - Apply changes and verify that the status message shows successful update

2. **Using the API Directly**:
   ```bash
   # Get current configuration
   curl http://localhost:3001/api/otel-config
   
   # Switch to OpenTelemetry Collector with test mode enabled
   curl -X POST -H "Content-Type: application/json" \
     -d '{"collectorType":"otel","testMode":true}' \
     http://localhost:3001/api/otel-config
   
   # Configure custom collector endpoints
   curl -X POST -H "Content-Type: application/json" \
     -d '{
       "collectorType":"custom",
       "tracesEndpoint":"http://custom-collector:4318/v1/traces",
       "logsEndpoint":"http://custom-collector:4318/v1/logs",
       "metricsEndpoint":"http://custom-collector:4317/v1/metrics"
     }' \
     http://localhost:3001/api/otel-config
   ```

### Validating Configuration Changes

After changing the collector configuration:

1. Check the pod logs to see if the configuration was applied:
   ```bash
   kubectl logs -n nestjs deployment/nestjs-app
   ```
   Look for messages like "Test mode enabled, skipping OpenTelemetry SDK restart" or "OpenTelemetry SDK started successfully".

2. Generate some telemetry by making requests to the application:
   ```bash
   # Make several requests to generate telemetry
   for i in {1..10}; do curl http://localhost:3001/ -s > /dev/null && echo "Request $i complete"; sleep 1; done
   ```

3. Check the metrics and traces in Grafana to verify telemetry is flowing to the selected collector.

## 10. Verify End-to-End Integration

### Check if Prometheus is Scraping the OpenTelemetry Collector
```bash
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090
```
Open http://localhost:9090/targets in your browser and verify the otel-collector target is up.

### Check if Dashboards are Available in Grafana
```bash
kubectl port-forward -n observability svc/prometheus-grafana 3000:80
```
Open http://localhost:3000 in your browser (default credentials: admin/prom-operator).
Navigate to Dashboards and look for "OpenTelemetry Collector Dashboard" and "OpenTelemetry / Collector".

### Verify NestJS Application Sending Telemetry
```bash
kubectl port-forward -n nestjs svc/nestjs-app-service 3000:80
```
Open http://localhost:3000 in your browser and interact with the application.
Then check the Grafana dashboards to see telemetry data from your application.

## 11. Sending Data Using curl Commands

Set up port-forwarding to the OpenTelemetry Collector:
```bash
kubectl port-forward -n observability svc/otel-collector 4318:4318
```

### Send Trace Data
```bash
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "resourceSpans": [
      {
        "resource": {
          "attributes": [
            {
              "key": "service.name",
              "value": { "stringValue": "curl-test" }
            }
          ]
        },
        "scopeSpans": [
          {
            "scope": {
              "name": "curl-test"
            },
            "spans": [
              {
                "traceId": "01020304050607080102030405060708",
                "spanId": "0102030405060708",
                "name": "TestSpan",
                "kind": 1,
                "startTimeUnixNano": "'$(echo $(($(date +%s) * 1000000000)))'",
                "endTimeUnixNano": "'$(echo $(($(date +%s) * 1000000000 + 1000000)))'",
                "attributes": [
                  {
                    "key": "test.attribute",
                    "value": { "stringValue": "test-value" }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }'
```

### Send Metrics Data
```bash
curl -X POST http://localhost:4318/v1/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "resourceMetrics": [
      {
        "resource": {
          "attributes": [
            {
              "key": "service.name",
              "value": { "stringValue": "curl-test" }
            }
          ]
        },
        "scopeMetrics": [
          {
            "scope": {
              "name": "curl-test"
            },
            "metrics": [
              {
                "name": "test.counter",
                "description": "Test counter metric",
                "unit": "1",
                "sum": {
                  "dataPoints": [
                    {
                      "attributes": [],
                      "startTimeUnixNano": "'$(echo $(($(date +%s) * 1000000000 - 60000000000)))'",
                      "timeUnixNano": "'$(echo $(($(date +%s) * 1000000000)))'",
                      "asDouble": 42.0
                    }
                  ],
                  "aggregationTemporality": 1,
                  "isMonotonic": true
                }
              }
            ]
          }
        ]
      }
    ]
  }'
```

### Send Logs Data
```bash
curl -X POST http://localhost:4318/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "resourceLogs": [
      {
        "resource": {
          "attributes": [
            {
              "key": "service.name",
              "value": { "stringValue": "curl-test" }
            }
          ]
        },
        "scopeLogs": [
          {
            "scope": {
              "name": "curl-test"
            },
            "logRecords": [
              {
                "timeUnixNano": "'$(echo $(($(date +%s) * 1000000000)))'",
                "severityNumber": 9,
                "severityText": "INFO",
                "body": {
                  "stringValue": "This is a test log message sent via curl"
                },
                "attributes": [
                  {
                    "key": "event.domain",
                    "value": { "stringValue": "test" }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }'
```

### Send a Simple HTTP Request to the NestJS App

```bash
# Get the external IP if using LoadBalancer
NESTJS_URL=$(kubectl get svc -n nestjs nestjs-app-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Or use port-forwarding
kubectl port-forward -n nestjs svc/nestjs-app-service 3001:80

# Send a request
curl http://localhost:3001
```

Validation:
After sending these requests, check the Grafana dashboards to see the incoming data reflected in the metrics, particularly in the "Spans Received per Second" panel.

## Troubleshooting

If dashboards aren't showing up:
1. Check ConfigMap labels: `kubectl get configmap -n observability -l grafana_dashboard=1`
2. Check Grafana sidecar logs: `kubectl logs -n observability -l app.kubernetes.io/name=grafana -c grafana-sc-dashboard`
3. Restart Grafana if needed: `kubectl rollout restart deployment -n observability prometheus-grafana`

If metrics aren't showing:
1. Check ServiceMonitor: `kubectl describe servicemonitor -n observability otel-collector`
2. Check OTEL collector logs: `kubectl logs -n observability -l app=otel-collector`
3. Verify Prometheus targets: Look for the otel-collector endpoint at http://localhost:9090/targets

If the OpenTelemetry Configuration UI is not working:
1. Check if the service is accessible: `curl http://localhost:3001/health`
2. Check the application logs: `kubectl logs -n nestjs deployment/nestjs-app`
3. If you see OTLP exporter errors, enable test mode to prevent actual reconnection attempts
4. Verify that the required endpoints are correctly set in the k8s/nestjs-app.yaml file
