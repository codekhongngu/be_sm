import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { Evaluation } from './entities/evaluation.entity';
import { JournalsModule } from 'src/journals/journals.module';
import { UsersModule } from 'src/users/users.module';
import { TelegramModule } from 'src/telegram/telegram.module';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Evaluation]),
    JournalsModule,
    UsersModule,
    TelegramModule,
  ],
  controllers: [EvaluationsController],
  providers: [EvaluationsService, RolesGuard],
  exports: [EvaluationsService, TypeOrmModule],
})
export class EvaluationsModule {}
