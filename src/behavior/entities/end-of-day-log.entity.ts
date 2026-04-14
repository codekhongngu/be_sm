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

@Entity('end_of_day_logs')
export class EndOfDayLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'log_date', type: 'date' })
  logDate: string;

  @Column({ name: 'different_action', type: 'text' })
  differentAction: string;

  @Column({ name: 'customer_impact', type: 'text' })
  customerImpact: string;

  @Column({ name: 'tomorrow_lesson', type: 'text' })
  tomorrowLesson: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: false })
  isShared: boolean;
}
