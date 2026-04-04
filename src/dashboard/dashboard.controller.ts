import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @Roles(Role.ADMIN)
  getMetrics() {
    return this.dashboardService.getMetrics();
  }

  @Get('behavior-analytics')
  @Roles(Role.MANAGER, Role.ADMIN)
  getBehaviorAnalytics(
    @Req() req: any,
    @Query('period') period?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.dashboardService.getBehaviorAnalytics(req.user, { period, unitId });
  }
}
