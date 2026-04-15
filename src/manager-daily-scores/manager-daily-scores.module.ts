import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Unit } from 'src/users/entities/unit.entity';
import { ManagerDailyScoreCriterion } from './entities/manager-daily-score-criterion.entity';
import { ManagerDailyScoreItem } from './entities/manager-daily-score-item.entity';
import { ManagerDailyScoreSheet } from './entities/manager-daily-score-sheet.entity';
import { ManagerDailyScoresController } from './manager-daily-scores.controller';
import { ManagerDailyScoresService } from './manager-daily-scores.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Unit,
      ManagerDailyScoreCriterion,
      ManagerDailyScoreSheet,
      ManagerDailyScoreItem,
    ]),
  ],
  controllers: [ManagerDailyScoresController],
  providers: [ManagerDailyScoresService],
})
export class ManagerDailyScoresModule {}
