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

@Entity('mindset_logs')
export class MindsetLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'log_date', type: 'date' })
  logDate: string;

  @Column({ name: 'negative_thought', type: 'text' })
  negativeThought: string;

  @Column({ name: 'new_mindset', type: 'text' })
  newMindset: string;

  @Column({ name: 'behavior_change', type: 'text' })
  behaviorChange: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'boolean', default: false })
  isShared: boolean;
}
