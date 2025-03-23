import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { AutoLoggerService } from './services/auto-logger.service';
import { AutoTraceService } from './services/auto-trace.service';
import { OtelConfigService } from './otel-config/otel-config.service';
import { LogService } from './services/log.service';
import { TraceService } from './services/trace.service';

@Controller('debug')
export class DebugController {
    constructor(
        private readonly autoLoggerService: AutoLoggerService,
        private readonly autoTraceService: AutoTraceService,
        private readonly otelConfigService: OtelConfigService,
        private readonly logService: LogService,
        private readonly traceService: TraceService
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
        console.log('📥 Received failed metrics:', data.failedMetrics);
        return { status: 'received', storedMetrics: data.failedMetrics.length };
    }
    
    @Get('autolog/status')
    getAutoLogStatus() {
        return {
            running: this.autoLoggerService.isRunning(),
            interval: this.autoLoggerService.getInterval(),
            timestamp: new Date().toISOString()
        };
    }
    
    @Get('autolog/start')
    startAutoLogging(@Query('interval') intervalMs?: string) {
        const interval = intervalMs ? parseInt(intervalMs) : undefined;
        this.autoLoggerService.startLogGeneration(interval);
        return {
            status: 'success',
            message: 'Auto logging started',
            interval: this.autoLoggerService.getInterval(),
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

    @Get('autotrace/status')
    getAutoTraceStatus() {
        return {
            running: this.autoTraceService.isRunning(),
            interval: this.autoTraceService.getInterval(),
            timestamp: new Date().toISOString()
        };
    }
    
    @Get('autotrace/start')
    startAutoTracing(@Query('interval') intervalMs?: string) {
        const interval = intervalMs ? parseInt(intervalMs) : undefined;
        this.autoTraceService.startTraceGeneration(interval);
        return {
            status: 'success',
            message: 'Auto trace generation started',
            interval: this.autoTraceService.getInterval(),
            timestamp: new Date().toISOString()
        };
    }

    @Get('autotrace/stop')
    stopAutoTracing() {
        this.autoTraceService.stopTraceGeneration();
        return {
            status: 'success',
            message: 'Auto trace generation stopped',
            timestamp: new Date().toISOString()
        };
    }

    @Get('traces')
    getTraces(
        @Query('service') service?: string, 
        @Query('operation') operation?: string,
        @Query('minDuration') minDuration?: number,
        @Query('maxDuration') maxDuration?: number,
        @Query('tags') tags?: string,
        @Query('limit') limit?: number
    ) {
        // Get trace history from trace service
        const traces = this.traceService.getTraceHistory();
        
        let filteredTraces = [...traces];
        
        // Apply filters
        if (service) {
            filteredTraces = filteredTraces.filter(trace => 
                trace.serviceName?.toLowerCase().includes(service.toLowerCase()));
        }
        
        if (operation) {
            filteredTraces = filteredTraces.filter(trace => 
                trace.operation?.toLowerCase().includes(operation.toLowerCase()));
        }
        
        if (minDuration) {
            filteredTraces = filteredTraces.filter(trace => 
                trace.durationMs >= minDuration);
        }
        
        if (maxDuration) {
            filteredTraces = filteredTraces.filter(trace => 
                trace.durationMs <= maxDuration);
        }
        
        if (tags) {
            const [tagKey, tagValue] = tags.split('=');
            filteredTraces = filteredTraces.filter(trace => {
                if (!trace.attributes) return false;
                try {
                    const attrs = typeof trace.attributes === 'string' ? 
                        JSON.parse(trace.attributes) : trace.attributes;
                    return attrs[tagKey] === tagValue;
                } catch (e) {
                    return false;
                }
            });
        }
        
        // Apply limit
        const limitNum = limit ? parseInt(limit.toString()) : 50;
        filteredTraces = filteredTraces.slice(0, limitNum);
        
        return {
            total: traces.length,
            filtered: filteredTraces.length,
            traces: filteredTraces
        };
    }

    @Get('logs')
    getLogs(
        @Query('service') service?: string,
        @Query('level') level?: string,
        @Query('searchTerm') searchTerm?: string,
        @Query('context') context?: string,
        @Query('limit') limit?: number
    ) {
        // Get logs history from log service
        const logs = this.logService.getLogHistory();
        
        let filteredLogs = [...logs];
        
        // Apply filters
        if (service) {
            filteredLogs = filteredLogs.filter(log => 
                log.service?.toLowerCase().includes(service.toLowerCase()));
        }
        
        if (level) {
            filteredLogs = filteredLogs.filter(log => 
                log.level?.toLowerCase() === level.toLowerCase());
        }
        
        if (searchTerm) {
            filteredLogs = filteredLogs.filter(log => {
                const message = typeof log.message === 'string' ? log.message : JSON.stringify(log.message);
                return message.toLowerCase().includes(searchTerm.toLowerCase());
            });
        }
        
        if (context) {
            filteredLogs = filteredLogs.filter(log => 
                log.context?.toLowerCase().includes(context.toLowerCase()));
        }
        
        // Apply limit
        const limitNum = limit ? parseInt(limit.toString()) : 50;
        filteredLogs = filteredLogs.slice(0, limitNum);
        
        return {
            total: logs.length,
            filtered: filteredLogs.length,
            logs: filteredLogs
        };
    }

    @Post('trace')
    recordTrace(@Body() traceData: any) {
        // Instead of storing locally, delegate to the TraceService
        const result = this.traceService.storeTrace(
            null, // No span available
            traceData.message || 'External trace', 
            traceData.operation || 'external-operation'
        );
        
        return { status: 'recorded', traceId: result.traceId };
    }

    @Post('log')
    recordLog(@Body() logData: any) {
        // Instead of storing locally, delegate to the LogService
        this.logService.logMessage({
            ...logData,
            timestamp: new Date().toISOString()
        }, logData.level || 'info');
        
        return { status: 'recorded' };
    }
}
