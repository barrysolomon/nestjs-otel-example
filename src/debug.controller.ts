import { Controller, Get, Post, Body } from '@nestjs/common';
import { AutoLoggerService } from './services/auto-logger.service';
import { OtelConfigService } from './otel-config/otel-config.service';

@Controller('debug')
export class DebugController {
    private failedMetrics: any[] = [];

    constructor(
        private readonly autoLoggerService: AutoLoggerService,
        private readonly otelConfigService: OtelConfigService
    ) {}

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
    
    @Get('autolog/start')
    startAutoLogging() {
        this.autoLoggerService.startLogGeneration();
        return {
            status: 'success',
            message: 'Auto logging started',
            timestamp: new Date().toISOString()
        };
    }

    @Get('autolog/stop')
    stopAutoLogging() {
        this.autoLoggerService.stopLogGeneration();
        return {
            status: 'success',
            message: 'Auto logging stopped',
            timestamp: new Date().toISOString()
        };
    }
}
