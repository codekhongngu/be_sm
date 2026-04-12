import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('daily_form_edit_logs')
export class DailyFormEditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'journal_id' })
  @Index()
  journalId: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'log_date', type: 'date' })
  @Index()
  logDate: string;

  @Column({ name: 'form_type', length: 50 })
  @Index()
  formType: string;

  @Column({ name: 'field_key', length: 100 })
  fieldKey: string;

  @Column({ name: 'before_value', type: 'text', default: '' })
  beforeValue: string;

  @Column({ name: 'after_value', type: 'text', default: '' })
  afterValue: string;

  @Column({ name: 'edited_by' })
  editedBy: string;

  @Column({ name: 'edited_at', type: 'timestamptz' })
  editedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
