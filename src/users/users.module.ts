import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Unit } from './entities/unit.entity';
import { LoginLog } from './entities/login-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Unit, LoginLog])],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
