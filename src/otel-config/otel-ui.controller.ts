import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';

@Controller('otel-config')
export class OtelUiController {
  @Get()
  getConfigUi(@Res() res: Response) {
    res.sendFile(path.join(__dirname, '../../public/otel-config.html'));
  }
} 