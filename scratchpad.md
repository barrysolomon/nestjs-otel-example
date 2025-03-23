
kubectl port-forward -n observability svc/otel-collector 8889:8889


===============================
Installation
===============================

Based on the files I've examined, here's the recommended order for rebuilding your Kubernetes cluster:

1. **Create the observability namespace**:
   ```bash
   kubectl create namespace observability
   ```

2. Apply the PV and PVC for Grafana:
   ```bash
   kubectl apply -f k8s/grafana-pv.yaml
   ```

2. **Deploy Prometheus and Grafana using Helm**:
   This seems to be the base of your monitoring stack. You should install the kube-prometheus-stack:
   ```bash
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm repo update
   helm install prometheus prometheus-community/kube-prometheus-stack -n observability
   ```

3. **Deploy Loki**:
   ```bash
   kubectl apply -f k8s/loki-deployment.yaml
   ```

4. **Deploy OpenTelemetry Collector**:
   ```bash
   # Apply the config first
   kubectl apply -f k8s/otel-collector-config-with-loki.yaml

   # Then apply the deployment
   kubectl apply -f k8s/otel-collector-deployment-with-loki.yaml

   # Apply the service
   kubectl apply -f k8s/otel-collector-service.yaml
   
   # Apply the ServiceMonitor (for Prometheus to discover the collector)
   kubectl apply -f k8s/otel-collector-servicemonitor.yaml
   ```

5. **Configure Grafana Dashboards and Datasources**:
   ```bash
   # Apply Loki as a datasource
   kubectl apply -f k8s/loki-datasource.yaml

   # Apply the dashboards
   kubectl apply -f k8s/grafana-dashboards.yaml
   ```

6. **Deploy the NestJS application**:
   ```bash
   kubectl apply -f k8s/nestjs-app.yaml
   ```

7. **Apply Network Policies** (if needed):
   ```bash
   kubectl apply -f k8s/allow-monitoring.yaml
   kubectl apply -f k8s/allow-nestjs-to-otel.yaml
   ```

kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090

kubectl port-forward service/nestjs-app-service 3000:80 -n nestjs
kubectl port-forward -n observability svc/prometheus-grafana 3001:80

for i in {1..100}; do curl http://localhost:3001 -s > /dev/null && echo "API call $i complete"; done


This order ensures that:
1. The monitoring infrastructure (Prometheus, Grafana) is set up first
2. Loki is deployed for log collection
3. The OpenTelemetry Collector is properly configured and discoverable
4. Grafana is configured with the necessary datasources and dashboards
5. Finally, the application is deployed to start generating telemetry data

Make sure to check the status of each deployment before proceeding to the next step to ensure everything is running properly.


--------------
NESTJS APP
--------------


rm -rf dist node_modules
npm install --legacy-peer-deps
npm run build

export PORT=3000
npm run start:dev


docker build -t nest-opentelemetry-example:latest .
docker tag nest-opentelemetry-example:latest barrysolomon/nest-opentelemetry-example:latest
docker push barrysolomon/nest-opentelemetry-example:latest

k delete -f k8s/nestjs-app.yaml  -n nestjs
k apply -f k8s/nestjs-app.yaml  -n nestjs

kubectl rollout restart deployment nestjs-app -n nestjs



# NestJS Application (access your app at http://localhost:3001)
kubectl port-forward service/nestjs-app-service 3000:80 -n nestjs


for i in {1..10}; do curl http://localhost:3001 -s > /dev/null && echo "API call $i complete"; sleep 1; done
for i in {1..100}; do curl http://localhost:3001 -s > /dev/null && echo "API call $i complete"; done
for i in {1..1000}; do curl http://localhost:3001 -s > /dev/null && echo "API call $i complete"; done



--------------
OTEL COLLECTOR
--------------

k create namespace observability

k apply -f k8s/otel-collector-config-with-loki.yaml   -n observability
k apply -f k8s/otel-collector-deployment-with-loki.yaml   -n observability
k apply -f k8s/otel-collector-service.yaml   -n observability



k delete -f k8s/otel-collector.yaml   -n observability
k apply -f k8s/otel-collector.yaml   -n observability
k apply -f k8s/otel-collector-deployment-with-loki.yaml   -n observability


--------------
PROMETHEUS
--------------

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts && helm repo update
kubectl create namespace observability 2>/dev/null || true && helm install prometheus prometheus-community/kube-prometheus-stack --namespace observability --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false

kubectl get crd | grep servicemonitors

# Prometheus (query metrics at http://localhost:9090)
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090


----------------------------
OTEL collector service monitor
----------------------------

kubectl apply -f k8s/otel-collector-servicemonitor.yaml -n observability

kubectl get pods -n observability | grep otel

kubectl get servicemonitor -n observability otel-collector -o yaml

# Verify service has the correct port configured:
kubectl get service -n observability otel-collector -o yaml

# Verify that the metrics port is properly configured in the OTEL collector:
## The metrics endpoint is properly configured if 0.0.0.0:8888 is in the telemetry section.
kubectl get configmap otel-collector-config -n observability -o yaml

# Verify Prometheus is detecting the OpenTelemetry collector:
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090 & sleep 2 && echo "Visit http://localhost:9090/targets to check if your OTEL collector is being monitored"


LOKI

helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack -n observability


--------------
GRAFANA
--------------

k apply -f k8s/grafana-pv.yaml   -n observability


k apply -f k8s/grafana-dashboard-configmap.yaml   -n observability
k apply -f k8s/logs-dashboard.yaml   -n observability
k apply -f k8s/app-metrics-dashboard-simple.yaml   -n observability
kubectl apply -f k8s/app-metrics-dashboard.yaml -n observability && kubectl apply -f k8s/logs-dashboard.yaml -n observability


# Grafana (access dashboards at http://localhost:3000, default credentials admin/prom-operator)
kubectl port-forward -n observability svc/prometheus-grafana 3000:80

The dashboards are created by multiple YAML files that work together:
The main dashboard ConfigMaps:
k8s/app-metrics-dashboard.yaml - Creates metrics dashboard for the application
k8s/logs-dashboard.yaml - Creates logs dashboard
k8s/grafana-dashboard-configmap.yaml - Creates OpenTelemetry collector dashboard
The dashboard provisioner:
k8s/grafana-dashboard-provisioner.yaml - Contains the Job that automatically imports dashboards into Grafana
The process works like this:
Dashboard definitions are stored as ConfigMaps with the grafana_datasource: "1" label
The dashboard provisioner runs as a Job and uses the Grafana API to automatically import these dashboards


--------------
--------------
--------------






# NestJS Application (access your app at http://localhost:3001)
kubectl port-forward service/nestjs-app-service 3001:80 -n nestjs

# Prometheus (query metrics at http://localhost:9090)
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090

# Grafana (access dashboards at http://localhost:3000, default credentials admin/prom-operator)
kubectl port-forward -n observability svc/prometheus-grafana 3000:80



# OpenTelemetry Collector (for direct access to OTLP endpoints)
kubectl port-forward -n observability svc/otel-collector 4318:4318  # HTTP OTLP endpoint
kubectl port-forward -n observability svc/otel-collector 4317:4317  # gRPC OTLP endpoint
kubectl port-forward -n observability svc/otel-collector 8889:8889  # Prometheus metrics endpoint



Now let's port-forward to the OTEL collector metrics endpoint to test it directly:
kubectl port-forward -n observability svc/otel-collector 8888:8888

Now let's check if we can access the metrics endpoint:
curl -s http://localhost:8888/metrics | head -20



curl -X POST http://198.19.249.2:4318/v1/traces -H "Content-Type: application/json" -d '{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"test-service"}}]},"scopeSpans":[{"scope":{"name":"test-scope"},"spans":[{"traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b7","parentSpanId":"","name":"test-span","kind":1,"startTimeUnixNano":"1742333472000000000","endTimeUnixNano":"1742333473000000000","attributes":[{"key":"test.attribute","value":{"stringValue":"test-value"}}],"status":{"code":0}}]}]}]}'


curl -v -X POST http://198.19.249.2:4318/v1/traces -H "Content-Type: application/json" -d '{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"test-service"}}]},"scopeSpans":[{"scope":{"name":"test-instrumentation"},"spans":[{"traceId":"5b8aa5a2d2c872e8321cf37308d69df2","spanId":"051581bf3cb55c13","name":"TestSpan","kind":1,"startTimeUnixNano":"1742388669000000000","endTimeUnixNano":"1742388669000000000","attributes":[{"key":"test.key","value":{"stringValue":"test value"}}],"status":{"code":1,"message":"OK"}}]}]}]}'




k apply -f k8s/otel-collector-ingress.yaml
k delete -f k8s/otel-collector-ingress.yaml

k get pods -n ingress-nginx
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx && helm repo update && helm install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace




Test Connectivity from Another Pod
kubectl run debug --rm -it --image=busybox -- /bin/sh
nc -zv otel-collector.default.svc.cluster.local 4317


Check Network Policies
kubectl get networkpolicy -A
kubectl describe networkpolicy <policy-name> -n default

Look for rules blocking egress to port 4317. If needed, allow traffic:

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-otel
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: otel-collector
  ingress:
    - from: []
      ports:
        - protocol: TCP
          port: 4317

kubectl apply -f allow-otel.yaml


Check DNS Resolution
kubectl exec -it nestjs-app-7dcdc77b5c-892lz -- nslookup otel-collector.default.svc.cluster.local

==============
GRAFANA
==============

helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm install loki-stack grafana/loki-stack --namespace logging --create-namespace \
  --set grafana.enabled=true \
  --set loki.enabled=true \
  --set promtail.enabled=true \
  --set tempo.enabled=true

helm upgrade --install loki-stack grafana/loki-stack --namespace logging --create-namespace \
  --set grafana.enabled=true \
  --set loki.enabled=true \
  --set promtail.enabled=true \
  --set tempo.enabled=true

helm upgrade --install tempo grafana/tempo --namespace logging --create-namespace


kubectl port-forward svc/loki-stack-grafana -n logging 3000:80

kubectl get secret --namespace logging loki-stack-grafana -o jsonpath="{.data.admin-password}" | base64 --decode; echo
VUdB26krQW1rSIMP91NtYcT6UDe9l8yAdCMZN3eW

kubectl patch secret loki-stack-grafana -n logging -p '{"data":{"admin-password":"'$(echo -n "newpassword" | base64)'"}}'
helm upgrade loki-stack grafana/loki-stack --namespace logging \
  --set adminPassword="mynewpassword"

kubectl rollout restart statefulset loki-stack -n logging
kubectl rollout restart deployment loki-stack-grafana -n logging

kubectl get pods -n logging
kubectl get svc -n logging

kubectl delete pod busybox -n logging
kubectl run busybox --image=busybox --restart=Never -it --rm --namespace logging -- /bin/sh

kubectl run debug-busybox --image=busybox --restart=Never -it --rm --namespace logging -- /bin/sh


wget -qO- http://192.168.194.23:3100/ready
wget -qO- http://loki-stack-grafana.logging.svc:80
nslookup loki-stack.logging.svc
nslookup loki-stack.logging.svc.local

wget -qO- http://192.168.194.254:3100/ready
wget -qO- http://loki-stack.logging.svc:3100/ready

wget -qO- http://192.168.194.254:3100/loki/api/v1/labels
wget -qO- http://loki-stack.logging.svc:3100/loki/api/v1/labels
wget -qO- http://192.168.194.254:3100/loki/api/v1/labels



wget -qO- http://loki-stack.logging.svc:3100/loki/api/v1/push
wget -qO- http://loki-stack.logging.svc:3100/loki/api/v1/labels


2️⃣ Add Loki as a Data Source (For Logs)
Go to Configuration → Data Sources.
  Click "Add data source".
  Select Loki.
  Enter Loki URL:
  http://loki-stack.logging.svc.cluster.local:3100

Click Save & Test.
3️⃣ Add Tempo as a Data Source (For Traces)
Go to Configuration → Data Sources.
Click "Add data source".
Select Tempo.
Enter Tempo URL:
arduino
Copy
Edit
http://tempo.logging.svc:3100
Click Save & Test.





================
Jaeger
================

k create namespace observability

helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
helm repo update

helm install jaeger jaegertracing/jaeger -n observability -f k8s/jaeger-values.yaml
helm upgrade --install jaeger jaegertracing/jaeger -n observability -f k8s/jaeger-values.yaml

or

helm install jaeger jaegertracing/jaeger \
  --set allInOne.enabled=false \
  --set agent.enabled=true \
  --set collector.enabled=true \
  --set query.enabled=true \
  --set storage.type=elasticsearch \
  --set storage.elasticsearch.host="elasticsearch"

kubectl patch svc jaeger-query -p '{"spec": {"type": "LoadBalancer"}}'

helm upgrade jaeger jaegertracing/jaeger \
  --namespace observability \
  --set collector.otlp.enabled=true \
  --set collector.otlp.grpc.host-port="4317" \
  --set collector.otlp.http.host-port="4318"


  export POD_NAME=$(kubectl get pods --namespace observability -l "app.kubernetes.io/instance=jaeger,app.kubernetes.io/component=query" -o jsonpath="{.items[0].metadata.name}")
  echo http://127.0.0.1:8080/
  kubectl port-forward --namespace observability $POD_NAME 8080:16686



kubectl get pods -n observability
kubectl get svc -n observability

kubectl exec -it nestjs-app-6fbd6b4685-vbrld -n nestjs-otel -- curl -v http://jaeger-collector.observability.svc:4317
kubectl exec -it nestjs-app-6fbd6b4685-vbrld -n nestjs-otel -- curl -v http://jaeger-collector.observability.svc:4318
kubectl exec -it nestjs-app-6fbd6b4685-vbrld -n nestjs-otel -- curl -v http://jaeger-collector.observability.svc:14268



--------------------------------
ECS Deploy
--------------------------------


aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 139457818185.dkr.ecr.us-east-1.amazonaws.com
aws ecr create-repository --repository-name nest-opentelemetry-example --region us-east-1


docker build --platform linux/amd64 -t nest-opentelemetry-example .
docker tag nest-opentelemetry-example:latest 139457818185.dkr.ecr.us-east-1.amazonaws.com/nest-opentelemetry-example:latest
docker push 139457818185.dkr.ecr.us-east-1.amazonaws.com/nest-opentelemetry-example:latest



aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

aws ecs update-service \
  --region us-east-1 \
  --cluster nest-js-ecs-cluster \
  --service nest-js-service \
  --task-definition nest-js-task-definition \
  --force-new-deployment


docker manifest inspect 139457818185.dkr.ecr.us-east-1.amazonaws.com/nest-opentelemetry-example:latest

aws ecr describe-images \
  --repository-name nest-opentelemetry-example \
  --image-ids imageTag=latest \
  --region us-east-1



Check Server Health/Env

    curl http://localhost:3001/debug/health
    curl http://localhost:3001/debug/env
    curl http://localhost:3001/debug/opentelemetry


kubectl logs -n nestjs $(kubectl get pods -n nestjs -o jsonpath='{.items[0].metadata.name}') --tail=100

