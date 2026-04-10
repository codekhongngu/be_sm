import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JournalsModule } from './journals/journals.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { TelegramModule } from './telegram/telegram.module';
import { CommonModule } from './common/common.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { UiController } from './ui.controller';
import { User } from './users/entities/user.entity';
import { Unit } from './users/entities/unit.entity';
import { Journal } from './journals/entities/journal.entity';
import { Evaluation } from './evaluations/entities/evaluation.entity';
import { JournalHighIncomeEform } from './journals/entities/journal-high-income-eform.entity';
import { CatalogItem } from './catalogs/entities/catalog-item.entity';
import { BehaviorModule } from './behavior/behavior.module';
import { WeeklyConfig } from './behavior/entities/weekly-config.entity';
import { BehaviorChecklistLog } from './behavior/entities/behavior-checklist-log.entity';
import { MindsetLog } from './behavior/entities/mindset-log.entity';
import { SalesActivityReport } from './behavior/entities/sales-activity-report.entity';
import { EndOfDayLog } from './behavior/entities/end-of-day-log.entity';
import { BeliefTransformationLog } from './behavior/entities/belief-transformation-log.entity';
import { WeeklyJournalLog } from './behavior/entities/weekly-journal-log.entity';
import { ManagerDailyScoresModule } from './manager-daily-scores/manager-daily-scores.module';
import { ManagerDailyScoreCriterion } from './manager-daily-scores/entities/manager-daily-score-criterion.entity';
import { ManagerDailyScoreSheet } from './manager-daily-scores/entities/manager-daily-score-sheet.entity';
import { ManagerDailyScoreItem } from './manager-daily-scores/entities/manager-daily-score-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL', '');
        const dbSync = configService.get<string>('DB_SYNC', 'true') === 'true';
        const requireSsl =
          configService.get<string>('DB_SSL', '') === 'true' ||
          /sslmode=require/i.test(databaseUrl);

        return {
          type: 'postgres',
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: configService.get<string>('DB_HOST', 'localhost'),
                port: Number(configService.get<number>('DB_PORT', 5432)),
                username: configService.get<string>('DB_USER', 'postgres'),
                password: configService.get<string>('DB_PASSWORD', 'postgres'),
                database: configService.get<string>('DB_NAME', 'sales_behavior'),
              }),
          entities: [
            Unit,
            User,
            Journal,
            Evaluation,
            JournalHighIncomeEform,
            CatalogItem,
            WeeklyConfig,
            BehaviorChecklistLog,
            MindsetLog,
            SalesActivityReport,
            EndOfDayLog,
            BeliefTransformationLog,
            WeeklyJournalLog,
            ManagerDailyScoreCriterion,
            ManagerDailyScoreSheet,
            ManagerDailyScoreItem,
          ],
          synchronize: dbSync,
          ...(requireSsl
            ? { ssl: { rejectUnauthorized: false }, extra: { ssl: { rejectUnauthorized: false } } }
            : {}),
        };
      },
    }),
    AuthModule,
    UsersModule,
    JournalsModule,
    EvaluationsModule,
    DashboardModule,
    CatalogsModule,
    BehaviorModule,
    ManagerDailyScoresModule,
    TelegramModule,
    CommonModule,
  ],
  controllers: [AppController, UiController],
  providers: [AppService],
})
export class AppModule {}
