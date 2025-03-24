#!/bin/bash

# Uninstall Lumigo Operator shell script

echo "Starting Lumigo Operator uninstallation process..."

# Uninstall the Helm release
echo "Uninstalling Lumigo Helm release..."
helm uninstall lumigo --namespace lumigo-system

# Find and delete Lumigo CRDs
echo "Checking for Lumigo CRDs..."
LUMIGO_CRDS=$(kubectl get crd | grep lumigo | awk '{print $1}')
if [ -n "$LUMIGO_CRDS" ]; then
  echo "Deleting Lumigo CRDs: $LUMIGO_CRDS"
  kubectl delete crd $LUMIGO_CRDS
else
  echo "No Lumigo CRDs found."
fi

# Find and delete cluster-wide resources
echo "Checking for Lumigo cluster-wide resources..."
LUMIGO_CLUSTER_RESOURCES=$(kubectl get clusterrole,clusterrolebinding | grep lumigo | awk '{print $1}')
if [ -n "$LUMIGO_CLUSTER_RESOURCES" ]; then
  echo "Deleting Lumigo cluster resources: $LUMIGO_CLUSTER_RESOURCES"
  kubectl delete $LUMIGO_CLUSTER_RESOURCES
else
  echo "No Lumigo cluster resources found."
fi

# Delete the namespace
echo "Deleting the lumigo-system namespace..."
kubectl delete namespace lumigo-system

echo "Lumigo Operator uninstallation complete. Verify all resources have been removed." 