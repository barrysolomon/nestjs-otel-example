#!/bin/bash

# Get the OTEL Collector endpoint
OTEL_ENDPOINT=$(kubectl get svc -n observability otel-collector -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

if [ -z "$OTEL_ENDPOINT" ]; then
  echo "Could not determine OTEL Collector endpoint. Using localhost instead."
  OTEL_ENDPOINT="localhost"
  # Set up port-forwarding if necessary
  kubectl port-forward -n observability svc/otel-collector 4318:4318 &
  PORT_FORWARD_PID=$!
  sleep 2
fi

echo "Sending INFO log to $OTEL_ENDPOINT:4318..."
curl -X POST http://$OTEL_ENDPOINT:4318/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "resourceLogs": [{
      "resource": {
        "attributes": [{
          "key": "service.name",
          "value": { "stringValue": "test-service" }
        }, {
          "key": "service.namespace",
          "value": { "stringValue": "test-namespace" }
        }]
      },
      "scopeLogs": [{
        "scope": {},
        "logRecords": [{
          "timeUnixNano": "'$(date +%s000000000)'",
          "severityNumber": 9,
          "severityText": "INFO",
          "body": {
            "stringValue": "This is a test INFO message"
          },
          "attributes": [{
            "key": "component",
            "value": { "stringValue": "backend" }
          }, {
            "key": "event.domain",
            "value": { "stringValue": "test" }
          }]
        }]
      }]
    }]
  }'

echo -e "\nSending ERROR log to $OTEL_ENDPOINT:4318..."
curl -X POST http://$OTEL_ENDPOINT:4318/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "resourceLogs": [{
      "resource": {
        "attributes": [{
          "key": "service.name",
          "value": { "stringValue": "test-service" }
        }, {
          "key": "service.namespace",
          "value": { "stringValue": "test-namespace" }
        }]
      },
      "scopeLogs": [{
        "scope": {},
        "logRecords": [{
          "timeUnixNano": "'$(date +%s000000000)'",
          "severityNumber": 17,
          "severityText": "ERROR",
          "body": {
            "stringValue": "This is a test ERROR message"
          },
          "attributes": [{
            "key": "component",
            "value": { "stringValue": "backend" }
          }, {
            "key": "event.domain",
            "value": { "stringValue": "test" }
          }, {
            "key": "error.type",
            "value": { "stringValue": "TestError" }
          }]
        }]
      }]
    }]
  }'

echo -e "\nVerifying logs are stored in Loki..."
kubectl port-forward -n observability svc/loki 3100:3100 &
LOKI_PORT_FORWARD_PID=$!
sleep 2

echo -e "\nChecking available labels in Loki:"
curl -s "http://localhost:3100/loki/api/v1/labels" | jq

echo -e "\nQuerying logs from test-service:"
curl -G -s "http://localhost:3100/loki/api/v1/query" --data-urlencode 'query={service_name="test-service"}' | jq

echo -e "\nCleanup..."
# Kill port-forwards if we started them
if [ -n "$PORT_FORWARD_PID" ]; then
  kill $PORT_FORWARD_PID 2>/dev/null || true
fi
if [ -n "$LOKI_PORT_FORWARD_PID" ]; then
  kill $LOKI_PORT_FORWARD_PID 2>/dev/null || true
fi

echo -e "\nDone! Check your Grafana dashboard for logs."
echo "URL: http://localhost:3000/d/your-dashboard-id/application-logs-dashboard" 