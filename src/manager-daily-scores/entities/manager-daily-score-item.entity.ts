import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ManagerDailyScoreCriterion } from './manager-daily-score-criterion.entity';
import { ManagerDailyScoreSheet } from './manager-daily-score-sheet.entity';

@Entity('manager_daily_score_items')
@Unique(['sheetId', 'criteriaId'])
export class ManagerDailyScoreItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sheet_id' })
  sheetId: string;

  @ManyToOne(() => ManagerDailyScoreSheet, (sheet) => sheet.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sheet_id' })
  sheet: ManagerDailyScoreSheet;

  @Column({ name: 'criteria_id' })
  criteriaId: string;

  @ManyToOne(() => ManagerDailyScoreCriterion, (criterion) => criterion.items, { eager: true })
  @JoinColumn({ name: 'criteria_id' })
  criterion: ManagerDailyScoreCriterion;

  @Column({ name: 'requirement_note', type: 'text' })
  requirementNote: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  score: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
