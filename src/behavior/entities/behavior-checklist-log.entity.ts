import { User } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BehaviorChecklistStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('behavior_checklist_logs')
export class BehaviorChecklistLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'log_date', type: 'date' })
  logDate: string;

  @Column({ name: 'asked_deep_question', default: false })
  askedDeepQuestion: boolean;

  @Column({ name: 'full_consultation', default: false })
  fullConsultation: boolean;

  @Column({ name: 'followed_through', default: false })
  followedThrough: boolean;

  @Column({ name: 'customer_met_count', type: 'int', default: 0 })
  customerMetCount: number;

  @Column({ name: 'employee_notes', type: 'text', nullable: true })
  employeeNotes?: string;

  @Column({ name: 'manager_id', nullable: true })
  managerId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager?: User;

  @Column({ type: 'varchar', default: BehaviorChecklistStatus.PENDING })
  status: BehaviorChecklistStatus;

  @Column({ name: 'mgr_eval_deep_q', nullable: true })
  mgrEvalDeepQ?: boolean;

  @Column({ name: 'mgr_eval_full_cons', nullable: true })
  mgrEvalFullCons?: boolean;

  @Column({ name: 'mgr_eval_follow', nullable: true })
  mgrEvalFollow?: boolean;

  @Column({ name: 'manager_feedback', type: 'text', nullable: true })
  managerFeedback?: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: false })
  isShared: boolean;
}
