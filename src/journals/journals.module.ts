import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';
import { Journal } from './entities/journal.entity';
import { JournalHighIncomeEform } from './entities/journal-high-income-eform.entity';
import { UsersModule } from 'src/users/users.module';
import { TelegramModule } from 'src/telegram/telegram.module';
import { OwnershipGuard } from 'src/common/guards/ownership.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Journal, JournalHighIncomeEform]),
    UsersModule,
    TelegramModule,
  ],
  controllers: [JournalsController],
  providers: [JournalsService, OwnershipGuard, RolesGuard],
  exports: [JournalsService, TypeOrmModule],
})
export class JournalsModule {}
