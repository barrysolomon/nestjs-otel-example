import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { HealthController } from './health.controller';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PhpInfoController } from './phpinfo.controller';
import { ExcludeRoutesMiddleware } from './exclude-routes.middleware';
import { useWinston, usePino, pinoLogger, winstonLogger } from './logger.config';
import { DebugController } from './debug.controller';
import { HttpModule } from '@nestjs/axios';
import { APP_FILTER } from '@nestjs/core';

// Our services
import { TraceService } from './services/trace.service';
import { TemplateService } from './services/template.service';
import { LogService } from './services/log.service';
import { QueryParserService } from './services/query-parser.service';

@Module({
  imports: [
    // Conditionally initialize Winston if the flag is true
    ...(useWinston && winstonLogger
      ? [
          WinstonModule.forRoot({
            instance: winstonLogger, // Use the existing instance of winstonLogger
          }),
        ]
      : []),
      HttpModule,
  ],
  controllers: [
    HealthController,
    AppController,
    PhpInfoController,
    DebugController,
  ],
  providers: [
    AppService,
    TraceService,
    TemplateService,
    LogService,
    QueryParserService,
    ...(usePino && pinoLogger
      ? [
          {
            provide: 'PinoLogger',
            useValue: pinoLogger,
          },
        ]
      : []),
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ExcludeRoutesMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
