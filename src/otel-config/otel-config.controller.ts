import { Controller, Get, Post, Body } from '@nestjs/common';
import { OtelConfigService } from './otel-config.service';

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