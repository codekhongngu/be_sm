import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Journal } from 'src/journals/entities/journal.entity';
import { User } from 'src/users/entities/user.entity';
import { BehaviorController } from './behavior.controller';
import { BehaviorService } from './behavior.service';
import { BehaviorChecklistLog } from './entities/behavior-checklist-log.entity';
import { BeliefTransformationLog } from './entities/belief-transformation-log.entity';
import { EndOfDayLog } from './entities/end-of-day-log.entity';
import { MindsetLog } from './entities/mindset-log.entity';
import { SalesActivityReport } from './entities/sales-activity-report.entity';
import { WeeklyConfig } from './entities/weekly-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Journal,
      WeeklyConfig,
      BehaviorChecklistLog,
      MindsetLog,
      SalesActivityReport,
      EndOfDayLog,
      BeliefTransformationLog,
    ]),
  ],
  controllers: [BehaviorController],
  providers: [BehaviorService],
})
export class BehaviorModule {}
