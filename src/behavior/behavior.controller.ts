import {
  Query,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { BehaviorService } from './behavior.service';
import { CreateWeeklyConfigDto } from './dto/create-weekly-config.dto';
import { EvaluateBehaviorLogDto } from './dto/evaluate-behavior-log.dto';
import { SubmitLogDto } from './dto/submit-log.dto';
import { SubmitWeeklyJournalDto } from './dto/submit-weekly-journal.dto';
import { UpdateWeeklyConfigDto } from './dto/update-weekly-config.dto';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BehaviorController {
  constructor(private readonly behaviorService: BehaviorService) {}

  @Post('logs/submit')
  @Roles(Role.EMPLOYEE)
  submitLog(@Body() dto: SubmitLogDto, @Req() req: any) {
    return this.behaviorService.submitLog(req.user, dto);
  }

  @Get('manager/logs/pending')
  @Roles(Role.MANAGER, Role.ADMIN)
  getPendingLogs(@Req() req: any) {
    return this.behaviorService.getPendingLogsForManager(req.user);
  }

  @Get('logs/history')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  getLogsHistory(@Req() req: any, @Query('logDate') logDate: string, @Query('userId') userId: string) {
    // If employee, force userId to themselves. If manager/admin, they can query specific userId.
    const targetUserId = req.user.role === Role.EMPLOYEE ? req.user.id : (userId || req.user.id);
    return this.behaviorService.getLogsHistory(targetUserId, logDate);
  }

  @Patch('manager/logs/evaluate/:id')
  @Roles(Role.MANAGER, Role.ADMIN)
  evaluateLog(
    @Param('id') id: string,
    @Body() dto: EvaluateBehaviorLogDto,
    @Req() req: any,
  ) {
    return this.behaviorService.evaluateBehaviorLog(id, dto, req.user);
  }

  @Get('reports/summary/weekly/:weekId')
  @Roles(Role.MANAGER, Role.ADMIN)
  getWeeklySummary(@Param('weekId') weekId: string, @Req() req: any) {
    return this.behaviorService.getWeeklySummary(weekId, req.user);
  }

  @Get('admin/weekly-configs')
  @Roles(Role.MANAGER, Role.ADMIN)
  getWeeklyConfigs() {
    return this.behaviorService.getWeeklyConfigs();
  }

  @Post('admin/weekly-configs')
  @Roles(Role.ADMIN)
  createWeeklyConfig(@Body() dto: CreateWeeklyConfigDto) {
    return this.behaviorService.createWeeklyConfig(dto);
  }

  @Patch('admin/weekly-configs/:id')
  @Roles(Role.ADMIN)
  updateWeeklyConfig(@Param('id') id: string, @Body() dto: UpdateWeeklyConfigDto) {
    return this.behaviorService.updateWeeklyConfig(id, dto);
  }

  @Delete('admin/weekly-configs/:id')
  @Roles(Role.ADMIN)
  deleteWeeklyConfig(@Param('id') id: string) {
    return this.behaviorService.deleteWeeklyConfig(id);
  }

  @Get('weekly-configs')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  getWeeklyConfigsForUser() {
    return this.behaviorService.getWeeklyConfigsForUser();
  }

  @Get('weekly-journals')
  @Roles(Role.EMPLOYEE)
  getWeeklyJournals(@Req() req: any, @Query('weekId') weekId: string) {
    return this.behaviorService.getWeeklyJournals(req.user, weekId);
  }

  @Post('weekly-journals/submit')
  @Roles(Role.EMPLOYEE)
  submitWeeklyJournal(@Req() req: any, @Body() dto: SubmitWeeklyJournalDto) {
    return this.behaviorService.submitWeeklyJournal(req.user, dto);
  }
}
