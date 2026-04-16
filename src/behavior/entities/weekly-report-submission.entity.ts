import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { WeeklyConfig } from './weekly-config.entity';

@Entity('weekly_report_submissions')
export class WeeklyReportSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'week_id', type: 'uuid' })
  weekId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'manager_id', type: 'uuid' })
  managerId: string;

  @Column({ name: 'customer_met_count', type: 'int', default: 0 })
  customerMetCount: number;

  @Column({ name: 'deep_inquiry_rate', type: 'numeric', precision: 5, scale: 2, default: 0 })
  deepInquiryRate: number;

  @Column({ name: 'full_consultation_rate', type: 'numeric', precision: 5, scale: 2, default: 0 })
  fullConsultationRate: number;

  @Column({ name: 'followed_through_rate', type: 'numeric', precision: 5, scale: 2, default: 0 })
  followedThroughRate: number;

  @Column({ name: 'manager_feedback', type: 'text', nullable: true })
  managerFeedback: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => WeeklyConfig)
  @JoinColumn({ name: 'week_id' })
  week: WeeklyConfig;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'manager_id' })
  manager: User;
}
