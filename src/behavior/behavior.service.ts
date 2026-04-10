import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/common/enums/role.enum';
import { Journal } from 'src/journals/entities/journal.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import {
  BehaviorChecklistLog,
  BehaviorChecklistStatus,
} from './entities/behavior-checklist-log.entity';
import { BeliefTransformationLog } from './entities/belief-transformation-log.entity';
import { EndOfDayLog } from './entities/end-of-day-log.entity';
import { MindsetLog } from './entities/mindset-log.entity';
import { SalesActivityReport } from './entities/sales-activity-report.entity';
import { WeeklyConfig } from './entities/weekly-config.entity';
import { WeeklyJournalLog } from './entities/weekly-journal-log.entity';
import { EvaluateBehaviorLogDto } from './dto/evaluate-behavior-log.dto';
import { BehaviorFormType, SubmitLogDto } from './dto/submit-log.dto';
import { CreateWeeklyConfigDto } from './dto/create-weekly-config.dto';
import { SubmitWeeklyJournalDto, WeeklyJournalFormType } from './dto/submit-weekly-journal.dto';
import { UpdateWeeklyConfigDto } from './dto/update-weekly-config.dto';

@Injectable()
export class BehaviorService {
  constructor(
    @InjectRepository(Journal)
    private readonly journalsRepository: Repository<Journal>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(WeeklyConfig)
    private readonly weeklyConfigsRepository: Repository<WeeklyConfig>,
    @InjectRepository(BehaviorChecklistLog)
    private readonly behaviorChecklistLogsRepository: Repository<BehaviorChecklistLog>,
    @InjectRepository(MindsetLog)
    private readonly mindsetLogsRepository: Repository<MindsetLog>,
    @InjectRepository(SalesActivityReport)
    private readonly salesActivityReportsRepository: Repository<SalesActivityReport>,
    @InjectRepository(EndOfDayLog)
    private readonly endOfDayLogsRepository: Repository<EndOfDayLog>,
    @InjectRepository(BeliefTransformationLog)
    private readonly beliefTransformationLogsRepository: Repository<BeliefTransformationLog>,
    @InjectRepository(WeeklyJournalLog)
    private readonly weeklyJournalLogsRepository: Repository<WeeklyJournalLog>,
  ) {}

  async submitLog(user: any, dto: SubmitLogDto) {
    if (dto.formType === BehaviorFormType.FORM_1) {
      return this.submitForm1(user.id, dto);
    }
    if (dto.formType === BehaviorFormType.FORM_2) {
      return this.submitForm2(user.id, dto);
    }
    if (dto.formType === BehaviorFormType.FORM_3) {
      return this.submitForm3(user.id, dto);
    }
    if (dto.formType === BehaviorFormType.FORM_4) {
      return this.submitForm4(user.id, dto);
    }
    if (dto.formType === BehaviorFormType.FORM_5) {
      return this.submitForm5(user.id, dto);
    }
    return this.submitForm8(user.id, dto);
  }

  private resolveLogDate(logDate?: string): string {
    return logDate || new Date().toISOString().slice(0, 10);
  }

  private async submitForm1(userId: string, dto: SubmitLogDto) {
    const reportDate = this.resolveLogDate(dto.logDate);
    let journal = await this.journalsRepository.findOne({ userId, reportDate });
    if (!journal) {
      journal = this.journalsRepository.create({ userId, reportDate });
    }
    journal.avoidance = dto.avoidance || '';
    journal.selfLimit = dto.selfLimit || '';
    journal.earlyStop = dto.earlyStop || '';
    journal.blaming = dto.blaming || '';
    journal.awarenessSubmittedAt = new Date();
    return this.journalsRepository.save(journal);
  }

  private async submitForm2(userId: string, dto: SubmitLogDto) {
    const logDate = this.resolveLogDate(dto.logDate);
    let record = await this.behaviorChecklistLogsRepository.findOne({
      userId,
      logDate,
    });

    if (record?.status === BehaviorChecklistStatus.APPROVED) {
      throw new ForbiddenException(
        'Bản ghi đã được duyệt Approved, nhân viên không thể chỉnh sửa',
      );
    }

    if (!record) {
      record = this.behaviorChecklistLogsRepository.create({ userId, logDate });
    }

    record.askedDeepQuestion = !!dto.askedDeepQuestion;
    record.fullConsultation = !!dto.fullConsultation;
    record.followedThrough = !!dto.followedThrough;
    record.customerMetCount = dto.customerMetCount || 0;
    record.employeeNotes = dto.employeeNotes;
    record.status = BehaviorChecklistStatus.PENDING;
    record.managerId = null;
    record.mgrEvalDeepQ = null;
    record.mgrEvalFullCons = null;
    record.mgrEvalFollow = null;
    record.managerFeedback = null;
    record.reviewedAt = null;
    return this.behaviorChecklistLogsRepository.save(record);
  }

  private async submitForm3(userId: string, dto: SubmitLogDto) {
    const logDate = this.resolveLogDate(dto.logDate);
    let record = await this.mindsetLogsRepository.findOne({ userId, logDate });
    if (!record) {
      record = this.mindsetLogsRepository.create({ userId, logDate });
    }
    record.negativeThought = dto.negativeThought || '';
    record.newMindset = dto.newMindset || '';
    record.behaviorChange = dto.behaviorChange || '';
    return this.mindsetLogsRepository.save(record);
  }

  private async submitForm4(userId: string, dto: SubmitLogDto) {
    const logDate = this.resolveLogDate(dto.logDate);
    await this.salesActivityReportsRepository.delete({ userId, logDate });

    const activities = dto.salesActivities && dto.salesActivities.length > 0 
      ? dto.salesActivities 
      : [{
          customerName: dto.customerName || '',
          customerIssue: dto.customerIssue || '',
          consequence: dto.consequence || '',
          solutionOffered: dto.solutionOffered || '',
          valueBasedPricing: dto.valueBasedPricing || '',
          result: dto.result || ''
        }];

    const records = activities.map(act => this.salesActivityReportsRepository.create({
      userId,
      logDate,
      customerName: act.customerName || '',
      customerIssue: act.customerIssue || '',
      consequence: act.consequence || '',
      solutionOffered: act.solutionOffered || '',
      valueBasedPricing: act.valueBasedPricing || '',
      result: act.result || ''
    }));

    return this.salesActivityReportsRepository.save(records);
  }

  private async submitForm5(userId: string, dto: SubmitLogDto) {
    const logDate = this.resolveLogDate(dto.logDate);
    let record = await this.endOfDayLogsRepository.findOne({ userId, logDate });
    if (!record) {
      record = this.endOfDayLogsRepository.create({ userId, logDate });
    }
    record.differentAction = dto.differentAction || '';
    record.customerImpact = dto.customerImpact || '';
    record.tomorrowLesson = dto.tomorrowLesson || '';
    return this.endOfDayLogsRepository.save(record);
  }

  private async submitForm8(userId: string, dto: SubmitLogDto) {
    const logDate = this.resolveLogDate(dto.logDate);
    await this.beliefTransformationLogsRepository.delete({ userId, logDate });

    const items =
      dto.beliefTransformations && dto.beliefTransformations.length > 0
        ? dto.beliefTransformations
        : [
            {
              situation: dto.situation || '',
              oldBelief: dto.oldBelief || '',
              newChosenBelief: dto.newChosenBelief || '',
              newBehavior: dto.newBehavior || '',
              result: dto.transformationResult || '',
            },
          ];

    const records = items.map((item) =>
      this.beliefTransformationLogsRepository.create({
        userId,
        logDate,
        situation: item.situation || '',
        oldBelief: item.oldBelief || '',
        newChosenBelief: item.newChosenBelief || '',
        newBehavior: item.newBehavior || '',
        result: item.result || '',
      }),
    );

    return this.beliefTransformationLogsRepository.save(records);
  }

  private async getCurrentWeek() {
    const today = new Date().toISOString().slice(0, 10);
    const week = await this.weeklyConfigsRepository
      .createQueryBuilder('w')
      .where(':today BETWEEN w.startDate AND w.endDate', { today })
      .orderBy('w.startDate', 'DESC')
      .getOne();
    if (!week) {
      throw new NotFoundException('Chưa cấu hình tuần hiện tại');
    }
    return week;
  }

  async getLogsHistory(userId: string, logDate: string) {
    return {
      form2: await this.behaviorChecklistLogsRepository.findOne({ userId, logDate }),
      form3: await this.mindsetLogsRepository.findOne({ userId, logDate }),
      form4: await this.salesActivityReportsRepository.find({ userId, logDate }),
      form5: await this.endOfDayLogsRepository.findOne({ userId, logDate }),
      form8: await this.beliefTransformationLogsRepository.find({ userId, logDate }),
    };
  }

  async getPendingLogsForManager(currentUser: any) {
    const week = await this.getCurrentWeek();
    const qb = this.behaviorChecklistLogsRepository
      .createQueryBuilder('b')
      .leftJoinAndMapOne('b.user', User, 'u', 'u.id = b.user_id')
      .where('b.logDate BETWEEN :startDate AND :endDate', {
        startDate: week.startDate,
        endDate: week.endDate,
      })
      .andWhere('b.status = :status', {
        status: BehaviorChecklistStatus.PENDING,
      })
      .andWhere('u.role = :role', { role: Role.EMPLOYEE });

    if (currentUser.role === Role.MANAGER) {
      qb.andWhere('u.unitId = :unitId', { unitId: currentUser.unitId });
    }

    const items = await qb.orderBy('b.logDate', 'ASC').getMany();
    return {
      week,
      items,
    };
  }

  async evaluateBehaviorLog(id: string, dto: EvaluateBehaviorLogDto, currentUser: any) {
    const record = await this.behaviorChecklistLogsRepository.findOne(id);
    if (!record) {
      throw new NotFoundException('Không tìm thấy bản ghi Mẫu 2');
    }

    const employee = await this.usersRepository.findOne(record.userId);
    if (!employee) {
      throw new NotFoundException('Không tìm thấy nhân viên của bản ghi');
    }

    if (currentUser.role === Role.MANAGER && employee.unitId !== currentUser.unitId) {
      throw new ForbiddenException('Bạn không có quyền thẩm định bản ghi này');
    }

    record.managerId = currentUser.id;
    record.mgrEvalDeepQ = dto.mgrEvalDeepQ;
    record.mgrEvalFullCons = dto.mgrEvalFullCons;
    record.mgrEvalFollow = dto.mgrEvalFollow;
    record.managerFeedback = dto.managerFeedback;
    record.reviewedAt = new Date();
    record.status =
      dto.mgrEvalDeepQ && dto.mgrEvalFullCons && dto.mgrEvalFollow
        ? BehaviorChecklistStatus.APPROVED
        : BehaviorChecklistStatus.REJECTED;

    return this.behaviorChecklistLogsRepository.save(record);
  }

  async getWeeklySummary(weekId: string, currentUser: any) {
    const week = await this.weeklyConfigsRepository.findOne(weekId);
    if (!week) {
      throw new NotFoundException('Không tìm thấy cấu hình tuần');
    }

    const totalDays =
      Math.floor(
        (new Date(week.endDate).getTime() - new Date(week.startDate).getTime()) /
          86400000,
      ) + 1;

    const qb = this.behaviorChecklistLogsRepository
      .createQueryBuilder('b')
      .leftJoin(User, 'u', 'u.id = b.user_id')
      .select('b.userId', 'userId')
      .addSelect('u.fullName', 'fullName')
      .addSelect('SUM(b.customerMetCount)', 'totalCustomerMet')
      .addSelect(
        `ROUND(100.0 * SUM(CASE WHEN b.status = 'APPROVED' AND b.mgrEvalDeepQ = true THEN 1 ELSE 0 END) / :totalDays, 2)`,
        'deepInquiryRate',
      )
      .addSelect(
        `ROUND(100.0 * SUM(CASE WHEN b.status = 'APPROVED' AND b.mgrEvalFullCons = true THEN 1 ELSE 0 END) / :totalDays, 2)`,
        'fullConsultationRate',
      )
      .addSelect(
        `ROUND(100.0 * SUM(CASE WHEN b.status = 'APPROVED' AND b.mgrEvalFollow = true THEN 1 ELSE 0 END) / :totalDays, 2)`,
        'followedThroughRate',
      )
      .addSelect('MAX(b.managerFeedback)', 'managerFeedback')
      .where('b.logDate BETWEEN :startDate AND :endDate', {
        startDate: week.startDate,
        endDate: week.endDate,
      })
      .setParameter('totalDays', totalDays);

    if (currentUser.role === Role.MANAGER) {
      qb.andWhere('u.unitId = :unitId', { unitId: currentUser.unitId });
    }

    const items = await qb
      .groupBy('b.userId')
      .addGroupBy('u.fullName')
      .orderBy('u.fullName', 'ASC')
      .getRawMany();

    return {
      week,
      totalDays,
      items,
    };
  }

  async getWeeklyConfigs() {
    return this.weeklyConfigsRepository.find({
      order: {
        startDate: 'DESC',
      },
    });
  }

  async getWeeklyConfigsForUser() {
    return this.weeklyConfigsRepository.find({
      order: {
        startDate: 'DESC',
      },
    });
  }

  async submitWeeklyJournal(user: any, dto: SubmitWeeklyJournalDto) {
    if (user.role !== Role.EMPLOYEE) {
      throw new ForbiddenException('Chỉ nhân viên được nộp nhật ký hằng tuần');
    }
    const week = await this.weeklyConfigsRepository.findOne(dto.weekId);
    if (!week) {
      throw new NotFoundException('Không tìm thấy cấu hình tuần');
    }
    let entries = Array.isArray(dto.entries) ? dto.entries : [];
    if (dto.formType === WeeklyJournalFormType.FORM_10) {
      entries = entries.map((item) => ({
        highIncomeAction: String(item.highIncomeAction || '').trim(),
        result: String(item.result || '').trim(),
        feeling: String(item.feeling || '').trim(),
        review: String(item.review || '').trim(),
      }));
    } else {
      entries = entries.map((item) => ({
        bestValueArea: String(item.bestValueArea || '').trim(),
        incomeIncreaseBehavior: String(item.incomeIncreaseBehavior || '').trim(),
        backslideSign: String(item.backslideSign || '').trim(),
        nextWeekPlan: String(item.nextWeekPlan || '').trim(),
        review: String(item.review || '').trim(),
      }));
    }
    let row = await this.weeklyJournalLogsRepository.findOne({
      where: {
        userId: user.id,
        weekId: dto.weekId,
        formType: dto.formType,
      },
    });
    if (!row) {
      row = this.weeklyJournalLogsRepository.create({
        userId: user.id,
        weekId: dto.weekId,
        formType: dto.formType,
      });
    }
    row.entries = entries;
    row.submittedAt = new Date();
    const saved = await this.weeklyJournalLogsRepository.save(row);
    return {
      id: saved.id,
      weekId: saved.weekId,
      formType: saved.formType,
      submittedAt: saved.submittedAt,
      entries: saved.entries,
    };
  }

  async getWeeklyJournals(user: any, weekId: string) {
    if (user.role !== Role.EMPLOYEE) {
      throw new ForbiddenException('Chỉ nhân viên được xem nhật ký hằng tuần của mình');
    }
    if (!weekId) {
      throw new BadRequestException('Thiếu weekId');
    }
    const rows = await this.weeklyJournalLogsRepository.find({
      where: {
        userId: user.id,
        weekId,
      },
    });
    const form10 = rows.find((item) => item.formType === WeeklyJournalFormType.FORM_10);
    const form11 = rows.find((item) => item.formType === WeeklyJournalFormType.FORM_11);
    return {
      weekId,
      form10: form10
        ? {
            id: form10.id,
            submittedAt: form10.submittedAt,
            entries: form10.entries || [],
          }
        : null,
      form11: form11
        ? {
            id: form11.id,
            submittedAt: form11.submittedAt,
            entries: form11.entries || [],
          }
        : null,
    };
  }

  private async ensureValidWeeklyConfig(
    payload: { weekName?: string; startDate?: string; endDate?: string },
    excludeId?: string,
  ) {
    const weekName = String(payload.weekName || '').trim();
    const startDate = String(payload.startDate || '').slice(0, 10);
    const endDate = String(payload.endDate || '').slice(0, 10);
    if (!weekName || !startDate || !endDate) {
      throw new BadRequestException('Vui lòng nhập đủ tên tuần, ngày bắt đầu và ngày kết thúc');
    }
    if (startDate > endDate) {
      throw new BadRequestException('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc');
    }
    const existedName = await this.weeklyConfigsRepository.findOne({ weekName });
    if (existedName && existedName.id !== excludeId) {
      throw new BadRequestException('Tên tuần đã tồn tại');
    }
    const overlapQb = this.weeklyConfigsRepository
      .createQueryBuilder('w')
      .where(':startDate <= w.endDate AND :endDate >= w.startDate', {
        startDate,
        endDate,
      });
    if (excludeId) {
      overlapQb.andWhere('w.id <> :excludeId', { excludeId });
    }
    const overlap = await overlapQb.getOne();
    if (overlap) {
      throw new BadRequestException('Khoảng ngày bị trùng với tuần đã cấu hình');
    }
    return {
      weekName,
      startDate,
      endDate,
    };
  }

  async createWeeklyConfig(dto: CreateWeeklyConfigDto) {
    const payload = await this.ensureValidWeeklyConfig(dto);
    const week = this.weeklyConfigsRepository.create(payload);
    return this.weeklyConfigsRepository.save(week);
  }

  async updateWeeklyConfig(id: string, dto: UpdateWeeklyConfigDto) {
    const target = await this.weeklyConfigsRepository.findOne(id);
    if (!target) {
      throw new NotFoundException('Không tìm thấy tuần cần cập nhật');
    }
    const payload = await this.ensureValidWeeklyConfig(
      {
        weekName: dto.weekName ?? target.weekName,
        startDate: dto.startDate ?? target.startDate,
        endDate: dto.endDate ?? target.endDate,
      },
      target.id,
    );
    target.weekName = payload.weekName;
    target.startDate = payload.startDate;
    target.endDate = payload.endDate;
    return this.weeklyConfigsRepository.save(target);
  }

  async deleteWeeklyConfig(id: string) {
    const target = await this.weeklyConfigsRepository.findOne(id);
    if (!target) {
      throw new NotFoundException('Không tìm thấy tuần cần xóa');
    }
    await this.weeklyConfigsRepository.remove(target);
    return { success: true };
  }
}
