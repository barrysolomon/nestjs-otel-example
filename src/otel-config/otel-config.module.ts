import { Module } from '@nestjs/common';
import { OtelConfigController } from './otel-config.controller';
import { OtelConfigService } from './otel-config.service';
import { OtelUiController } from './otel-ui.controller';

@Module({
  controllers: [OtelConfigController, OtelUiController],
  providers: [OtelConfigService],
  exports: [OtelConfigService],
})
export class OtelConfigModule {} 