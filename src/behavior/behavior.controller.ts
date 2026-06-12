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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { UpsertCoachingPhaseConfigDto } from './dto/upsert-coaching-phase-config.dto';
import { UpdateWeeklyConfigDto } from './dto/update-weekly-config.dto';
import { SaveWeeklyReportDto } from './dto/save-weekly-report.dto';
import { CreateManagerCoachingLogDto } from './dto/create-manager-coaching-log.dto';
import { UpdateManagerCoachingLogDto } from './dto/update-manager-coaching-log.dto';
import { SaveDailyCoachingCustomerDto } from './dto/save-daily-coaching-customer.dto';

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

  @Get('manager/coaching-logs')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getManagerCoachingLogs(
    @Req() req: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('coachedUserId') coachedUserId?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.behaviorService.getManagerCoachingLogs(req.user, {
      fromDate,
      toDate,
      coachedUserId,
      keyword,
    });
  }

  @Get('manager/coaching-logs/employees')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getManagerCoachingEmployees(@Req() req: any) {
    return this.behaviorService.getManagerCoachingEmployees(req.user);
  }

  @Post('manager/coaching-logs')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  createManagerCoachingLog(@Req() req: any, @Body() dto: CreateManagerCoachingLogDto) {
    return this.behaviorService.createManagerCoachingLog(req.user, dto);
  }

  @Patch('manager/coaching-logs/:id')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  updateManagerCoachingLog(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: UpdateManagerCoachingLogDto,
  ) {
    return this.behaviorService.updateManagerCoachingLog(id, req.user, dto);
  }

  @Delete('manager/coaching-logs/:id')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  deleteManagerCoachingLog(@Param('id') id: string, @Req() req: any) {
    return this.behaviorService.deleteManagerCoachingLog(id, req.user);
  }

  @Get('manager/coaching-logs/export')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportManagerCoachingLogs(
    @Req() req: any,
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('coachedUserId') coachedUserId?: string,
    @Query('keyword') keyword?: string,
  ) {
    const file = await this.behaviorService.exportManagerCoachingLogsFile(req.user, {
      fromDate,
      toDate,
      coachedUserId,
      keyword,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
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

  @Get('coaching-customers')
  @Roles(Role.EMPLOYEE)
  getDailyCoachingCustomers(
    @Req() req: any,
    @Query('logDate') logDate?: string,
    @Query('coachingForm') coachingForm?: string,
  ) {
    return this.behaviorService.getDailyCoachingCustomers(req.user, logDate, coachingForm);
  }

  @Post('coaching-customers')
  @Roles(Role.EMPLOYEE)
  saveDailyCoachingCustomer(@Req() req: any, @Body() dto: SaveDailyCoachingCustomerDto) {
    return this.behaviorService.saveDailyCoachingCustomer(req.user, dto);
  }

  @Post('coaching-customers/import-excel')
  @Roles(Role.EMPLOYEE)
  @UseInterceptors(FileInterceptor('file'))
  importDailyCoachingCustomersExcel(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body('logDate') logDate?: string,
    @Body('coachingForm') coachingForm?: string,
  ) {
    return this.behaviorService.importDailyCoachingCustomersFromExcel(
      req.user,
      file,
      logDate,
      coachingForm,
    );
  }

  @Get('coaching-customers/import-template')
  @Roles(Role.EMPLOYEE)
  async downloadDailyCoachingCustomersImportTemplate(
    @Res() res: Response,
    @Query('coachingForm') coachingForm?: string,
  ) {
    const file = await this.behaviorService.getDailyCoachingCustomersImportTemplateFile(coachingForm);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
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

  @Get('manager/journals/approved/export-forms-7-9-12')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportApprovedJournalsForms7912(
    @Req() req: any,
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
    @Query('keyword') keyword?: string,
  ) {
    const file = await this.behaviorService.exportApprovedJournalsForms7912File(req.user, {
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

  @Get('manager/weekly-journals/export-status-by-unit')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportManagerWeeklyJournalsStatusByUnit(
    @Req() req: any,
    @Res() res: Response,
    @Query('weekId') weekId: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.behaviorService.exportManagerWeeklyJournalsStatusByUnitFile(
      req.user,
      {
        weekId,
        unitId,
      },
    );
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

  @Get('coaching-phase-configs')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getCoachingPhaseConfigs() {
    return this.behaviorService.getCoachingPhaseConfigs();
  }

  @Get('admin/coaching-phase-configs')
  @Roles(Role.ADMIN)
  getCoachingPhaseConfigsForAdmin() {
    return this.behaviorService.getCoachingPhaseConfigsForAdmin();
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

  @Post('admin/coaching-phase-configs')
  @Roles(Role.ADMIN)
  createCoachingPhaseConfig(@Body() dto: UpsertCoachingPhaseConfigDto) {
    return this.behaviorService.upsertCoachingPhaseConfig(null, dto);
  }

  @Patch('admin/coaching-phase-configs/:id')
  @Roles(Role.ADMIN)
  updateCoachingPhaseConfig(@Param('id') id: string, @Body() dto: UpsertCoachingPhaseConfigDto) {
    return this.behaviorService.upsertCoachingPhaseConfig(id, dto);
  }

  @Get('reports/coaching-provincial-data')
  @Roles(Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async getCoachingProvincialData(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.behaviorService.getCoachingProvincialData({ fromDate, toDate, unitId });
  }

  @Get('reports/coaching-provincial-export')
  @Roles(Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportCoachingProvincial(
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.behaviorService.exportCoachingProvincialFile({ fromDate, toDate, unitId });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get('reports/coaching-provincial-summary')
  @Roles(Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async getCoachingProvincialSummary(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.behaviorService.getCoachingProvincialSummary({ fromDate, toDate, unitId });
  }

  @Get('reports/coaching-provincial-summary-export')
  @Roles(Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportCoachingProvincialSummary(
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.behaviorService.exportCoachingProvincialSummaryFile({
      fromDate,
      toDate,
      unitId,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get('reports/coaching-provincial-gd2-data')
  @Roles(Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async getCoachingProvincialGd2Data(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.behaviorService.getCoachingProvincialGd2Data({ fromDate, toDate, unitId });
  }

  @Get('reports/coaching-provincial-gd2-export')
  @Roles(Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportCoachingProvincialGd2(
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.behaviorService.exportCoachingProvincialGd2File({
      fromDate,
      toDate,
      unitId,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
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
