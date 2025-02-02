import { Controller, Header, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Header('Content-Type', 'text/html')
  @Get()
  getHello(): string {
    return this.appService.getHello();
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
  
}
