import { User } from 'src/users/entities/user.entity';
import { Unit } from 'src/users/entities/unit.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('manager_daily_score_imports')
@Unique(['employeeId', 'scoreDate'])
export class ManagerDailyScoreImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'score_date', type: 'date' })
  scoreDate: string;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  @Column({ name: 'unit_id' })
  unitId: string;

  @ManyToOne(() => Unit, { eager: true })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ name: 'employee_code', nullable: true })
  employeeCode: string;

  @Column({
    name: 'successful_care_calls',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  successfulCareCalls: string;

  @Column({
    name: 'successful_services',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  successfulServices: string;

  @Column({
    name: 'high_ptm_packages',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  highPtmPackages: string;

  @Column({
    name: 'personal_revenue_thousand',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  personalRevenueThousand: string;

  @Column({ name: 'source_file_name', nullable: true })
  sourceFileName: string;

  @Column({ name: 'imported_by_id', nullable: true })
  importedById: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'imported_by_id' })
  importedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
