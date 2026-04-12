import {
  Body,
  Controller,
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
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { EvaluationsService } from './evaluations.service';

@Controller('evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post()
  @Roles(Role.MANAGER, Role.ADMIN)
  create(@Body() createEvaluationDto: CreateEvaluationDto, @Req() req: any) {
    return this.evaluationsService.create(createEvaluationDto, req.user);
  }

  @Patch(':journalId')
  @Roles(Role.MANAGER, Role.ADMIN)
  updateByJournalId(
    @Param('journalId') journalId: string,
    @Body() dto: UpdateEvaluationDto,
    @Req() req: any,
  ) {
    return this.evaluationsService.updateByJournalId(journalId, dto, req.user);
  }

  @Patch(':journalId/awareness')
  @Roles(Role.MANAGER, Role.ADMIN)
  updateAwarenessByJournalId(
    @Param('journalId') journalId: string,
    @Body() dto: UpdateEvaluationDto,
    @Req() req: any,
  ) {
    return this.evaluationsService.updateAwarenessByJournalId(
      journalId,
      dto,
      req.user,
    );
  }

  @Patch(':journalId/form-1/review')
  @Roles(Role.MANAGER, Role.ADMIN)
  reviewForm1ByJournalId(
    @Param('journalId') journalId: string,
    @Body() dto: UpdateEvaluationDto,
    @Req() req: any,
  ) {
    return this.evaluationsService.updateAwarenessByJournalId(
      journalId,
      dto,
      req.user,
    );
  }

  @Patch(':journalId/standards')
  @Roles(Role.MANAGER, Role.ADMIN)
  updateStandardsByJournalId(
    @Param('journalId') journalId: string,
    @Body() dto: UpdateEvaluationDto,
    @Req() req: any,
  ) {
    return this.evaluationsService.updateStandardsByJournalId(
      journalId,
      dto,
      req.user,
    );
  }

  @Get('pending/list')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getPending(@Req() req: any) {
    return this.evaluationsService.getPendingForManager(req.user);
  }

  @Get('analytics/weekly')
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getWeeklyAnalytics(@Req() req: any) {
    return this.evaluationsService.getWeeklyAnalytics(req.user);
  }
}
