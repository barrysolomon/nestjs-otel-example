## NestJS Service with OpenTelemetry and Lumigo Integration

## 1. Install Required Dependencies

Install the required packages for OpenTelemetry and Lumigo.

```bash
sudo npm install @lumigo/opentelemetry @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

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
- Call the service’s API to see if spans are being reported to Lumigo.
- Verify the `activeSpan` is being captured and custom attributes are visible in the traces on Lumigo.

---

This setup ensures that OpenTelemetry is properly initialized with Lumigo in a NestJS environment running on both Kubernetes and AWS ECS. Let me know if you need further clarifications or adjustments!

