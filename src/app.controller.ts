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
    return res.sendFile(join(process.cwd(), 'src/public/index.html'));
  }

  @Header('Content-Type', 'application/json')
  @Get('trace')
  generateTrace(@Query('message') message?: string, @Query('customTag') customTag?: string, 
                @Query('operation') operation?: string, @Query('event') eventMessage?: string): string {
    return JSON.stringify(this.appService.generateTrace(message, customTag, operation, eventMessage));
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
  postLog(@Body() body: { message: string; level: string; context?: string; metadata?: any }): string {
    try {
      console.log('Received POST log request:', body);
      
      // Map the level parameter to severity for backwards compatibility
      const success = this.logService.logMessage(
        typeof body.metadata === 'object' ? { ...body.metadata, context: body.context, message: body.message } : body.message, 
        body.level
      );
      
      console.log('Log processed with result:', success);
      
      return JSON.stringify({ 
        success, 
        message: success ? 'Log sent successfully' : 'Error processing log'
      });
    } catch (error) {
      console.error('Error in postLog:', error);
      return JSON.stringify({ 
        success: false, 
        message: `Error processing log: ${error.message}`
      });
    }
  }
}
