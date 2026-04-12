import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('journey_phase_configs')
@Unique(['phaseCode'])
export class JourneyPhaseConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'phase_code', length: 30 })
  @Index()
  phaseCode: string;

  @Column({ name: 'phase_name', length: 120 })
  phaseName: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string;

  @Column({ name: 'sort_order', type: 'int', default: 1 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'allowed_forms', type: 'simple-array', nullable: true })
  allowedForms: string[];
}
