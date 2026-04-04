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
import { Ownership } from 'src/common/decorators/ownership.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OwnershipGuard } from 'src/common/guards/ownership.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateJournalDto } from './dto/create-journal.dto';
import { SubmitAwarenessDto } from './dto/submit-awareness.dto';
import { SubmitStandardsDto } from './dto/submit-standards.dto';
import { JournalsService } from './journals.service';

@Controller('journals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JournalsController {
  constructor(private readonly journalsService: JournalsService) {}

  @Post()
  @Roles(Role.EMPLOYEE)
  create(@Body() createJournalDto: CreateJournalDto, @Req() req: any) {
    return this.journalsService.create(createJournalDto, req.user);
  }

  @Post('eform-awareness')
  @Roles(Role.EMPLOYEE)
  submitAwareness(@Body() dto: SubmitAwarenessDto, @Req() req: any) {
    return this.journalsService.submitAwareness(dto, req.user);
  }

  @Post('eform-standards')
  @Roles(Role.EMPLOYEE)
  submitStandards(@Body() dto: SubmitStandardsDto, @Req() req: any) {
    return this.journalsService.submitStandards(dto, req.user);
  }

  @Get()
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  getList(
    @Req() req: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('status') status?: string,
  ) {
    return this.journalsService.getList(req.user, { fromDate, toDate, status });
  }

  @Get(':id')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  @Ownership('journal')
  @UseGuards(OwnershipGuard)
  findById(@Param('id') id: string) {
    return this.journalsService.findById(id);
  }
}
