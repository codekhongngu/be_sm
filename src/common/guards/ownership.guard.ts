import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { OWNERSHIP_KEY } from '../decorators/ownership.decorator';
import { Role } from '../enums/role.enum';
import { Journal } from 'src/journals/entities/journal.entity';
import { Repository } from 'typeorm';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Journal)
    private readonly journalsRepository: Repository<Journal>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<string>(OWNERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!resource) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.role === Role.ADMIN) {
      return true;
    }

    if (resource === 'journal') {
      const journalId = request.params.id || request.params.journalId;
      const journal = await this.journalsRepository.findOne(journalId, {
        relations: ['user'],
      });

      if (!journal) {
        throw new ForbiddenException('Nhật ký không tồn tại');
      }

      if (user.role === Role.EMPLOYEE && journal.userId !== user.id) {
        throw new ForbiddenException('Không có quyền truy cập nhật ký này');
      }

      if (user.role === Role.MANAGER && journal.user.unitId !== user.unitId) {
        throw new ForbiddenException(
          'Quản lý chỉ xem được nhật ký cùng đơn vị',
        );
      }
    }

    return true;
  }
}
