import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Unit } from './entities/unit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Unit])],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
