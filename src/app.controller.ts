import { Controller, Header, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { LogService } from './services/log.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly logService: LogService
  ) {}

  @Header('Content-Type', 'text/html')
  @Get()
  getHello(@Query('message') message?: string): string {
    return this.appService.getHello(message);
  }

  @Post()
  handlePost(): string {
    return 'POST request received at /';
  }

  @Get('health')
  getHealth() {
      return {
          status: 'ok',
          timestamp: new Date().toISOString(),
      };
  }

  @Get('log')
  sendLog(@Query('message') message: string, @Query('severity') severity: string): string {
    try {
      const success = this.logService.logMessage(message, severity);
      
      return JSON.stringify({ 
        success, 
        message: success ? 'Log sent successfully' : 'Error processing log'
      });
    } catch (error) {
      return JSON.stringify({ 
        success: false, 
        message: `Error processing log: ${error.message}`
      });
    }
  }
}
