import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Journal } from 'src/journals/entities/journal.entity';
import { User } from 'src/users/entities/user.entity';
import { BehaviorController } from './behavior.controller';
import { BehaviorService } from './behavior.service';
import { BehaviorChecklistLog } from './entities/behavior-checklist-log.entity';
import { BeliefTransformationLog } from './entities/belief-transformation-log.entity';
import { DailyFormEditLog } from './entities/daily-form-edit-log.entity';
import { DailyFormReview } from './entities/daily-form-review.entity';
import { CareerCommitmentLog } from './entities/career-commitment-log.entity';
import { EndOfDayLog } from './entities/end-of-day-log.entity';
import { IncomeBreakthroughLog } from './entities/income-breakthrough-log.entity';
import { JourneyPhaseConfig } from './entities/journey-phase-config.entity';
import { MindsetLog } from './entities/mindset-log.entity';
import { Phase3StandardLog } from './entities/phase-3-standard-log.entity';
import { SalesActivityReport } from './entities/sales-activity-report.entity';
import { SystemConfig } from './entities/system-config.entity';
import { WeeklyConfig } from './entities/weekly-config.entity';
import { WeeklyJournalLog } from './entities/weekly-journal-log.entity';
import { Evaluation } from '../evaluations/entities/evaluation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Journal,
      Evaluation,
      WeeklyConfig,
      BehaviorChecklistLog,
      DailyFormReview,
      DailyFormEditLog,
      MindsetLog,
      SalesActivityReport,
      EndOfDayLog,
      BeliefTransformationLog,
      WeeklyJournalLog,
      Phase3StandardLog,
      IncomeBreakthroughLog,
      CareerCommitmentLog,
      JourneyPhaseConfig,
      SystemConfig,
    ]),
  ],
  controllers: [BehaviorController],
  providers: [BehaviorService],
})
export class BehaviorModule {}
