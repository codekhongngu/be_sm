import { Unit } from 'src/users/entities/unit.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ManagerDailyScoreItem } from './manager-daily-score-item.entity';

@Entity('manager_daily_score_sheets')
@Unique(['employeeId', 'scoreDate'])
export class ManagerDailyScoreSheet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'score_date', type: 'date' })
  scoreDate: string;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  @Column({ name: 'manager_id' })
  managerId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'manager_id' })
  manager: User;

  @Column({ name: 'unit_id' })
  unitId: string;

  @ManyToOne(() => Unit, { eager: true })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ name: 'total_score', type: 'numeric', precision: 10, scale: 2, default: 0 })
  totalScore: string;

  @OneToMany(() => ManagerDailyScoreItem, (item) => item.sheet, { cascade: true })
  items: ManagerDailyScoreItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
