helm repo add lumigo https://lumigo-io.github.io/lumigo-kubernetes-operator && \
helm repo update && \
echo "
cluster:
  name: nestjs
lumigoToken:
  value: t_f8f7b905da964eef89261
monitoredNamespaces:
  - namespace: nestjs
    loggingEnabled: true
    tracingEnabled: true
" | helm upgrade -i lumigo lumigo/lumigo-operator --namespace lumigo-system --create-namespace --values -