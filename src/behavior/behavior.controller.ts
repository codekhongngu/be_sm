import {
  Query,
  Res,
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
import { Response } from 'express';
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
import { SaveWeeklyReportDto } from './dto/save-weekly-report.dto';

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
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getLogsHistory(@Req() req: any, @Query('logDate') logDate: string, @Query('userId') userId: string) {
    // If employee, force userId to themselves. If manager/admin, they can query specific userId.
    const targetUserId = req.user.role === Role.EMPLOYEE ? req.user.id : (userId || req.user.id);
    return this.behaviorService.getLogsHistory(targetUserId, logDate);
  }

  @Get('journey/timeline-form-statuses')
  @Roles(Role.EMPLOYEE)
  getJourneyTimelineFormStatuses(
    @Req() req: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.behaviorService.getJourneyTimelineFormStatuses(req.user, { fromDate, toDate });
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

  @Get('manager/journals/approved/export-status')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportApprovedJournalsStatus(
    @Req() req: any,
    @Res() res: Response,
    @Query('reportDate') reportDate: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.behaviorService.exportApprovedJournalsStatusFile(req.user, {
      reportDate,
      unitId,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get('manager/journals/approved/export-forms-2-3-4-5')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportApprovedJournalsForms2345(
    @Req() req: any,
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
    @Query('keyword') keyword?: string,
  ) {
    const file = await this.behaviorService.exportApprovedJournalsForms2345File(req.user, {
      fromDate,
      toDate,
      unitId,
      keyword,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get('manager/journals/approved/export-status-forms-2-3-4-5')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportApprovedJournalsStatusForms2345(
    @Req() req: any,
    @Res() res: Response,
    @Query('reportDate') reportDate: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.behaviorService.exportApprovedJournalsStatusForms2345File(req.user, {
      reportDate,
      unitId,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
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
  getWeeklySummary(
    @Param('weekId') weekId: string,
    @Query('unitId') unitId: string,
    @Req() req: any,
  ) {
    return this.behaviorService.getWeeklySummary(weekId, req.user, unitId);
  }

  @Post('reports/summary/weekly')
  @Roles(Role.MANAGER, Role.ADMIN)
  saveWeeklySummary(@Body() dto: SaveWeeklyReportDto, @Req() req: any) {
    return this.behaviorService.saveWeeklySummary(req.user, dto);
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
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
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
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getManagerWeeklyJournals(
    @Req() req: any,
    @Query('weekId') weekId?: string,
    @Query('status') status?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.behaviorService.getManagerWeeklyJournals(
      req.user,
      weekId,
      status,
      unitId,
    );
  }

  @Get('manager/weekly-journals/export')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportManagerWeeklyJournals(
    @Req() req: any,
    @Res() res: Response,
    @Query('weekId') weekId?: string,
    @Query('status') status?: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.behaviorService.exportManagerWeeklyJournalsFile(
      req.user,
      weekId,
      status,
      unitId,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get('manager/weekly-journals/export-status')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportManagerWeeklyJournalsStatus(
    @Req() req: any,
    @Res() res: Response,
    @Query('weekId') weekId: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.behaviorService.exportManagerWeeklyJournalsStatusFile(req.user, {
      weekId,
      unitId,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
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

  @Patch('admin/system-configs')
  @Roles(Role.ADMIN)
  updateSystemConfigs(@Body() payload: { cutoffHour?: number, cutoffHourManager?: number, disableCrossTimeManager?: boolean, lockedEntryDates?: string[] }) {
    return this.behaviorService.updateSystemConfigs(payload);
  }

  @Patch('admin/system-configs/cutoff-time')
  @Roles(Role.ADMIN)
  updateCutoffTime(@Body('hour') hour: number) {
    return this.behaviorService.updateCutoffTime(hour);
  }
}
