#!/bin/bash

# Create a directory with timestamp
BACKUP_DIR="k8s-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Consolidated export function
export_resource_group() {
  local ns=$1
  local resource_type=$2
  local label_selector=$3
  local output_file=$4
  
  echo "  Exporting $resource_type from namespace $ns to $output_file..."
  
  # Add separator/header
  echo "# $resource_type in namespace $ns" > "$output_file"
  echo "---" >> "$output_file"
  
  # Get resources and append to file
  kubectl get "$resource_type" -n "$ns" $label_selector -o yaml | sed '/^---$/d' >> "$output_file"
  
  # Add status message
  echo "    Exported $(kubectl get "$resource_type" -n "$ns" $label_selector --no-headers | wc -l | tr -d ' ') resources"
}

# Export namespaces
echo "Exporting namespaces..."
kubectl get namespace observability nestjs -o yaml > "$BACKUP_DIR/namespaces.yaml"

# Export NestJS application
echo "Exporting NestJS application..."
kubectl get all -n nestjs -o yaml > "$BACKUP_DIR/nestjs-app.yaml"

# Export OpenTelemetry collector resources
echo "Exporting OpenTelemetry collector resources..."
kubectl get deploy,svc,cm,servicemonitor -n observability -l app=otel-collector -o yaml > "$BACKUP_DIR/otel-collector.yaml"

# Export configmaps related to OTEL
kubectl get cm -n observability -l app=otel-collector -o yaml > "$BACKUP_DIR/otel-collector-configmaps.yaml" 2>/dev/null

# Export Prometheus resources
echo "Exporting Prometheus resources..."
kubectl get deploy,svc,statefulset -n observability -l app.kubernetes.io/name=prometheus -o yaml > "$BACKUP_DIR/prometheus.yaml"

# Export Prometheus CRs
kubectl get prometheuses -n observability -o yaml > "$BACKUP_DIR/prometheus-custom-resources.yaml" 2>/dev/null

# Export ServiceMonitors (consolidated)
echo "Exporting Service Monitors..."
kubectl get servicemonitor -A -o yaml > "$BACKUP_DIR/servicemonitors.yaml"

# Export Grafana resources
echo "Exporting Grafana resources..."
kubectl get deploy,svc -n observability -l app.kubernetes.io/name=grafana -o yaml > "$BACKUP_DIR/grafana.yaml"

# Export Grafana dashboards and datasources
DASHBOARD_CMS=$(kubectl get cm -A -l grafana_dashboard=true -o name 2>/dev/null)
if [ -n "$DASHBOARD_CMS" ]; then
  echo "  Exporting Grafana dashboards..."
  echo "# Grafana Dashboards" > "$BACKUP_DIR/grafana-dashboards.yaml"
  echo "---" >> "$BACKUP_DIR/grafana-dashboards.yaml"
  
  for cm in $DASHBOARD_CMS; do
    kubectl get "$cm" -o yaml | sed '/^---$/d' >> "$BACKUP_DIR/grafana-dashboards.yaml"
    echo "---" >> "$BACKUP_DIR/grafana-dashboards.yaml"
  done
  echo "    Exported $(echo "$DASHBOARD_CMS" | wc -l | tr -d ' ') dashboards"
fi

# Export Grafana datasources
DATASOURCE_CMS=$(kubectl get cm -A -l grafana_datasource=true -o name 2>/dev/null)
if [ -n "$DATASOURCE_CMS" ]; then
  echo "  Exporting Grafana datasources..."
  echo "# Grafana Datasources" > "$BACKUP_DIR/grafana-datasources.yaml"
  echo "---" >> "$BACKUP_DIR/grafana-datasources.yaml"
  
  for cm in $DATASOURCE_CMS; do
    kubectl get "$cm" -o yaml | sed '/^---$/d' >> "$BACKUP_DIR/grafana-datasources.yaml"
    echo "---" >> "$BACKUP_DIR/grafana-datasources.yaml"
  done
  echo "    Exported $(echo "$DATASOURCE_CMS" | wc -l | tr -d ' ') datasources"
else
  # Try to find datasource configmaps by name convention
  GRAFANA_NS=$(kubectl get pods -A -l app.kubernetes.io/name=grafana -o jsonpath='{.items[0].metadata.namespace}' 2>/dev/null)
  DS_CMS=$(kubectl get cm -n "$GRAFANA_NS" | grep -i datasource | awk '{print $1}' 2>/dev/null)
  
  if [ -n "$DS_CMS" ]; then
    echo "  Exporting potential Grafana datasources..."
    echo "# Grafana Datasources" > "$BACKUP_DIR/grafana-datasources.yaml"
    echo "---" >> "$BACKUP_DIR/grafana-datasources.yaml"
    
    for cm in $DS_CMS; do
      kubectl get cm "$cm" -n "$GRAFANA_NS" -o yaml | sed '/^---$/d' >> "$BACKUP_DIR/grafana-datasources.yaml"
      echo "---" >> "$BACKUP_DIR/grafana-datasources.yaml"
    done
    echo "    Exported $(echo "$DS_CMS" | wc -l | tr -d ' ') potential datasources"
  fi
fi

echo "Backup completed successfully in directory: $BACKUP_DIR"
echo "Created $(find "$BACKUP_DIR" -type f | wc -l | tr -d ' ') files"
echo "You can use this backup with: kubectl apply -f $BACKUP_DIR" 