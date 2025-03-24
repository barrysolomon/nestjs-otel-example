To uninstall the Lumigo Kubernetes Operator and remove all its resources from your cluster, you should run:
Apply to scratchpad.m...
system
This command will remove the Helm release and most of the associated resources.
However, to ensure a complete cleanup, you should also:
Delete the namespace if it's no longer needed:
Apply to scratchpad.m...
system
Check for any Custom Resource Definitions (CRDs) that might have been installed and remove them:
Apply to scratchpad.m...
>
Check for any cluster-wide resources like ClusterRoles or ClusterRoleBindings:
Apply to scratchpad.m...
>
These commands will ensure that all components installed by the Lumigo Kubernetes Operator are removed from your cluster.