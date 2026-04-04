import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Journal } from './journal.entity';

@Entity('journal_high_income_eforms')
export class JournalHighIncomeEform {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Journal, (journal) => journal.highIncomeEform)
  @JoinColumn({ name: 'journalId' })
  journal: Journal;

  @Column({ unique: true })
  journalId: string;

  @Column({ type: 'text' })
  keptStandardsAnswer: string;

  @Column({ type: 'text' })
  declineSignsAnswer: string;

  @Column({ type: 'text' })
  handlingPlanAnswer: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
