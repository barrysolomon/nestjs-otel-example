import { Controller, Get, Post, Body } from '@nestjs/common';

@Controller('debug')
export class DebugController {
    private failedMetrics: any[] = [];

    @Get('env')
    getEnvironment() {
        return process.env;
    }

    @Get('opentelemetry')
    getTelemetryStatus() {
        return {
            endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'Not Set',
            tracingEnabled: !!process.env.OTEL_TRACES_EXPORTER,
            metricsEnabled: !!process.env.OTEL_METRICS_EXPORTER,
        };
    }

    @Post('metrics')
    handleFailedMetrics(@Body() data: any) {
      this.failedMetrics.push(data.failedMetrics);
      console.log('📥 Received failed metrics:', data.failedMetrics);
      return { status: 'received', storedMetrics: this.failedMetrics.length };
    }
    
}
