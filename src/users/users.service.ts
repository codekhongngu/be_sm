import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/common/enums/role.enum';
import { Repository } from 'typeorm';
import { Unit } from './entities/unit.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
  ) {}

  findByUsername(username: string) {
    return this.usersRepository.findOne({ username });
  }

  findById(id: string) {
    return this.usersRepository.findOne(id);
  }

  getList() {
    return this.usersRepository.find({
      order: { fullName: 'ASC' },
    });
  }

  create(data: Partial<User>) {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  findManagerByUnitId(unitId: string) {
    return this.usersRepository.findOne({ unitId, role: Role.MANAGER });
  }

  findUnitById(id: string) {
    return this.unitsRepository.findOne(id);
  }

  findUnitByCode(code: string) {
    return this.unitsRepository.findOne({ code });
  }

  getUnits() {
    return this.unitsRepository.find({
      relations: ['parentUnit'],
      order: { name: 'ASC' },
    });
  }

  createUnit(data: Partial<Unit>) {
    const unit = this.unitsRepository.create(data);
    return this.unitsRepository.save(unit);
  }

  saveUnit(unit: Unit) {
    return this.unitsRepository.save(unit);
  }

  countUsersByUnitId(unitId: string) {
    return this.usersRepository.count({ unitId });
  }

  countChildUnits(parentUnitId: string) {
    return this.unitsRepository.count({ parentUnitId });
  }

  removeUnit(unit: Unit) {
    return this.unitsRepository.remove(unit);
  }

  save(user: User) {
    return this.usersRepository.save(user);
  }
}
