import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TraceService } from './services/trace.service';
import { TemplateService } from './services/template.service';
import { LogService } from './services/log.service';
import { QueryParserService } from './services/query-parser.service';
import { trace, context, metrics } from '@opentelemetry/api';

// Mock metrics and trace APIs
jest.mock('@opentelemetry/api', () => {
  const originalModule = jest.requireActual('@opentelemetry/api');
  return {
    ...originalModule,
    trace: {
      ...originalModule.trace,
      getTracer: jest.fn().mockReturnValue({
        startSpan: jest.fn().mockReturnValue({
          end: jest.fn(),
          setAttribute: jest.fn(),
          addEvent: jest.fn(),
          spanContext: jest.fn().mockReturnValue({
            traceId: 'mock-trace-id',
            spanId: 'mock-span-id'
          }),
          attributes: {},
          events: []
        }),
      }),
      getActiveSpan: jest.fn().mockReturnValue({
        setAttribute: jest.fn(),
        spanContext: jest.fn().mockReturnValue({
          traceId: 'mock-trace-id',
          spanId: 'mock-span-id'
        })
      }),
    },
    metrics: {
      ...originalModule.metrics,
      getMeter: jest.fn().mockReturnValue({
        createCounter: jest.fn().mockReturnValue({
          add: jest.fn()
        })
      })
    }
  };
});

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;
  
  // Mock implementations for the services
  const mockTraceService = {
    generateTrace: jest.fn().mockReturnValue({
      spanContext: () => ({ traceId: 'mock-trace-id', spanId: 'mock-span-id' }),
      attributes: {},
      events: []
    }),
    getAttributes: jest.fn().mockReturnValue('{}'),
    getEvents: jest.fn().mockReturnValue('[]')
  };

  const mockTemplateService = {
    generateTraceEditorUI: jest.fn().mockReturnValue('<html></html>')
  };

  const mockLogService = {
    logMessage: jest.fn().mockReturnValue(true),
    getDefaultLogMessage: jest.fn().mockReturnValue('{}')
  };

  const mockQueryParserService = {
    parseQueryParams: jest.fn().mockReturnValue({}),
    extractTraceParams: jest.fn().mockReturnValue({
      message: 'Hello World',
      customTag: 'tag-value',
      operation: 'getHello',
      eventMessage: 'test event',
      interval: 30000,
      autoGenerate: false
    }),
    extractLogParams: jest.fn().mockReturnValue({
      logMessage: '{}',
      logSeverity: 'info'
    })
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: TraceService, useValue: mockTraceService },
        { provide: TemplateService, useValue: mockTemplateService },
        { provide: LogService, useValue: mockLogService },
        { provide: QueryParserService, useValue: mockQueryParserService }
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('should return HTML from the template service', () => {
      const expectedHtml = '<html></html>';
      mockTemplateService.generateTraceEditorUI.mockReturnValue(expectedHtml);
      const spy = jest.spyOn(appService, 'getHello');
      
      const result = appController.getHello();
      
      expect(result).toBe(expectedHtml);
      expect(spy).toHaveBeenCalled();
      expect(mockTraceService.generateTrace).toHaveBeenCalled();
    });
  });
});