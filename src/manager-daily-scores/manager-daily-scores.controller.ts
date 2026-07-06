import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateManagerDailyScoreCriterionDto } from './dto/create-manager-daily-score-criterion.dto';
import { SubmitManagerDailyScoreDto } from './dto/submit-manager-daily-score.dto';
import { UpdateManagerDailyScoreCriterionDto } from './dto/update-manager-daily-score-criterion.dto';
import { ManagerDailyScoresService } from './manager-daily-scores.service';

@Controller('manager-daily-scores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManagerDailyScoresController {
  constructor(private readonly managerDailyScoresService: ManagerDailyScoresService) {}

  @Get('criteria')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getCriteria() {
    return this.managerDailyScoresService.getCriteria();
  }

  @Get('admin/criteria')
  @Roles(Role.ADMIN)
  getCriteriaForAdmin() {
    return this.managerDailyScoresService.getCriteriaForAdmin();
  }

  @Post('admin/criteria')
  @Roles(Role.ADMIN)
  createCriterion(@Body() dto: CreateManagerDailyScoreCriterionDto) {
    return this.managerDailyScoresService.createCriterion(dto);
  }

  @Patch('admin/criteria/:id')
  @Roles(Role.ADMIN)
  updateCriterion(@Param('id') id: string, @Body() dto: UpdateManagerDailyScoreCriterionDto) {
    return this.managerDailyScoresService.updateCriterion(id, dto);
  }

  @Delete('admin/criteria/:id')
  @Roles(Role.ADMIN)
  deleteCriterion(@Param('id') id: string) {
    return this.managerDailyScoresService.deleteCriterion(id);
  }

  @Get('employees')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getEmployees(@Req() req: any, @Query('keyword') keyword?: string) {
    return this.managerDailyScoresService.getEmployees(req.user, keyword);
  }

  @Get('entry')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getEntry(@Req() req: any, @Query('employeeId') employeeId: string, @Query('scoreDate') scoreDate: string) {
    return this.managerDailyScoresService.getEntry(req.user, employeeId, scoreDate);
  }

  @Post('entry')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  submitEntry(@Req() req: any, @Body() dto: SubmitManagerDailyScoreDto) {
    return this.managerDailyScoresService.submitEntry(req.user, dto);
  }

  @Post('import-performance-data')
  @Roles(Role.PROVINCIAL_VIEWER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  importPerformanceData(@UploadedFile() file: any, @Req() req: any) {
    return this.managerDailyScoresService.importPerformanceData(req.user, file);
  }

  @Get('import-performance-template')
  @Roles(Role.PROVINCIAL_VIEWER, Role.ADMIN)
  async downloadImportPerformanceTemplate(@Res() res: Response) {
    const file = await this.managerDailyScoresService.downloadImportPerformanceTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get('statistics')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getStatistics(
    @Req() req: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('employeeId') employeeId?: string,
    @Query('unitId') unitId?: string,
  ) {
    return this.managerDailyScoresService.getStatistics(req.user, {
      fromDate,
      toDate,
      employeeId,
      unitId,
    });
  }

  @Get('tnc-competition')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getTncCompetition(
    @Req() req: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
    @Query('useApprovedScore') useApprovedScore?: string,
  ) {
    return this.managerDailyScoresService.getTncCompetition(req.user, {
      fromDate,
      toDate,
      unitId,
      useApprovedScore,
    });
  }

  @Get('tnc-competition-export')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportTncCompetition(
    @Req() req: any,
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('unitId') unitId?: string,
    @Query('useApprovedScore') useApprovedScore?: string,
  ) {
    const file = await this.managerDailyScoresService.exportTncCompetitionFile(req.user, {
      fromDate,
      toDate,
      unitId,
      useApprovedScore,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get('statistics-export')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportStatistics(
    @Req() req: any,
    @Res() res: Response,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('employeeId') employeeId?: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.managerDailyScoresService.exportStatisticsFile(req.user, {
      fromDate,
      toDate,
      employeeId,
      unitId,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get('provincial-statistics-export')
  @Roles(Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportProvincialStatistics(
    @Res() res: Response,
    @Query('scoreDate') scoreDate: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.managerDailyScoresService.exportProvincialStatisticsFile(scoreDate, {
      unitId,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get('unit-statistics-export')
  @Roles(Role.MANAGER, Role.ADMIN)
  async exportUnitStatistics(
    @Req() req: any,
    @Res() res: Response,
    @Query('scoreDate') scoreDate: string,
    @Query('unitId') unitId?: string,
  ) {
    const file = await this.managerDailyScoresService.exportUnitStatisticsFile(
      req.user,
      scoreDate,
      { unitId },
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Get('statistics/:scoreDate')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getStatisticsByDate(@Req() req: any, @Param('scoreDate') scoreDate: string) {
    return this.managerDailyScoresService.getStatistics(req.user, {
      fromDate: scoreDate,
      toDate: scoreDate,
    });
  }

  @Get('coaching-competition-template')
  @Roles(Role.PROVINCIAL_VIEWER, Role.ADMIN)
  async downloadCoachingCompetitionTemplate(@Res() res: Response) {
    const file = await this.managerDailyScoresService.downloadCoachingCompetitionTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Post('coaching-competition-import')
  @Roles(Role.PROVINCIAL_VIEWER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  importCoachingCompetitionData(@UploadedFile() file: any, @Req() req: any) {
    return this.managerDailyScoresService.importCoachingCompetitionData(req.user, file);
  }

  @Get('coaching-competition-report')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async getCoachingCompetitionReport(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('unitId') unitId: string,
    @Req() req: any,
  ) {
    if (!fromDate || !toDate) {
      throw new Error('fromDate và toDate là bắt buộc');
    }
    const user = req.user;
    let targetUnitId = unitId;

    if (user.role === Role.MANAGER) {
      targetUnitId = user.unitId;
    }

    return this.managerDailyScoresService.getCoachingCompetitionReport({ user, fromDate, toDate, unitId: targetUnitId });
  }

  @Get('coaching-competition-export')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async exportCoachingCompetitionReport(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('unitId') unitId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    if (!fromDate || !toDate) {
      throw new Error('fromDate và toDate là bắt buộc');
    }

    const user = req.user;
    let targetUnitId = unitId;

    if (user.role === Role.MANAGER) {
      targetUnitId = user.unitId;
    }

    const file = await this.managerDailyScoresService.exportCoachingCompetitionReportFile({
      user,
      fromDate,
      toDate,
      unitId: targetUnitId,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    );
    return res.send(file.buffer);
  }
}
