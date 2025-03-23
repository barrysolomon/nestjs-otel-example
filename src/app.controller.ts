import { Controller, Header, Get, Post, Query, Body, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { LogService } from './services/log.service';
import { Response } from 'express';
import { join } from 'path';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly logService: LogService
  ) {}

  @Get()
  getIndex(@Res() res: Response) {
    return res.sendFile(join(process.cwd(), 'public/index.html'));
  }

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

  @Post('log')
  postLog(@Body() body: { message: string; severity: string }): string {
    try {
      const success = this.logService.logMessage(body.message, body.severity);
      
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
