import { Evaluation } from 'src/evaluations/entities/evaluation.entity';
import { Journal } from 'src/journals/entities/journal.entity';
import { Role } from 'src/common/enums/role.enum';
import { Unit } from './unit.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('users')
@Unique(['username'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  username: string;

  @Column()
  password: string;

  @Column()
  fullName: string;

  @ManyToOne(() => Unit, (unit) => unit.users, { eager: true })
  @JoinColumn({ name: 'unitId' })
  unit: Unit;

  @Column()
  unitId: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.EMPLOYEE,
  })
  role: Role;

  @Column({ nullable: true })
  telegramChatId?: string;

  @OneToMany(() => Journal, (journal) => journal.user)
  journals: Journal[];

  @OneToMany(() => Evaluation, (evaluation) => evaluation.manager)
  evaluations: Evaluation[];
}
