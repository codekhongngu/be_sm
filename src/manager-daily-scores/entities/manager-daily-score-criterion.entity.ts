import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ManagerDailyScoreItem } from './manager-daily-score-item.entity';

@Entity('manager_daily_score_criteria')
export class ManagerDailyScoreCriterion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'section_code' })
  sectionCode: string;

  @Column({ name: 'section_name' })
  sectionName: string;

  @Column({ name: 'section_sort_order', type: 'int', default: 0 })
  sectionSortOrder: number;

  @Column({ name: 'item_code', unique: true })
  itemCode: string;

  @Column({ name: 'item_sort_order', type: 'int', default: 0 })
  itemSortOrder: number;

  @Column({ name: 'stt_label' })
  sttLabel: string;

  @Column({ name: 'content_name', type: 'text' })
  contentName: string;

  @Column({ name: 'max_score', type: 'numeric', precision: 10, scale: 2, default: 0 })
  maxScore: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => ManagerDailyScoreItem, (item) => item.criterion)
  items: ManagerDailyScoreItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
