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
import { ReviewDailyFormsDto } from './dto/review-daily-forms.dto';
import { SubmitWeeklyJournalDto } from './dto/submit-weekly-journal.dto';
import { UpsertJourneyPhaseConfigDto } from './dto/upsert-journey-phase-config.dto';
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

  @Patch('manager/journals/review-daily')
  @Roles(Role.MANAGER, Role.ADMIN)
  reviewDailyForms(@Body() dto: ReviewDailyFormsDto, @Req() req: any) {
    return this.behaviorService.reviewDailyForms(req.user, dto);
  }

  @Get('manager/journals/approved')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getApprovedJournals(
    @Req() req: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.behaviorService.getApprovedJournals(req.user, {
      fromDate,
      toDate,
      unitId,
      keyword,
    });
  }

  @Get('reports/journal-submissions')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getJournalSubmissionsStats(
    @Req() req: any,
    @Query('date') date: string,
  ) {
    return this.behaviorService.getJournalSubmissionsStats(req.user, date);
  }

  @Get('reports/summary/weekly/:weekId')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getWeeklySummary(@Param('weekId') weekId: string, @Req() req: any) {
    return this.behaviorService.getWeeklySummary(weekId, req.user);
  }

  @Get('admin/weekly-configs')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
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

  @Get('manager/weekly-journals')
  @Roles(Role.MANAGER, Role.ADMIN)
  getManagerWeeklyJournals(@Req() req: any, @Query('weekId') weekId?: string, @Query('status') status?: string) {
    return this.behaviorService.getManagerWeeklyJournals(req.user, weekId, status);
  }

  @Patch('manager/weekly-journals/review')
  @Roles(Role.MANAGER, Role.ADMIN)
  reviewWeeklyJournal(@Req() req: any, @Body() dto: any) {
    return this.behaviorService.reviewWeeklyJournal(req.user, dto);
  }

  @Get('journey-phase-configs')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getJourneyPhaseConfigs() {
    return this.behaviorService.getJourneyPhaseConfigs();
  }

  @Get('admin/journey-phase-configs')
  @Roles(Role.ADMIN)
  getJourneyPhaseConfigsForAdmin() {
    return this.behaviorService.getJourneyPhaseConfigsForAdmin();
  }

  @Post('admin/journey-phase-configs')
  @Roles(Role.ADMIN)
  createJourneyPhaseConfig(@Body() dto: UpsertJourneyPhaseConfigDto) {
    return this.behaviorService.upsertJourneyPhaseConfig(null, dto);
  }

  @Patch('admin/journey-phase-configs/:id')
  @Roles(Role.ADMIN)
  updateJourneyPhaseConfig(@Param('id') id: string, @Body() dto: UpsertJourneyPhaseConfigDto) {
    return this.behaviorService.upsertJourneyPhaseConfig(id, dto);
  }

  @Get('system-configs/cutoff-time')
  getCutoffTime() {
    return this.behaviorService.getCutoffTime();
  }

  @Patch('admin/system-configs/cutoff-time')
  @Roles(Role.ADMIN)
  updateCutoffTime(@Body('hour') hour: number) {
    return this.behaviorService.updateCutoffTime(hour);
  }
}
