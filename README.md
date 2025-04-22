# NestJS OpenTelemetry Example

This project demonstrates how to integrate OpenTelemetry with a NestJS application. It shows how to collect and visualize traces, metrics, and logs.

## Features

- NestJS application with OpenTelemetry integration
- Auto-instrumentation for HTTP requests and other operations
- Custom trace generation and sampling
- Structured logging with context
- Kubernetes deployment configuration
- Grafana dashboards for monitoring

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- Docker and Docker Compose (for running with the monitoring stack)
- Kubernetes (for K8s deployment)

### Installation

```bash
# Install dependencies
npm install

# Start the application in development mode
npm run start:dev
```

### Kubernetes Deployment

The application can be deployed to Kubernetes using the configurations in the `k8s` directory:

```bash
# Apply the Kubernetes configurations
kubectl apply -f k8s/
```

## UI Components

The application provides a user interface for interacting with telemetry data:

- **Dashboard** (`/`): Main application dashboard with trace generation tools
- **Traces Explorer** (`/traces.html`): Interface for exploring and filtering traces
- **Logs Viewer** (`/logs.html`): Interface for viewing and searching logs
- **Configuration** (`/otel-config.html`): Configure the OpenTelemetry collector

## OpenTelemetry Configuration

The OpenTelemetry collector can be configured through the UI or by editing the `k8s/otel-collector-config.yaml` file.

Supported collector types:
- **Lumigo**: Preconfigured for Lumigo Collector
- **OpenTelemetry**: Standard OpenTelemetry Collector
- **Custom**: Custom endpoints for traces, logs, and metrics

## Auto-Logging

The application includes an auto-logging service that generates sample logs. You can:

- Start auto-logging: `/debug/autolog/start`
- Stop auto-logging: `/debug/autolog/stop`

## Monitoring Stack

The project includes a Kubernetes-based monitoring stack with:

- OpenTelemetry Collector
- Loki (for logs)
- Tempo (for traces)
- Prometheus (for metrics)
- Grafana (for visualization)

Access Grafana at: http://localhost:3001 (default credentials: admin/prom-operator)

## Project Structure

```
├── src/
│   ├── main.ts                  # Application entry point
│   ├── app.module.ts            # Main application module
│   ├── app.controller.ts        # Main controller
│   ├── tracing/                 # OpenTelemetry setup
│   ├── logging/                 # Logging configuration
│   ├── public/                  # UI files
│   └── debug/                   # Debug controllers and services
├── k8s/                         # Kubernetes configurations
└── docker/                      # Docker configurations
```

## License

This project is licensed under the MIT License - see the LICENSE file for details. 