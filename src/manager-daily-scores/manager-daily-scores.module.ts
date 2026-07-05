import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BehaviorChecklistLog } from 'src/behavior/entities/behavior-checklist-log.entity';
import { EndOfDayLog } from 'src/behavior/entities/end-of-day-log.entity';
import { ManagerCoachingLog } from 'src/behavior/entities/manager-coaching-log.entity';
import { MindsetLog } from 'src/behavior/entities/mindset-log.entity';
import { SalesActivityReport } from 'src/behavior/entities/sales-activity-report.entity';
import { SystemConfig } from 'src/behavior/entities/system-config.entity';
import { User } from 'src/users/entities/user.entity';
import { Unit } from 'src/users/entities/unit.entity';
import { ManagerDailyScoreCriterion } from './entities/manager-daily-score-criterion.entity';
import { ManagerDailyScoreImport } from './entities/manager-daily-score-import.entity';
import { ManagerDailyScoreItem } from './entities/manager-daily-score-item.entity';
import { ManagerDailyScoreSheet } from './entities/manager-daily-score-sheet.entity';
import { CoachingCompetitionImport } from './entities/coaching-competition-import.entity';
import { ManagerDailyScoresController } from './manager-daily-scores.controller';
import { ManagerDailyScoresService } from './manager-daily-scores.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Unit,
      BehaviorChecklistLog,
      MindsetLog,
      SalesActivityReport,
      EndOfDayLog,
      ManagerCoachingLog,
      ManagerDailyScoreCriterion,
      ManagerDailyScoreImport,
      ManagerDailyScoreSheet,
      ManagerDailyScoreItem,
      CoachingCompetitionImport,
      SystemConfig,
    ]),
  ],
  controllers: [ManagerDailyScoresController],
  providers: [ManagerDailyScoresService],
})
export class ManagerDailyScoresModule {}
