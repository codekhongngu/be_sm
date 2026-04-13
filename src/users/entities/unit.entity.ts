import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

@Entity('units')
@Unique(['code'])
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  telegramGroupChatId?: string;

  @Column({ nullable: true })
  parentUnitId?: string;

  @ManyToOne(() => Unit, (unit) => unit.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parentUnitId' })
  parentUnit?: Unit;

  @OneToMany(() => Unit, (unit) => unit.parentUnit)
  children: Unit[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  excludeFromStatistics: boolean;

  @OneToMany(() => User, (user) => user.unit)
  users: User[];
}
