import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evaluation } from 'src/evaluations/entities/evaluation.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Journal } from 'src/journals/entities/journal.entity';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Unit } from 'src/users/entities/unit.entity';
import { User } from 'src/users/entities/user.entity';
import { JourneyPhaseConfig } from 'src/behavior/entities/journey-phase-config.entity';
import { BehaviorChecklistLog } from 'src/behavior/entities/behavior-checklist-log.entity';
import { MindsetLog } from 'src/behavior/entities/mindset-log.entity';
import { SalesActivityReport } from 'src/behavior/entities/sales-activity-report.entity';
import { EndOfDayLog } from 'src/behavior/entities/end-of-day-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Journal,
      Evaluation,
      User,
      Unit,
      JourneyPhaseConfig,
      BehaviorChecklistLog,
      MindsetLog,
      SalesActivityReport,
      EndOfDayLog,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, RolesGuard],
})
export class DashboardModule {}
