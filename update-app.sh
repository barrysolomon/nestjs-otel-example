#!/bin/bash
set -e

# Variables
IMAGE_NAME="barrysolomon/nest-opentelemetry-example"
TAG="latest"

echo "Building new Docker image..."
docker build -t $IMAGE_NAME:$TAG .

echo "Pushing Docker image to registry..."
docker push $IMAGE_NAME:$TAG

echo "Restarting the Kubernetes deployment to use the new image..."
kubectl rollout restart deployment nestjs-app -n nestjs

echo "Waiting for rollout to complete..."
kubectl rollout status deployment nestjs-app -n nestjs

echo "Application updated successfully!"
echo "You can now access the updated UI at http://localhost:3000/" 