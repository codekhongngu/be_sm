import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('income_breakthrough_logs')
@Unique(['userId', 'logDate'])
export class IncomeBreakthroughLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'log_date', type: 'date' })
  @Index()
  logDate: string;

  @Column({ name: 'self_limit_area', type: 'text', default: '' })
  selfLimitArea: string;

  @Column({ name: 'proof_behavior', type: 'text', default: '' })
  proofBehavior: string;

  @Column({ name: 'raise_standard', type: 'text', default: '' })
  raiseStandard: string;

  @Column({ name: 'action_plan', type: 'text', default: '' })
  actionPlan: string;

  @Column({ type: 'boolean', default: false })
  isShared: boolean;
}
