import { Controller, Get } from '@nestjs/common';

@Controller('phpinfo')
export class PhpInfoController {
  @Get()
  getPhpInfo(): string {
    // For demonstration purposes, we return a simple message
    return 'PHP Info is not available in this NestJS app. Use PHP for this.';
  }
}
