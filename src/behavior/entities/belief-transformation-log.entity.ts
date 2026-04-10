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

@Entity('belief_transformation_logs')
export class BeliefTransformationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: "log_date", type: "date", default: () => "CURRENT_DATE" })
  logDate: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  situation: string;

  @Column({ name: 'old_belief', type: 'text' })
  oldBelief: string;

  @Column({ name: 'new_chosen_belief', type: 'text' })
  newChosenBelief: string;

  @Column({ name: 'new_behavior', type: 'text' })
  newBehavior: string;

  @Column({ type: 'text' })
  result: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
