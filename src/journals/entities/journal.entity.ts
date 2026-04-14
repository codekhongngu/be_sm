import { Evaluation } from 'src/evaluations/entities/evaluation.entity';
import { User } from 'src/users/entities/user.entity';
import { JournalHighIncomeEform } from './journal-high-income-eform.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('journals')
@Index(['userId', 'reportDate'], { unique: true })
export class Journal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.journals, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  reportDate: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'text', default: '' })
  avoidance: string;

  @Column({ type: 'text', default: '' })
  selfLimit: string;

  @Column({ type: 'text', default: '' })
  earlyStop: string;

  @Column({ type: 'text', default: '' })
  blaming: string;

  @Column({
    type: 'jsonb',
    default: () =>
      '\'{"deepInquiry":false,"fullConsult":false,"persistence":false}\'',
  })
  standardsKept: {
    deepInquiry: boolean;
    fullConsult: boolean;
    persistence: boolean;
  };

  @Column({ type: 'text', default: '' })
  standardsKeptText: string;

  @Column({ type: 'text', default: '' })
  backslideSigns: string;

  @Column({ type: 'text', default: '' })
  solution: string;

  @Column({ type: 'timestamptz', nullable: true })
  awarenessSubmittedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  standardsSubmittedAt?: Date;

  @Column({ default: 0 })
  awarenessUpdateCount: number;

  @Column({ default: 0 })
  standardsUpdateCount: number;

  @Column({ type: 'boolean', default: false })
  awarenessShared: boolean;

  @Column({ type: 'boolean', default: false })
  standardsShared: boolean;

  @OneToOne(() => Evaluation, (evaluation) => evaluation.journal)
  evaluation: Evaluation;

  @OneToOne(() => JournalHighIncomeEform, (eform) => eform.journal)
  highIncomeEform: JournalHighIncomeEform;
}
