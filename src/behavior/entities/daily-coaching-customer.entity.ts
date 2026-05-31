import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

@Entity('daily_coaching_customers')
export class DailyCoachingCustomer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'log_date', type: 'date', default: () => 'CURRENT_DATE' })
  logDate: string;

  @Column({ name: 'coaching_form', default: 'coaching_form_1' })
  coachingForm: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'sales_plan', type: 'int', default: 0 })
  salesPlan: number;

  @Column({ name: 'customer_name', default: '' })
  customerName: string;

  @Column({ name: 'ward', default: '' })
  ward: string;

  @Column({ name: 'customer_address', type: 'text', default: '' })
  customerAddress: string;

  @Column({ name: 'old_referral', type: 'int', default: 0 })
  oldReferral: number;

  @Column({ name: 'customer_follow_up', type: 'int', default: 0 })
  customerFollowUp: number;

  @Column({ name: 'no_early_quote', type: 'int', default: 0 })
  noEarlyQuote: number;

  @Column({ name: 'consult_standard', type: 'int', default: 0 })
  consultStandard: number;

  @Column({ name: 'consult_enough_layers', type: 'int', default: 0 })
  consultEnoughLayers: number;

  @Column({ name: 'consult_solution_matching_need', type: 'int', default: 0 })
  consultSolutionMatchingNeed: number;

  @Column({ name: 'consult_clear_benefit', type: 'int', default: 0 })
  consultClearBenefit: number;

  @Column({ name: 'consult_mention_loss_avoidance', type: 'int', default: 0 })
  consultMentionLossAvoidance: number;

  @Column({ name: 'closed_service', type: 'int', default: 0 })
  closedService: number;

  @Column({ name: 'personal_revenue', type: 'numeric', precision: 14, scale: 2, default: 0 })
  personalRevenue: string;

  @Column({ name: 'next_follow_required', type: 'int', default: 0 })
  nextFollowRequired: number;

  @Column({ name: 'next_follow_step', type: 'text', default: '' })
  nextFollowStep: string;

  @Column({ name: 'next_follow_schedule', type: 'date', nullable: true })
  nextFollowSchedule?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
