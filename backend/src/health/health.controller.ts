import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AppConfigService } from '../config/app-config.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly config: AppConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe.' })
  check() {
    return {
      status: 'ok',
      app: this.config.get('APP_NAME'),
      env: this.config.get('NODE_ENV'),
      timestamp: new Date().toISOString(),
    };
  }
}
