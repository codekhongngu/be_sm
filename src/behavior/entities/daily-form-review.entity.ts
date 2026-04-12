import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('daily_form_reviews')
@Unique(['userId', 'logDate', 'formType'])
export class DailyFormReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'log_date', type: 'date' })
  @Index()
  logDate: string;

  @Column({ name: 'form_type', length: 50 })
  @Index()
  formType: string;

  @Column({ name: 'status', length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'manager_note', type: 'text', default: '' })
  managerNote: string;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
