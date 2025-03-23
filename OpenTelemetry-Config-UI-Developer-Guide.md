# OpenTelemetry Configuration UI - Developer Guide

This guide explains the implementation details of the OpenTelemetry Configuration UI, which allows dynamic switching between different OpenTelemetry collectors without restarting the application.

## Architecture Overview

The implementation consists of several key components:

1. **Frontend UI**: A simple HTML/CSS/JavaScript interface for collector configuration
2. **Backend API**: NestJS controllers and services to handle configuration updates
3. **OpenTelemetry Integration**: Modifications to the OpenTelemetry initialization to support dynamic reconfiguration

## Key Components

### 1. OpenTelemetry Configuration Service

Located at: `src/otel-config/otel-config.service.ts`

This service manages the collector configuration and handles updates:

```typescript
@Injectable()
export class OtelConfigService {
  private config = {
    collectorType: 'sawmills', // Default collector
    testMode: process.env.NODE_ENV !== 'production', // Don't actually reconnect in test/dev mode
    collectors: {
      sawmills: {
        tracesEndpoint: 'http://sawmills-collector.sawmills.svc.cluster.local:4318/v1/traces',
        // ... other endpoints
      },
      otel: {
        tracesEndpoint: 'http://otel-collector.observability.svc.cluster.local:4318/v1/traces',
        // ... other endpoints
      },
      custom: {
        tracesEndpoint: '',
        logsEndpoint: '',
        metricsEndpoint: '',
      }
    }
  };

  // Get current configuration
  getConfig() {
    return this.config;
  }

  // Update configuration
  async updateConfig(configUpdate) {
    // Update collector type and endpoints
    // Update environment variables
    // Restart OpenTelemetry SDK if not in test mode
  }

  // Restart the OpenTelemetry SDK with new configuration
  private async restartOtelSdk() {
    // Shutdown existing SDK
    // Reinitialize with new configuration
  }
}
```

### 2. API Controller

Located at: `src/otel-config/otel-config.controller.ts`

Exposes REST endpoints for retrieving and updating the configuration:

```typescript
@Controller('api/otel-config')
export class OtelConfigController {
  constructor(private readonly otelConfigService: OtelConfigService) {}

  @Get()
  getConfig() {
    return this.otelConfigService.getConfig();
  }

  @Post()
  updateConfig(@Body() config: {
    collectorType: string;
    tracesEndpoint?: string;
    logsEndpoint?: string;
    metricsEndpoint?: string;
    testMode?: boolean;
  }) {
    return this.otelConfigService.updateConfig(config);
  }
}
```

### 3. UI Controller

Located at: `src/otel-config/otel-ui.controller.ts`

Serves the HTML UI for configuring OpenTelemetry:

```typescript
@Controller('otel-config')
export class OtelUiController {
  @Get()
  getConfigUi(@Res() res: Response) {
    res.sendFile(path.join(__dirname, '../../public/otel-config.html'));
  }
}
```

### 4. Module Registration

Located at: `src/otel-config/otel-config.module.ts`

Registers the controllers and services with NestJS:

```typescript
@Module({
  controllers: [OtelConfigController, OtelUiController],
  providers: [OtelConfigService],
  exports: [OtelConfigService],
})
export class OtelConfigModule {}
```

### 5. Frontend HTML/JavaScript

Located at: `public/otel-config.html`

User interface for configuring OpenTelemetry:
- Radio buttons to select collector type
- Input fields for custom collector endpoints
- Checkbox for test mode
- JavaScript to handle form submission and API calls

### 6. OpenTelemetry Initialization

Located at: `src/otel-config.ts`

Modified to support reinitializing the OpenTelemetry SDK:

```typescript
export async function reinitializeOpenTelemetry() {
  // Shut down existing providers
  if (meterProvider) {
    await meterProvider.shutdown();
  }
  if (loggerProvider) {
    await loggerProvider.shutdown();
  }
  if (sdk) {
    await sdk.shutdown();
  }

  // Initialize with current environment variables
  return initializeOpenTelemetry();
}
```

## Implementation Details

### Environment Variable-Based Configuration

The system uses environment variables to configure the OpenTelemetry exporters:

1. `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`: URL for the traces exporter
2. `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`: URL for the logs exporter
3. `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`: URL for the metrics exporter

When the configuration is updated, the service:
1. Updates these environment variables
2. Shuts down the existing OpenTelemetry SDK
3. Reinitializes with the new configuration

### Test Mode

Test mode allows configuration changes without restarting the OpenTelemetry SDK, useful for:
- Testing the UI without affecting telemetry collection
- Using the UI in environments where the collectors aren't accessible
- Preventing connection errors during development

### Error Handling

The implementation includes robust error handling:
- Graceful shutdown of existing providers
- Try/catch blocks around critical operations
- Proper error reporting in the UI and API responses
- Fallback to test mode if actual reconnection fails

## Extending the Implementation

### Adding a New Collector Type

To add a new collector type:

1. Update the `collectors` object in `OtelConfigService`:

```typescript
private config = {
  // ... existing code
  collectors: {
    // ... existing collectors
    newCollectorType: {
      tracesEndpoint: 'http://new-collector:4318/v1/traces',
      logsEndpoint: 'http://new-collector:4318/v1/logs',
      metricsEndpoint: 'http://new-collector:4317/v1/metrics',
    }
  }
};
```

2. Add the new option to the HTML UI:

```html
<div>
  <input type="radio" id="newCollectorType" name="collectorType" value="newCollectorType">
  <label for="newCollectorType">New Collector Type</label>
</div>
```

### Adding Configuration Parameters

To add new configuration parameters:

1. Update the `config` object in `OtelConfigService`
2. Modify the `updateConfig` method to handle the new parameters
3. Update the UI with new input fields
4. Add the parameters to the API controller's input type

### Persisting Configuration

The current implementation stores configuration in memory. To add persistence:

1. Create a repository service to store configuration (database, ConfigMap, etc.)
2. Modify `OtelConfigService` to load from and save to the repository
3. Add initialization code to load from the repository at startup

## Deployment Considerations

### Kubernetes Configuration

For Kubernetes deployments:
- Use environment variables in the pod spec for default configuration
- Consider using ConfigMaps for pre-defined collector configurations
- Ensure network policies allow communication to collector endpoints

### Security Considerations

- Consider adding authentication to the configuration API
- Validate input parameters to prevent injection attacks
- Restrict access to the configuration UI in production environments

## Troubleshooting

### Common Errors

1. **OTLP Exporter Error**: Often occurs when collector endpoints are unreachable
   - Solution: Enable test mode or verify endpoints are accessible

2. **SDK Shutdown Timeout**: Can occur if there are pending operations during shutdown
   - Solution: Implement timeout handling in the shutdown process

3. **Environment Variable Issues**: Problems with syntax or missing variables
   - Solution: Validate environment variables before applying changes

### Logging

The implementation includes logging to help with troubleshooting:
- Service startup and shutdown events
- Configuration changes
- Error details during initialization and updates

## Future Enhancements

Potential improvements to consider:

1. **Authentication and Authorization**: Add user authentication for configuration changes
2. **Configuration History**: Track and display past configuration changes
3. **Validation**: Add more robust endpoint validation
4. **Telemetry Preview**: Show sample telemetry using the new configuration before applying
5. **A/B Testing**: Support sending telemetry to multiple collectors simultaneously

## Additional Resources

- [OpenTelemetry Environment Variables](https://opentelemetry.io/docs/reference/specification/sdk-environment-variables/)
- [NestJS Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [OpenTelemetry SDK GitHub](https://github.com/open-telemetry/opentelemetry-js) 