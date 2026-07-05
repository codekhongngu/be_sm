import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Unit } from 'src/users/entities/unit.entity';

@Entity('coaching_competition_imports')
export class CoachingCompetitionImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', comment: 'Ngày ghi nhận điểm thi đua' })
  scoreDate: Date;

  @Column({ type: 'uuid' })
  employeeId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  employeeCode: string;

  @Column({ type: 'uuid', nullable: true })
  unitId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Mục 3.1: Hình ảnh coaching báo cáo hằng ngày qua group' })
  item31Score: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Mục 3.2: Video roleplay' })
  item32Score: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Mục 3.3: Câu chuyện ca thành công và bài học nhân rộng' })
  item33Score: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Mục 4.1: Số dịch vụ phát triển mới/gia hạn/nâng gói/nâng chu kỳ' })
  item41Score: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Mục 4.2: Số gói cao phát triển mới' })
  item42Score: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Mục 4.3: Tỷ lệ chốt dịch vụ' })
  item43Score: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Mục 4.4: Doanh thu PTM/GH cá nhân' })
  item44Score: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Mục 4.5: Số KH quay lại giới thiệu KH mới' })
  item45Score: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Mục 5.1: Sáng kiến coaching' })
  item51Score: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sourceFileName: string;

  @Column({ type: 'uuid', nullable: true })
  importedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'employeeId' })
  employee: User;

  @ManyToOne(() => Unit)
  @JoinColumn({ name: 'unitId' })
  unit: Unit;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'importedById' })
  importedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
