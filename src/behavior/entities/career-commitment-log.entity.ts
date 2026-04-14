import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('career_commitment_logs')
@Unique(['userId', 'logDate'])
export class CareerCommitmentLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'log_date', type: 'date' })
  @Index()
  logDate: string;

  @Column({ name: 'declaration_text', type: 'text', default: '' })
  declarationText: string;

  @Column({ name: 'commitment_signature', type: 'text', default: '' })
  commitmentSignature: string;

  @Column({ type: 'boolean', default: false })
  isShared: boolean;
}
