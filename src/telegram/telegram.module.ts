import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Journal } from 'src/journals/entities/journal.entity';
import { BehaviorChecklistLog } from 'src/behavior/entities/behavior-checklist-log.entity';
import { MindsetLog } from 'src/behavior/entities/mindset-log.entity';
import { SalesActivityReport } from 'src/behavior/entities/sales-activity-report.entity';
import { EndOfDayLog } from 'src/behavior/entities/end-of-day-log.entity';
import { BeliefTransformationLog } from 'src/behavior/entities/belief-transformation-log.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      Journal,
      BehaviorChecklistLog,
      MindsetLog,
      SalesActivityReport,
      EndOfDayLog,
      BeliefTransformationLog,
    ]),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
