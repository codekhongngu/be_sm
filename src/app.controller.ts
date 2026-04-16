import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { BehaviorService } from './behavior/behavior.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly behaviorService: BehaviorService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/db')
  checkDatabase() {
    return this.appService.checkDatabase();
  }

  @Get('api/system-configs')
  getSystemConfigs() {
    return this.behaviorService.getSystemConfigs();
  }

  @Get('api/system-configs/cutoff-time')
  getCutoffTime() {
    return this.behaviorService.getCutoffTime();
  }
}
