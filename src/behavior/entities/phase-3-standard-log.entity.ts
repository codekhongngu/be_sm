import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('phase_3_standard_logs')
@Unique(['userId', 'logDate'])
export class Phase3StandardLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'log_date', type: 'date' })
  @Index()
  logDate: string;

  @Column({ name: 'kept_standard', type: 'text', default: '' })
  keptStandard: string;

  @Column({ name: 'backslide_sign', type: 'text', default: '' })
  backslideSign: string;

  @Column({ name: 'solution', type: 'text', default: '' })
  solution: string;

  @Column({ type: 'boolean', default: false })
  isShared: boolean;
}
