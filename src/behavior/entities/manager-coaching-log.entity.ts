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

@Entity('manager_coaching_logs')
export class ManagerCoachingLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'coach_user_id' })
  coachUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coach_user_id' })
  coachUser: User;

  @Column({ name: 'coached_user_id' })
  coachedUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coached_user_id' })
  coachedUser: User;

  @Column({ name: 'coaching_time', type: 'timestamptz' })
  coachingTime: Date;

  @Column({ name: 'coaching_content', type: 'text' })
  coachingContent: string;

  @Column({ name: 'content_to_improve', type: 'text' })
  contentToImprove: string;

  @Column({ name: 'keep_tnc', type: 'int', default: 0 })
  keepTnc: number;

  @Column({ name: 'evaluation_result', type: 'int', default: 0 })
  evaluationResult: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
