import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SubmitManagerDailyScoreDto } from './dto/submit-manager-daily-score.dto';
import { ManagerDailyScoresService } from './manager-daily-scores.service';

@Controller('manager-daily-scores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManagerDailyScoresController {
  constructor(private readonly managerDailyScoresService: ManagerDailyScoresService) {}

  @Get('criteria')
  @Roles(Role.MANAGER, Role.ADMIN)
  getCriteria() {
    return this.managerDailyScoresService.getCriteria();
  }

  @Get('employees')
  @Roles(Role.MANAGER, Role.ADMIN)
  getEmployees(@Req() req: any, @Query('keyword') keyword?: string) {
    return this.managerDailyScoresService.getEmployees(req.user, keyword);
  }

  @Get('entry')
  @Roles(Role.MANAGER, Role.ADMIN)
  getEntry(@Req() req: any, @Query('employeeId') employeeId: string, @Query('scoreDate') scoreDate: string) {
    return this.managerDailyScoresService.getEntry(req.user, employeeId, scoreDate);
  }

  @Post('entry')
  @Roles(Role.MANAGER, Role.ADMIN)
  submitEntry(@Req() req: any, @Body() dto: SubmitManagerDailyScoreDto) {
    return this.managerDailyScoresService.submitEntry(req.user, dto);
  }

  @Get('statistics')
  @Roles(Role.MANAGER, Role.ADMIN)
  getStatistics(
    @Req() req: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.managerDailyScoresService.getStatistics(req.user, {
      fromDate,
      toDate,
      employeeId,
    });
  }

  @Get('statistics/:scoreDate')
  @Roles(Role.MANAGER, Role.ADMIN)
  getStatisticsByDate(@Req() req: any, @Param('scoreDate') scoreDate: string) {
    return this.managerDailyScoresService.getStatistics(req.user, {
      fromDate: scoreDate,
      toDate: scoreDate,
    });
  }
}
