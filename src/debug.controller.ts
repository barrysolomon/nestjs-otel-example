import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { AutoLoggerService } from './services/auto-logger.service';
import { AutoTraceService } from './services/auto-trace.service';
import { OtelConfigService } from './otel-config/otel-config.service';
import { LogService } from './services/log.service';
import { TraceService } from './services/trace.service';

@Controller('debug')
export class DebugController {
    private traceHistory: any[] = [];
    
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
        @Query('limit') limit?: number, 
        @Query('offset') offset?: number,
        @Query('operation') operation?: string,
        @Query('status') status?: string,
        @Query('service') service?: string,
        @Query('minDuration') minDuration?: number,
        @Query('maxDuration') maxDuration?: number,
        @Query('startTime') startTime?: string,
        @Query('endTime') endTime?: string,
        @Query('search') search?: string
    ) {
        try {
            // Get all traces from our local history
            let traces = [...this.traceHistory];
            let filtered = traces.length;
            
            // Apply filters if provided
            if (operation) {
                traces = traces.filter(trace => trace.operation?.includes(operation));
            }
            
            if (status) {
                traces = traces.filter(trace => trace.status === status);
            }
            
            if (service) {
                traces = traces.filter(trace => trace.serviceName?.includes(service));
            }
            
            if (minDuration) {
                traces = traces.filter(trace => trace.durationMs >= minDuration);
            }
            
            if (maxDuration) {
                traces = traces.filter(trace => trace.durationMs <= maxDuration);
            }
            
            if (startTime) {
                const startTimeDate = new Date(startTime);
                traces = traces.filter(trace => new Date(trace.timestamp) >= startTimeDate);
            }
            
            if (endTime) {
                const endTimeDate = new Date(endTime);
                traces = traces.filter(trace => new Date(trace.timestamp) <= endTimeDate);
            }
            
            if (search) {
                traces = traces.filter(trace => 
                    (trace.message && trace.message.includes(search)) ||
                    (trace.operation && trace.operation.includes(search)) ||
                    (trace.traceId && trace.traceId.includes(search))
                );
            }
            
            // Update filtered count
            filtered = traces.length;
            
            // Apply pagination
            if (offset && offset > 0) {
                traces = traces.slice(offset);
            }
            
            if (limit && limit > 0) {
                traces = traces.slice(0, limit);
            }
            
            return {
                total: this.traceHistory.length,
                filtered,
                traces
            };
        } catch (error) {
            console.error('Error retrieving traces:', error);
            return {
                total: 0,
                filtered: 0,
                traces: [],
                error: error.message
            };
        }
    }

    @Get('logs')
    getLogs(
        @Query('service') service?: string,
        @Query('level') level?: string,
        @Query('searchTerm') searchTerm?: string,
        @Query('context') context?: string,
        @Query('since') since?: string,
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
        
        // Filter by time if 'since' parameter is provided
        if (since) {
            try {
                const sinceDate = new Date(since);
                filteredLogs = filteredLogs.filter(log => {
                    if (!log.timestamp) return false;
                    const logDate = new Date(log.timestamp);
                    return logDate >= sinceDate;
                });
            } catch (e) {
                console.error('Invalid date format for since parameter:', since);
            }
        }
        
        // Apply limit
        const limitNum = limit ? parseInt(limit.toString()) : 50;
        // If limit is 0, return all logs
        const limitedLogs = limitNum === 0 ? filteredLogs : filteredLogs.slice(0, limitNum);
        
        return {
            total: logs.length,
            filtered: filteredLogs.length,
            logs: limitedLogs
        };
    }

    @Post('trace')
    recordTrace(@Body() traceData: any) {
        console.log('Trace API called:', traceData);
        try {
            // Extract data from the request
            const operation = traceData.operation || 'manual-trace';
            const message = traceData.message || 'Manual trace';
            const includeError = operation.includes('error');

            // Generate a unique trace ID
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 1000);
            const traceId = `trace_${timestamp.toString(16)}_${Math.random().toString(16).substring(2, 10)}`;
            const spanId = `span_${timestamp.toString(16)}_${Math.random().toString(16).substring(2, 8)}`;

            // Extract custom attributes from the payload
            const attributes = {};
            Object.keys(traceData).forEach(key => {
                if (key !== 'operation' && key !== 'message') {
                    attributes[key] = traceData[key];
                }
            });

            // Create a trace object
            const trace = {
                id: `trace_${timestamp}_${random}`,
                traceId,
                spanId,
                operation,
                message,
                timestamp: new Date().toISOString(),
                durationMs: Math.floor(Math.random() * 190) + 10,
                attributes,
                events: [{
                    name: 'manual.trace',
                    timestamp: new Date().toISOString(),
                    attributes: { source: 'manual' }
                }],
                serviceName: 'nestjs-opentelemetry-example',
                status: includeError ? 'error' : 'success'
            };

            // Store the trace in our history
            this.traceHistory.push(trace);

            // Trim history if needed
            if (this.traceHistory.length > 1000) {
                this.traceHistory = this.traceHistory.slice(0, 1000);
            }

            console.log(`Recorded trace with ID: ${traceId}`);
            return { 
                status: 'success', 
                message: 'Trace recorded successfully',
                traceId: traceId
            };
        } catch (error) {
            console.error('Error recording trace:', error);
            return { 
                status: 'error', 
                message: error.message || 'Unknown error'
            };
        }
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

    @Get('logs/stats')
    getLogStatistics(@Query('since') since?: string) {
        try {
            // Get logs history
            const logs = this.logService.getLogHistory();
            
            // Calculate statistics
            const stats = {
                totalLogs: logs.length,
                storedLogs: logs.length,
                logsPerLevel: { debug: 0, info: 0, warn: 0, error: 0 },
                logsPerContext: {},
                logsPerDay: {},
                statsLastReset: new Date().toISOString()
            };
            
            // Build statistics
            logs.forEach(log => {
                if (log.level) {
                    stats.logsPerLevel[log.level] = 
                    (stats.logsPerLevel[log.level] || 0) + 1;
                }
                
                if (log.context) {
                    stats.logsPerContext[log.context] = 
                    (stats.logsPerContext[log.context] || 0) + 1;
                }
                
                if (log.timestamp) {
                    const day = log.timestamp.split('T')[0]; // YYYY-MM-DD
                    stats.logsPerDay[day] = (stats.logsPerDay[day] || 0) + 1;
                }
            });
            
            // If since parameter is provided, filter the per-day stats
            if (since) {
                try {
                    const sinceDate = new Date(since);
                    const filteredDailyStats = {};
                    
                    Object.entries(stats.logsPerDay).forEach(([day, count]) => {
                        const dayDate = new Date(day);
                        if (dayDate >= sinceDate) {
                            filteredDailyStats[day] = count as number;
                        }
                    });
                    
                    return {
                        ...stats,
                        logsPerDay: filteredDailyStats,
                        filteredSince: sinceDate.toISOString()
                    };
                } catch (e) {
                    console.error('Invalid date format for since parameter:', since);
                    return stats;
                }
            }
            
            return stats;
        } catch (error) {
            console.error('Error getting log statistics:', error);
            return {
                totalLogs: 0,
                storedLogs: 0,
                logsPerLevel: { debug: 0, info: 0, warn: 0, error: 0 },
                logsPerContext: {},
                logsPerDay: {},
                error: error.message || 'Unknown error'
            };
        }
    }
    
    @Post('logs/stats/reset')
    resetLogStatistics() {
        try {
            // Just return current stats as we don't have reset functionality
            return this.getLogStatistics();
        } catch (error) {
            console.error('Error resetting log statistics:', error);
            return {
                status: 'error',
                message: error.message || 'Unknown error'
            };
        }
    }
    
    @Get('traces/stats')
    getTraceStatistics(@Query('since') since?: string) {
        try {
            // Get trace history - use our local traceHistory for simplicity
            const traces = this.traceHistory;
            
            // Calculate statistics
            const stats = {
                totalTraces: traces.length,
                storedTraces: traces.length,
                tracesPerOperation: {},
                tracesPerService: {},
                tracesPerDay: {},
                statsLastReset: new Date().toISOString()
            };
            
            // Build statistics
            traces.forEach(trace => {
                if (trace.operation) {
                    stats.tracesPerOperation[trace.operation] = 
                    (stats.tracesPerOperation[trace.operation] || 0) + 1;
                }
                
                if (trace.serviceName) {
                    stats.tracesPerService[trace.serviceName] = 
                    (stats.tracesPerService[trace.serviceName] || 0) + 1;
                }
                
                if (trace.timestamp) {
                    const day = trace.timestamp.split('T')[0]; // YYYY-MM-DD
                    stats.tracesPerDay[day] = (stats.tracesPerDay[day] || 0) + 1;
                }
            });
            
            // If since parameter is provided, filter the per-day stats
            if (since) {
                try {
                    const sinceDate = new Date(since);
                    const filteredDailyStats = {};
                    
                    Object.entries(stats.tracesPerDay).forEach(([day, count]) => {
                        const dayDate = new Date(day);
                        if (dayDate >= sinceDate) {
                            filteredDailyStats[day] = count as number;
                        }
                    });
                    
                    return {
                        ...stats,
                        tracesPerDay: filteredDailyStats,
                        filteredSince: sinceDate.toISOString()
                    };
                } catch (e) {
                    console.error('Invalid date format for since parameter:', since);
                    return stats;
                }
            }
            
            return stats;
        } catch (error) {
            console.error('Error getting trace statistics:', error);
            return {
                totalTraces: 0,
                storedTraces: 0,
                tracesPerOperation: {},
                tracesPerService: {},
                tracesPerDay: {},
                error: error.message || 'Unknown error'
            };
        }
    }
    
    @Post('traces/stats/reset')
    resetTraceStatistics() {
        try {
            // Just return current stats as there's no actual reset in our implementation
            return this.getTraceStatistics();
        } catch (error) {
            console.error('Error resetting trace statistics:', error);
            return {
                status: 'error',
                message: error.message || 'Unknown error'
            };
        }
    }
}
