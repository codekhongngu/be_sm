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

@Entity('sales_activity_reports')
export class SalesActivityReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: "log_date", type: "date", default: () => "CURRENT_DATE" })
  logDate: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ name: 'customer_issue', type: 'text' })
  customerIssue: string;

  @Column({ type: 'text' })
  consequence: string;

  @Column({ name: 'solution_offered', type: 'text' })
  solutionOffered: string;

  @Column({ name: 'value_based_pricing', type: 'text' })
  valueBasedPricing: string;

  @Column({ type: 'text' })
  result: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
