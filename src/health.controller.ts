import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  checkHealth(): string {
    return 'OK';  // Or return a JSON object if you prefer { status: 'OK' }
  }
}
