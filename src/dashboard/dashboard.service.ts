import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/common/enums/role.enum';
import { Evaluation } from 'src/evaluations/entities/evaluation.entity';
import { Journal } from 'src/journals/entities/journal.entity';
import { Unit } from 'src/users/entities/unit.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { JourneyPhaseConfig } from 'src/behavior/entities/journey-phase-config.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Journal)
    private readonly journalsRepository: Repository<Journal>,
    @InjectRepository(Evaluation)
    private readonly evaluationsRepository: Repository<Evaluation>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
    @InjectRepository(JourneyPhaseConfig)
    private readonly phaseConfigsRepository: Repository<JourneyPhaseConfig>,
  ) {}

  private getPeriodDays(period?: string) {
    if (period === 'week') return 7;
    if (period === 'quarter') return 90;
    return 30;
  }

  private getStartDate(period?: string) {
    const days = this.getPeriodDays(period);
    const date = new Date();
    date.setDate(date.getDate() - (days - 1));
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getWeekStart(date: Date) {
    const cloned = new Date(date);
    const day = cloned.getDay() || 7;
    cloned.setDate(cloned.getDate() - day + 1);
    cloned.setHours(0, 0, 0, 0);
    return cloned;
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  async getMetrics() {
    const totalJournals = await this.journalsRepository.count();
    const compliedCountRaw = await this.journalsRepository
      .createQueryBuilder('journal')
      .select('COUNT(journal.id)', 'count')
      .where('journal.awarenessSubmittedAt IS NOT NULL')
      .andWhere('journal.standardsSubmittedAt IS NOT NULL')
      .getRawOne();
    const declinedCountRaw = await this.journalsRepository
      .createQueryBuilder('journal')
      .select('COUNT(journal.id)', 'count')
      .where("COALESCE(journal.backslideSigns, '') <> ''")
      .getRawOne();
    const compliedCount = Number(compliedCountRaw?.count || 0);
    const declinedCount = Number(declinedCountRaw?.count || 0);

    const complianceRate =
      totalJournals === 0 ? 0 : (compliedCount / totalJournals) * 100;
    const declineRate =
      totalJournals === 0 ? 0 : (declinedCount / totalJournals) * 100;

    return {
      totalJournals,
      compliedCount,
      declinedCount,
      complianceRate: Number(complianceRate.toFixed(2)),
      declineRate: Number(declineRate.toFixed(2)),
    };
  }

  async getBehaviorAnalytics(
    currentUser: any,
    filters: { period?: string; unitId?: string; phaseId?: string },
  ) {
    let startDateKey = this.dateKey(this.getStartDate(filters.period));
    let endDateKey = this.dateKey(new Date());

    if (filters.phaseId) {
      const phase = await this.phaseConfigsRepository.findOne(filters.phaseId);
      if (phase && phase.startDate) {
        startDateKey = phase.startDate;
        if (phase.endDate) {
          endDateKey = phase.endDate;
        }
      }
    }

    const hasProvinceScope =
      currentUser.role === Role.ADMIN || currentUser.role === Role.PROVINCIAL_VIEWER;
    const scopeUnitId = currentUser.role === Role.MANAGER ? currentUser.unitId : filters.unitId;

    const journalQb = this.journalsRepository
      .createQueryBuilder('journal')
      .leftJoinAndSelect('journal.user', 'user')
      .leftJoinAndSelect('user.unit', 'unit')
      .leftJoinAndSelect('journal.evaluation', 'evaluation')
      .where('journal.reportDate >= :startDateKey', { startDateKey })
      .andWhere('journal.reportDate <= :endDateKey', { endDateKey });

    if (scopeUnitId) {
      journalQb.andWhere('user.unitId = :scopeUnitId', { scopeUnitId });
    }
    const journals = await journalQb.getMany();

    const employeesQb = this.usersRepository
      .createQueryBuilder('user')
      .where('user.role = :employeeRole', { employeeRole: Role.EMPLOYEE });
    if (scopeUnitId) {
      employeesQb.andWhere('user.unitId = :scopeUnitId', { scopeUnitId });
    } else if (currentUser.role === Role.MANAGER) {
      employeesQb.andWhere('user.unitId = :managerUnitId', {
        managerUnitId: currentUser.unitId,
      });
    }
    const totalEmployees = await employeesQb.getCount();

    const totalJournals = journals.length;
    const submittedCount = journals.filter(
      (item) => item.awarenessSubmittedAt && item.standardsSubmittedAt,
    ).length;
    const complianceRate =
      totalJournals === 0 ? 0 : (submittedCount / totalJournals) * 100;

    const evaluations = journals
      .map((item) => item.evaluation)
      .filter((item) => !!item) as Evaluation[];
    const totalEvaluations = evaluations.length || 1;

    const standardsDeepDone = evaluations.filter((item) => item.deepInquiryStatus).length;
    const standardsFullDone = evaluations.filter((item) => item.fullProposalStatus).length;
    const standardsPersistenceDone = evaluations.filter(
      (item) => item.persistenceStatus,
    ).length;

    const standardsDeepRate = (standardsDeepDone / totalEvaluations) * 100;
    const standardsFullRate = (standardsFullDone / totalEvaluations) * 100;
    const standardsPersistenceRate = (standardsPersistenceDone / totalEvaluations) * 100;
    const averagePassRate =
      (standardsDeepRate + standardsFullRate + standardsPersistenceRate) / 3;

    const barData = [
      {
        skill: 'Hỏi sâu',
        daThucHien: standardsDeepDone,
        chuaThucHien: totalEvaluations - standardsDeepDone,
      },
      {
        skill: 'Đề xuất đủ',
        daThucHien: standardsFullDone,
        chuaThucHien: totalEvaluations - standardsFullDone,
      },
      {
        skill: 'Theo đến quyết',
        daThucHien: standardsPersistenceDone,
        chuaThucHien: totalEvaluations - standardsPersistenceDone,
      },
    ];

    const radarData = [
      { metric: 'Hỏi sâu', value: Number(standardsDeepRate.toFixed(2)) },
      { metric: 'Đề xuất đủ', value: Number(standardsFullRate.toFixed(2)) },
      { metric: 'Theo đến quyết', value: Number(standardsPersistenceRate.toFixed(2)) },
    ];

    const now = new Date();
    const weekBuckets = Array.from({ length: 12 }).map((_, idx) => {
      const start = this.getWeekStart(new Date(now));
      start.setDate(start.getDate() - (11 - idx) * 7);
      return {
        key: this.dateKey(start),
        label: `Tuần ${idx + 1}`,
        total: 0,
        pass: 0,
      };
    });
    const bucketMap = new Map(weekBuckets.map((item) => [item.key, item]));
    journals.forEach((journal) => {
      const reportDate = new Date(journal.reportDate || journal.createdAt);
      const weekStart = this.dateKey(this.getWeekStart(reportDate));
      const bucket = bucketMap.get(weekStart);
      if (!bucket) return;
      bucket.total += 1;
      const evalData = journal.evaluation;
      if (
        evalData &&
        evalData.deepInquiryStatus &&
        evalData.fullProposalStatus &&
        evalData.persistenceStatus
      ) {
        bucket.pass += 1;
      }
    });
    const lineData = weekBuckets.map((item) => ({
      week: item.label,
      value: item.total === 0 ? 0 : Number(((item.pass / item.total) * 100).toFixed(2)),
    }));

    const reasonCounter = new Map<string, number>();
    journals.forEach((journal) => {
      const reasons = String(journal.blaming || '')
        .split(/[,;\n]+/g)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 2);
      reasons.forEach((reason) => {
        reasonCounter.set(reason, (reasonCounter.get(reason) || 0) + 1);
      });
    });
    const topReasons = [...reasonCounter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((item) => ({ text: item[0], count: item[1] }));

    const unitOptionsQb = this.unitsRepository.createQueryBuilder('unit');
    if (currentUser.role === Role.MANAGER) {
      unitOptionsQb.where('unit.id = :unitId', { unitId: currentUser.unitId });
    }
    const unitOptions = await unitOptionsQb.orderBy('unit.code', 'ASC').getMany();

    let unitComparison: Array<{
      unitId: string;
      unitName: string;
      deepInquiryRate: number;
      fullProposalRate: number;
      persistenceRate: number;
    }> = [];

    if (hasProvinceScope && !scopeUnitId) {
      const grouped = new Map<
        string,
        { unitName: string; total: number; deep: number; full: number; persistence: number }
      >();
      journals.forEach((journal) => {
        const unitId = journal.user?.unitId || 'unknown';
        const unitName = journal.user?.unit?.name || 'Không xác định';
        if (!grouped.has(unitId)) {
          grouped.set(unitId, { unitName, total: 0, deep: 0, full: 0, persistence: 0 });
        }
        const row = grouped.get(unitId)!;
        if (!journal.evaluation) return;
        row.total += 1;
        if (journal.evaluation.deepInquiryStatus) row.deep += 1;
        if (journal.evaluation.fullProposalStatus) row.full += 1;
        if (journal.evaluation.persistenceStatus) row.persistence += 1;
      });
      unitComparison = [...grouped.entries()].map(([unitId, value]) => ({
        unitId,
        unitName: value.unitName,
        deepInquiryRate: value.total === 0 ? 0 : Number(((value.deep / value.total) * 100).toFixed(2)),
        fullProposalRate: value.total === 0 ? 0 : Number(((value.full / value.total) * 100).toFixed(2)),
        persistenceRate:
          value.total === 0 ? 0 : Number(((value.persistence / value.total) * 100).toFixed(2)),
      }));
    }

    return {
      filters: {
        period: filters.period || 'month',
        unitId: scopeUnitId || null,
      },
      kpis: {
        totalEmployees,
        complianceRate: Number(complianceRate.toFixed(2)),
        averagePassRate: Number(averagePassRate.toFixed(2)),
      },
      charts: {
        barData,
        radarData,
        lineData,
      },
      topReasons,
      unitOptions: unitOptions.map((unit) => ({
        id: unit.id,
        code: unit.code,
        name: unit.name,
      })),
      unitComparison,
      scope:
        currentUser.role === Role.ADMIN
          ? 'ADMIN'
          : currentUser.role === Role.PROVINCIAL_VIEWER
            ? 'PROVINCIAL_VIEWER'
            : 'MANAGER',
    };
  }
}
