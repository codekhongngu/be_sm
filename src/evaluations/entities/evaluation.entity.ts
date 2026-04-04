import { Journal } from 'src/journals/entities/journal.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('evaluations')
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Journal, (journal) => journal.evaluation, { eager: true })
  @JoinColumn({ name: 'journalId' })
  journal: Journal;

  @Column({ unique: true })
  journalId: string;

  @ManyToOne(() => User, (user) => user.evaluations, { eager: true })
  @JoinColumn({ name: 'managerId' })
  manager: User;

  @Column()
  managerId: string;

  @Column({ default: false })
  deepInquiryStatus: boolean;

  @Column({ default: false })
  fullProposalStatus: boolean;

  @Column({ default: false })
  persistenceStatus: boolean;

  @Column({ type: 'text', nullable: true })
  deepInquiryNote?: string;

  @Column({ type: 'text', nullable: true })
  fullProposalNote?: string;

  @Column({ type: 'text', nullable: true })
  persistenceNote?: string;

  @Column({ default: false })
  awarenessReviewed: boolean;

  @Column({ default: false })
  awarenessDeepInquiryStatus: boolean;

  @Column({ default: false })
  awarenessFullProposalStatus: boolean;

  @Column({ default: false })
  awarenessPersistenceStatus: boolean;

  @Column({ type: 'text', nullable: true })
  awarenessDeepInquiryNote?: string;

  @Column({ type: 'text', nullable: true })
  awarenessFullProposalNote?: string;

  @Column({ type: 'text', nullable: true })
  awarenessPersistenceNote?: string;

  @Column({ default: false })
  standardsReviewed: boolean;

  @Column({ type: 'text', nullable: true })
  awarenessManagerNote?: string;

  @Column({ type: 'text', nullable: true })
  standardsManagerNote?: string;

  @CreateDateColumn()
  createdAt: Date;
}
