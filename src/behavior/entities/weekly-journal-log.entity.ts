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
import { User } from 'src/users/entities/user.entity';
import { WeeklyConfig } from './weekly-config.entity';

@Entity('weekly_journal_logs')
@Unique(['userId', 'weekId', 'formType'])
export class WeeklyJournalLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'week_id' })
  weekId: string;

  @ManyToOne(() => WeeklyConfig)
  @JoinColumn({ name: 'week_id' })
  week: WeeklyConfig;

  @Column({ name: 'form_type' })
  formType: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  entries: any[];

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'status', length: 50, default: 'PENDING' })
  status: string;

  @Column({ name: 'manager_comment', type: 'text', nullable: true })
  managerComment: string;

  @Column({ name: 'reviewer_id', nullable: true })
  reviewerId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
