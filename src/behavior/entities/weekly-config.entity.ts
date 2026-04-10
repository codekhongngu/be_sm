import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('weekly_configs')
export class WeeklyConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'week_name' })
  weekName: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;
}
