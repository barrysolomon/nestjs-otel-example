## NestJS Service with OpenTelemetry and Lumigo Integration

## 1. Install Required Dependencies

Install the required packages for OpenTelemetry and Lumigo.

```bash
sudo npm install @lumigo/opentelemetry @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-metrics-otlp-grpc
```
npm install @opentelemetry/sdk-logs @opentelemetry/api-logs @opentelemetry/otlp-exporter-base
sudo npm install @opentelemetry/exporter-metrics-otlp-http
sudo npm install @opentelemetry/exporter-metrics-otlp-grpc

Install the other required packages.

```bash
sudo npm install @nestjs/common winston pino @nestjs/axios
```

---

## 2. Local Development and Testing

### Build and Run Locally

```bash
sudo npm install
npm run build

export PORT=3001
npm run start:dev
```

### Verify Local Server Health

```bash
curl http://localhost:3001/debug/health
curl http://localhost:3001/debug/env
curl http://localhost:3001/debug/opentelemetry
```

---

## 3. Deploy on Kubernetes

### Create Lumigo Secret

```bash
kubectl create secret generic lumigo-secret \
  --from-literal=api-key='<LUMIGO_API_KEY>' \
  --namespace=default
```

### Deploy the NestJS App

```bash
kubectl apply -f k8s/nestjs-app.yaml -n nestjs
kubectl rollout restart deployment nestjs-app

kubectl port-forward service/nestjs-app-service 3001:80 -n nestjs
```

### Key Considerations for Kubernetes Deployment

Ensure your Kubernetes deployment includes the following environment variables and command settings:

```yaml
env:
  - name: PORT
    value: "3000"
  - name: MY_POD_IP
    valueFrom:
      fieldRef:
        fieldPath: status.podIP
  - name: LUMIGO_MANUAL_INIT
    value: "true"
  - name: LUMIGO_TRACER_TOKEN
    valueFrom:
      secretKeyRef:
        name: lumigo-secret
        key: api-key
  - name: LUMIGO_ENABLE_LOGS
    value: "true"
  - name: LUMIGO_LOG_ENDPOINT
    value: "https://logs-ga.lumigo-tracer-edge.golumigo.com/api/logs?token=<LUMIGO TRACER TOKEN>"
  - name: OTEL_SERVICE_NAME
    value: "SimpleNestedService"
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: "https://ga-otlp.lumigo-tracer-edge.golumigo.com"

command: ["node"]
args: ["-r", "@lumigo/opentelemetry", "dist/main.js"]
```

### Verify k8s NestJS App Health

```bash
curl http://localhost:3001/debug/health
curl http://localhost:3001/debug/env
curl http://localhost:3001/debug/opentelemetry
```

---

## 4. Deploy on AWS ECS

### Push Image to AWS ECR

```bash
aws ecr get-login-password --region <AWS_REGION> | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com
aws ecr create-repository --repository-name nest-opentelemetry-example --region <AWS_REGION>

docker build --platform linux/amd64 -t nest-opentelemetry-example .
docker tag nest-opentelemetry-example:latest <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/nest-opentelemetry-example:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/nest-opentelemetry-example:latest
```

### Register and Create ECS Service

1. Create a new ECS service with your task definition or update an existing service.
2. Ensure the service is running with the proper IAM role that allows ECS to pull the image and send data to Lumigo.

```bash
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

aws ecs create-service \
  --cluster nest-js-ecs-cluster \
  --service-name nest-js-service \
  --task-definition nest-js-task-definition \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<SUBNET_ID>],securityGroups=[<SECURITY_GROUP_ID>],assignPublicIp='ENABLED'}"
```

### Update ECS Service

```bash
aws ecs update-service \
  --region <AWS_REGION> \
  --cluster nest-js-ecs-cluster \
  --service nest-js-service \
  --task-definition nest-js-task-definition \
  --force-new-deployment
```

### Key Considerations for ECS Task Definition

When creating an ECS task, make sure to include the following configurations:

```json
"command": [
    "node",
    "-r",
    "@lumigo/opentelemetry",
    "dist/main"
],
"environment": [
    {"name": "OTEL_SERVICE_NAME", "value": "NestJS-ECS"},
    {"name": "LUMIGO_TRACER_TOKEN", "value": "<LUMIGO_TRACER_TOKEN>"},
    {"name": "LUMIGO_LOG_ENDPOINT", "value": "<LUMIGO_TRACER_TOKEN>"},
    {"name": "LUMIGO_MANUAL_INIT", "value": "true"},
    {"name": "LUMIGO_ENABLE_LOGS", "value": "true"},
    {"name": "OTEL_EXPORTER_OTLP_ENDPOINT", "value": "https://ga-otlp.lumigo-tracer-edge.golumigo.com"}
]
```

### Verify ECS Deployment

After deploying the service on ECS:
- Call the service's API to see if spans are being reported to Lumigo.
- Verify the `activeSpan` is being captured and custom attributes are visible in the traces on Lumigo.

---

This setup ensures that OpenTelemetry is properly initialized with Lumigo in a NestJS environment running on both Kubernetes and AWS ECS. Let me know if you need further clarifications or adjustments!

# OpenTelemetry Collector Monitoring Setup

This repository contains the configuration for monitoring an OpenTelemetry Collector using Prometheus and Grafana in a Kubernetes environment.

## Architecture

The monitoring stack consists of:
- OpenTelemetry Collector: Collects and processes telemetry data
- Prometheus: Scrapes and stores metrics from the OpenTelemetry Collector
- Grafana: Visualizes the metrics through dashboards

## Prerequisites

- Kubernetes cluster
- `kubectl` configured to access your cluster
- Helm (for deploying the monitoring stack)

## Components

### OpenTelemetry Collector

The OpenTelemetry Collector is configured to:
- Receive traces via OTLP (gRPC and HTTP)
- Export traces to a debug exporter
- Expose internal metrics on port 8889

### Prometheus

Prometheus is configured to:
- Scrape metrics from the OpenTelemetry Collector
- Store metrics for visualization
- Expose metrics on port 9090

### Grafana

Grafana is configured to:
- Display OpenTelemetry Collector metrics
- Auto-load dashboards from ConfigMaps
- Expose the UI on port 3000

## Accessing the Monitoring Stack

### Port Forwarding

To access the various components, you'll need to set up port forwarding:

1. OpenTelemetry Collector metrics:
```bash
kubectl port-forward -n observability svc/otel-collector 8889:8889
```

2. Prometheus UI:
```bash
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090
```

3. Grafana UI:
```bash
kubectl port-forward -n observability svc/prometheus-grafana 3000:80
```

### Accessing the UIs

1. Grafana:
   - URL: http://localhost:3000
   - Default credentials:
     - Username: admin
     - Password: prom-operator

2. Prometheus:
   - URL: http://localhost:9090

3. OpenTelemetry Collector metrics:
   - URL: http://localhost:8889/metrics

## Dashboard Configuration

The OpenTelemetry Collector dashboard is configured via a ConfigMap with the following metrics:

1. Spans Received per Second
   - Metric: `rate(otelcol_receiver_accepted_spans[5m])`
   - Shows the rate of spans being received by the collector

2. Memory Usage
   - Metric: `otelcol_process_memory_rss`
   - Displays the RSS memory usage of the collector

3. Average Batch Size
   - Metric: `rate(otelcol_processor_batch_batch_send_size_sum[5m]) / rate(otelcol_processor_batch_batch_send_size_count[5m])`
   - Shows the average number of spans per batch

4. Spans Exported per Second
   - Metric: `rate(otelcol_exporter_sent_spans[5m])`
   - Displays the rate of spans being exported

5. Failed Span Exports per Second
   - Metric: `rate(otelcol_exporter_send_failed_spans[5m])`
   - Shows the rate of failed span exports

6. Batch Timeout Triggers per Second
   - Metric: `rate(otelcol_processor_batch_timeout_trigger_send[5m])`
   - Displays the rate of batch timeouts

7. HTTP Server Average Response Time
   - Metric: `rate(http_server_duration_sum[5m]) / rate(http_server_duration_count[5m])`
   - Shows the average HTTP response time

8. HTTP Server Request Size per Second
   - Metric: `rate(http_server_request_size[5m])`
   - Displays the rate of HTTP request sizes

## Troubleshooting

### Dashboard Not Appearing

If the dashboard is not appearing in Grafana:

1. Check if the ConfigMap has the correct label:
```bash
kubectl get configmap -n observability otel-collector-dashboard -o yaml
```

2. Verify the Grafana pod is running:
```bash
kubectl get pods -n observability -l app.kubernetes.io/name=grafana
```

3. Check Grafana logs:
```bash
kubectl logs -n observability -l app.kubernetes.io/name=grafana
```

### Port Forwarding Issues

If you encounter port forwarding issues:

1. Check if the ports are already in use:
```bash
lsof -i :3000
lsof -i :9090
lsof -i :8889
```

2. Kill any existing port-forward processes:
```bash
pkill -f "kubectl port-forward"
```

3. Verify the services are running:
```bash
kubectl get svc -n observability
```

## Contributing

Feel free to submit issues and enhancement requests!

