import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/common/enums/role.enum';
import { Journal } from 'src/journals/entities/journal.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import {
  BehaviorChecklistLog,
  BehaviorChecklistStatus,
} from './entities/behavior-checklist-log.entity';
import { BeliefTransformationLog } from './entities/belief-transformation-log.entity';
import { CareerCommitmentLog } from './entities/career-commitment-log.entity';
import { DailyFormEditLog } from './entities/daily-form-edit-log.entity';
import { DailyFormReview } from './entities/daily-form-review.entity';
import { EndOfDayLog } from './entities/end-of-day-log.entity';
import { IncomeBreakthroughLog } from './entities/income-breakthrough-log.entity';
import { JourneyPhaseConfig } from './entities/journey-phase-config.entity';
import { MindsetLog } from './entities/mindset-log.entity';
import { Phase3StandardLog } from './entities/phase-3-standard-log.entity';
import { SalesActivityReport } from './entities/sales-activity-report.entity';
import { SystemConfig } from './entities/system-config.entity';
import { WeeklyConfig } from './entities/weekly-config.entity';
import { WeeklyJournalLog } from './entities/weekly-journal-log.entity';
import { EvaluateBehaviorLogDto } from './dto/evaluate-behavior-log.dto';
import { ReviewDailyFormsDto } from './dto/review-daily-forms.dto';
import { BehaviorFormType, SubmitLogDto } from './dto/submit-log.dto';
import { CreateWeeklyConfigDto } from './dto/create-weekly-config.dto';
import { SubmitWeeklyJournalDto, WeeklyJournalFormType } from './dto/submit-weekly-journal.dto';
import { UpsertJourneyPhaseConfigDto } from './dto/upsert-journey-phase-config.dto';
import { UpdateWeeklyConfigDto } from './dto/update-weekly-config.dto';
import { validateActionTimeForDate } from '../common/utils/time-validator.util';
import { Evaluation } from '../evaluations/entities/evaluation.entity';
import { BusinessTimeUtil } from '../common/utils/business-time.util';

import { SaveWeeklyReportDto } from './dto/save-weekly-report.dto';
import { WeeklyReportSubmission } from './entities/weekly-report-submission.entity';

@Injectable()
export class BehaviorService implements OnModuleInit {
  private parseLockedEntryDates(value?: string | null): string[] {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
  }

  private normalizeLockedEntryDates(values?: string[]): string[] {
    const set = new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => String(item || '').trim())
        .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)),
    );
    return [...set].sort();
  }

  constructor(
    @InjectRepository(Journal)
    private readonly journalsRepository: Repository<Journal>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Evaluation)
    private readonly evaluationsRepository: Repository<Evaluation>,
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
    @InjectRepository(Phase3StandardLog)
    private readonly phase3StandardLogsRepository: Repository<Phase3StandardLog>,
    @InjectRepository(IncomeBreakthroughLog)
    private readonly incomeBreakthroughLogsRepository: Repository<IncomeBreakthroughLog>,
    @InjectRepository(CareerCommitmentLog)
    private readonly careerCommitmentLogsRepository: Repository<CareerCommitmentLog>,
    @InjectRepository(JourneyPhaseConfig)
    private readonly journeyPhaseConfigsRepository: Repository<JourneyPhaseConfig>,
    @InjectRepository(DailyFormReview)
    private readonly dailyFormReviewsRepository: Repository<DailyFormReview>,
    @InjectRepository(DailyFormEditLog)
    private readonly dailyFormEditLogsRepository: Repository<DailyFormEditLog>,
    @InjectRepository(WeeklyJournalLog)
    private readonly weeklyJournalLogsRepository: Repository<WeeklyJournalLog>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigsRepository: Repository<SystemConfig>,
    @InjectRepository(WeeklyReportSubmission)
    private readonly weeklyReportSubmissionsRepository: Repository<WeeklyReportSubmission>,
  ) {}

  async onModuleInit() {
    const config = await this.systemConfigsRepository.findOne({ where: { key: 'CUTOFF_HOUR' } });
    if (config && !isNaN(Number(config.value))) {
      BusinessTimeUtil.CUTOFF_HOUR = Number(config.value);
    }
    const managerConfig = await this.systemConfigsRepository.findOne({ where: { key: 'CUTOFF_HOUR_MANAGER' } });
    if (managerConfig && !isNaN(Number(managerConfig.value))) {
      BusinessTimeUtil.CUTOFF_HOUR_MANAGER = Number(managerConfig.value);
    }
    const disableConfig = await this.systemConfigsRepository.findOne({ where: { key: 'DISABLE_CROSS_TIME_MANAGER' } });
    if (disableConfig) {
      BusinessTimeUtil.DISABLE_CROSS_TIME_MANAGER = disableConfig.value === 'true';
    }
    const lockedDatesConfig = await this.systemConfigsRepository.findOne({ where: { key: 'LOCKED_ENTRY_DATES' } });
    BusinessTimeUtil.LOCKED_ENTRY_DATES = new Set(
      this.parseLockedEntryDates(lockedDatesConfig?.value),
    );
  }

  async submitLog(user: any, dto: SubmitLogDto) {
    const logDate = this.resolveLogDate(dto.logDate);
    validateActionTimeForDate(logDate, 'Nhập nhật ký hằng ngày');

    // Kiểm tra trạng thái duyệt của Quản lý trước
    const review = await this.dailyFormReviewsRepository.findOne({
      where: { userId: user.id, logDate, formType: dto.formType }
    });
    if (review && review.status === 'APPROVED') {
      throw new ForbiddenException('Quản lý đã duyệt biểu mẫu này, bạn không thể chỉnh sửa nữa.');
    }

    // Ensure journal exists
    let journal = await this.journalsRepository.findOne({ userId: user.id, reportDate: logDate });
    if (!journal) {
      journal = this.journalsRepository.create({ userId: user.id, reportDate: logDate });
      await this.journalsRepository.save(journal);
    }

    let result;
    if (dto.formType === BehaviorFormType.FORM_1) {
      result = await this.submitForm1(user.id, dto);
    } else if (dto.formType === BehaviorFormType.FORM_2) {
      result = await this.submitForm2(user.id, dto);
    } else if (dto.formType === BehaviorFormType.FORM_3) {
      result = await this.submitForm3(user.id, dto);
    } else if (dto.formType === BehaviorFormType.FORM_4) {
      result = await this.submitForm4(user.id, dto);
    } else if (dto.formType === BehaviorFormType.FORM_5) {
      result = await this.submitForm5(user.id, dto);
    } else if (dto.formType === BehaviorFormType.FORM_7) {
      result = await this.submitForm7(user.id, dto);
    } else if (dto.formType === BehaviorFormType.FORM_8) {
      result = await this.submitForm8(user.id, dto);
    } else if (dto.formType === BehaviorFormType.FORM_9) {
      result = await this.submitForm9(user.id, dto);
    } else {
      result = await this.submitForm12(user.id, dto);
    }

    if (dto.formType !== BehaviorFormType.FORM_1 && dto.formType !== BehaviorFormType.FORM_2) {
      await this.upsertDailyReview(user.id, logDate, dto.formType, 'PENDING', null);
    }
    
    return result;
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
    if (record?.isShared) {
      throw new ForbiddenException('Biểu mẫu đã được chia sẻ qua Telegram nên không thể chỉnh sửa thêm');
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
    if (record?.isShared) {
      throw new ForbiddenException('Biểu mẫu đã được chia sẻ qua Telegram nên không thể chỉnh sửa thêm');
    }
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
    const existing = await this.salesActivityReportsRepository.findOne({ userId, logDate });
    if (existing?.isShared) {
      throw new ForbiddenException('Biểu mẫu đã được chia sẻ qua Telegram nên không thể chỉnh sửa thêm');
    }
    
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
    if (record?.isShared) {
      throw new ForbiddenException('Biểu mẫu đã được chia sẻ qua Telegram nên không thể chỉnh sửa thêm');
    }
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
    const existing = await this.beliefTransformationLogsRepository.findOne({ userId, logDate });
    if (existing?.isShared) {
      throw new ForbiddenException('Biểu mẫu đã được chia sẻ qua Telegram nên không thể chỉnh sửa thêm');
    }
    
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

  private async submitForm7(userId: string, dto: SubmitLogDto) {
    const logDate = this.resolveLogDate(dto.logDate);
    let record = await this.phase3StandardLogsRepository.findOne({ userId, logDate });
    if (!record) {
      record = this.phase3StandardLogsRepository.create({ userId, logDate });
    }
    record.keptStandard = dto.keptStandard || '';
    record.backslideSign = dto.backslideSign || '';
    record.solution = dto.phase3Solution || '';
    return this.phase3StandardLogsRepository.save(record);
  }

  private async submitForm9(userId: string, dto: SubmitLogDto) {
    const logDate = this.resolveLogDate(dto.logDate);
    let record = await this.incomeBreakthroughLogsRepository.findOne({ userId, logDate });
    if (!record) {
      record = this.incomeBreakthroughLogsRepository.create({ userId, logDate });
    }
    record.selfLimitArea = dto.selfLimitArea || '';
    record.proofBehavior = dto.proofBehavior || '';
    record.raiseStandard = dto.raiseStandard || '';
    record.actionPlan = dto.actionPlan || '';
    return this.incomeBreakthroughLogsRepository.save(record);
  }

  private async submitForm12(userId: string, dto: SubmitLogDto) {
    const logDate = this.resolveLogDate(dto.logDate);
    let record = await this.careerCommitmentLogsRepository.findOne({ userId, logDate });
    if (!record) {
      record = this.careerCommitmentLogsRepository.create({ userId, logDate });
    }
    record.declarationText = dto.declarationText || '';
    record.commitmentSignature = dto.commitmentSignature || '';
    return this.careerCommitmentLogsRepository.save(record);
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
    const reviews = await this.dailyFormReviewsRepository.find({ userId, logDate });
    const reviewsByFormType = reviews.reduce(
      (acc, item) => ({
        ...acc,
        [item.formType]: {
          status: item.status,
          managerNote: item.managerNote || '',
          reviewedBy: item.reviewedBy,
          reviewedAt: item.reviewedAt,
        },
      }),
      {},
    );
    return {
      form2: await this.behaviorChecklistLogsRepository.findOne({ userId, logDate }),
      form3: await this.mindsetLogsRepository.findOne({ userId, logDate }),
      form4: await this.salesActivityReportsRepository.find({ userId, logDate }),
      form5: await this.endOfDayLogsRepository.findOne({ userId, logDate }),
      form7: await this.phase3StandardLogsRepository.findOne({ userId, logDate }),
      form8: await this.beliefTransformationLogsRepository.find({ userId, logDate }),
      form9: await this.incomeBreakthroughLogsRepository.findOne({ userId, logDate }),
      form12: await this.careerCommitmentLogsRepository.findOne({ userId, logDate }),
      reviews: reviewsByFormType,
    };
  }

  private async upsertDailyReview(
    userId: string,
    logDate: string,
    formType: string,
    status: string,
    managerId: string | null,
  ) {
    let review = await this.dailyFormReviewsRepository.findOne({ userId, logDate, formType });
    if (!review) {
      review = this.dailyFormReviewsRepository.create({ userId, logDate, formType });
    }
    review.status = status;
    if (managerId) {
      review.reviewedBy = managerId;
      review.reviewedAt = new Date();
    } else if (status === 'PENDING') {
      review.reviewedBy = null as any;
      review.reviewedAt = null as any;
    }
    await this.dailyFormReviewsRepository.save(review);
  }

  private normalizeLogValue(value: any) {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  }

  private addEditLog(
    logs: DailyFormEditLog[],
    params: {
      journalId: string;
      userId: string;
      logDate: string;
      formType: string;
      fieldKey: string;
      beforeValue: any;
      afterValue: any;
      editedBy: string;
      editedAt: Date;
    },
  ) {
    const beforeText = this.normalizeLogValue(params.beforeValue);
    const afterText = this.normalizeLogValue(params.afterValue);
    if (beforeText === afterText) {
      return;
    }
    logs.push(
      this.dailyFormEditLogsRepository.create({
        journalId: params.journalId,
        userId: params.userId,
        logDate: params.logDate,
        formType: params.formType,
        fieldKey: params.fieldKey,
        beforeValue: beforeText,
        afterValue: afterText,
        editedBy: params.editedBy,
        editedAt: params.editedAt,
      }),
    );
  }

  async reviewDailyForms(currentUser: any, dto: ReviewDailyFormsDto) {
    if (currentUser.role !== Role.MANAGER && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ quản lý/admin được sửa và duyệt nhật ký ngày');
    }
    const journal = await this.journalsRepository.findOne(dto.journalId);
    if (!journal) {
      throw new NotFoundException('Không tìm thấy nhật ký');
    }
    const employee = await this.usersRepository.findOne(journal.userId);
    if (!employee) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }
    
    validateActionTimeForDate(journal.reportDate, 'Duyệt và sửa nhật ký', false, currentUser.role);

    if (currentUser.role === Role.MANAGER && employee.unitId !== currentUser.unitId) {
      throw new ForbiddenException('Bạn không có quyền xử lý nhân viên khác đơn vị');
    }

    const editLogs: DailyFormEditLog[] = [];
    const editedAt = new Date();
    if (dto.avoidance !== undefined) {
      this.addEditLog(editLogs, {
        journalId: journal.id,
        userId: journal.userId,
        logDate: journal.reportDate,
        formType: 'FORM_1_AWARENESS',
        fieldKey: 'avoidance',
        beforeValue: journal.avoidance,
        afterValue: dto.avoidance,
        editedBy: currentUser.id,
        editedAt,
      });
      journal.avoidance = dto.avoidance;
    }
    if (dto.selfLimit !== undefined) {
      this.addEditLog(editLogs, {
        journalId: journal.id,
        userId: journal.userId,
        logDate: journal.reportDate,
        formType: 'FORM_1_AWARENESS',
        fieldKey: 'selfLimit',
        beforeValue: journal.selfLimit,
        afterValue: dto.selfLimit,
        editedBy: currentUser.id,
        editedAt,
      });
      journal.selfLimit = dto.selfLimit;
    }
    if (dto.earlyStop !== undefined) {
      this.addEditLog(editLogs, {
        journalId: journal.id,
        userId: journal.userId,
        logDate: journal.reportDate,
        formType: 'FORM_1_AWARENESS',
        fieldKey: 'earlyStop',
        beforeValue: journal.earlyStop,
        afterValue: dto.earlyStop,
        editedBy: currentUser.id,
        editedAt,
      });
      journal.earlyStop = dto.earlyStop;
    }
    if (dto.blaming !== undefined) {
      this.addEditLog(editLogs, {
        journalId: journal.id,
        userId: journal.userId,
        logDate: journal.reportDate,
        formType: 'FORM_1_AWARENESS',
        fieldKey: 'blaming',
        beforeValue: journal.blaming,
        afterValue: dto.blaming,
        editedBy: currentUser.id,
        editedAt,
      });
      journal.blaming = dto.blaming;
    }
    if (dto.standardsKeptText !== undefined) {
      this.addEditLog(editLogs, {
        journalId: journal.id,
        userId: journal.userId,
        logDate: journal.reportDate,
        formType: 'FORM_1_STANDARDS',
        fieldKey: 'standardsKeptText',
        beforeValue: journal.standardsKeptText,
        afterValue: dto.standardsKeptText,
        editedBy: currentUser.id,
        editedAt,
      });
      journal.standardsKeptText = dto.standardsKeptText;
    }
    if (dto.backslideSigns !== undefined) {
      this.addEditLog(editLogs, {
        journalId: journal.id,
        userId: journal.userId,
        logDate: journal.reportDate,
        formType: 'FORM_1_STANDARDS',
        fieldKey: 'backslideSigns',
        beforeValue: journal.backslideSigns,
        afterValue: dto.backslideSigns,
        editedBy: currentUser.id,
        editedAt,
      });
      journal.backslideSigns = dto.backslideSigns;
    }
    if (dto.solution !== undefined) {
      this.addEditLog(editLogs, {
        journalId: journal.id,
        userId: journal.userId,
        logDate: journal.reportDate,
        formType: 'FORM_1_STANDARDS',
        fieldKey: 'solution',
        beforeValue: journal.solution,
        afterValue: dto.solution,
        editedBy: currentUser.id,
        editedAt,
      });
      journal.solution = dto.solution;
    }
    await this.journalsRepository.save(journal);

    if (
      dto.form3NegativeThought !== undefined ||
      dto.form3NewMindset !== undefined ||
      dto.form3BehaviorChange !== undefined
    ) {
      let row = await this.mindsetLogsRepository.findOne({ userId: journal.userId, logDate: journal.reportDate });
      if (!row) {
        row = this.mindsetLogsRepository.create({ userId: journal.userId, logDate: journal.reportDate });
      }
      if (dto.form3NegativeThought !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_3', fieldKey: 'negativeThought', beforeValue: row.negativeThought, afterValue: dto.form3NegativeThought, editedBy: currentUser.id, editedAt });
        row.negativeThought = dto.form3NegativeThought;
      }
      if (dto.form3NewMindset !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_3', fieldKey: 'newMindset', beforeValue: row.newMindset, afterValue: dto.form3NewMindset, editedBy: currentUser.id, editedAt });
        row.newMindset = dto.form3NewMindset;
      }
      if (dto.form3BehaviorChange !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_3', fieldKey: 'behaviorChange', beforeValue: row.behaviorChange, afterValue: dto.form3BehaviorChange, editedBy: currentUser.id, editedAt });
        row.behaviorChange = dto.form3BehaviorChange;
      }
      await this.mindsetLogsRepository.save(row);
    }

    if (dto.form4Rows !== undefined) {
      const beforeRows = await this.salesActivityReportsRepository.find({ userId: journal.userId, logDate: journal.reportDate });
      this.addEditLog(editLogs, {
        journalId: journal.id,
        userId: journal.userId,
        logDate: journal.reportDate,
        formType: 'FORM_4',
        fieldKey: 'rows',
        beforeValue: beforeRows || [],
        afterValue: dto.form4Rows || [],
        editedBy: currentUser.id,
        editedAt,
      });
      await this.salesActivityReportsRepository.delete({ userId: journal.userId, logDate: journal.reportDate });
      const rows = (dto.form4Rows || []).map((item) =>
        this.salesActivityReportsRepository.create({
          userId: journal.userId,
          logDate: journal.reportDate,
          customerName: item.customerName || '',
          customerIssue: item.customerIssue || '',
          consequence: item.consequence || '',
          solutionOffered: item.solutionOffered || '',
          valueBasedPricing: item.valueBasedPricing || '',
          result: item.result || '',
        }),
      );
      if (rows.length > 0) {
        await this.salesActivityReportsRepository.save(rows);
      }
    }

    if (dto.form5TomorrowLesson !== undefined || dto.form5DifferentAction !== undefined) {
      let row = await this.endOfDayLogsRepository.findOne({ userId: journal.userId, logDate: journal.reportDate });
      if (!row) {
        row = this.endOfDayLogsRepository.create({ userId: journal.userId, logDate: journal.reportDate });
      }
      if (dto.form5TomorrowLesson !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_5', fieldKey: 'tomorrowLesson', beforeValue: row.tomorrowLesson, afterValue: dto.form5TomorrowLesson, editedBy: currentUser.id, editedAt });
        row.tomorrowLesson = dto.form5TomorrowLesson;
      }
      if (dto.form5DifferentAction !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_5', fieldKey: 'differentAction', beforeValue: row.differentAction, afterValue: dto.form5DifferentAction, editedBy: currentUser.id, editedAt });
        row.differentAction = dto.form5DifferentAction;
      }
      await this.endOfDayLogsRepository.save(row);
    }

    if (dto.form7KeptStandard !== undefined || dto.form7BackslideSign !== undefined || dto.form7Solution !== undefined) {
      let row = await this.phase3StandardLogsRepository.findOne({ userId: journal.userId, logDate: journal.reportDate });
      if (!row) {
        row = this.phase3StandardLogsRepository.create({ userId: journal.userId, logDate: journal.reportDate });
      }
      if (dto.form7KeptStandard !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_7', fieldKey: 'keptStandard', beforeValue: row.keptStandard, afterValue: dto.form7KeptStandard, editedBy: currentUser.id, editedAt });
        row.keptStandard = dto.form7KeptStandard;
      }
      if (dto.form7BackslideSign !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_7', fieldKey: 'backslideSign', beforeValue: row.backslideSign, afterValue: dto.form7BackslideSign, editedBy: currentUser.id, editedAt });
        row.backslideSign = dto.form7BackslideSign;
      }
      if (dto.form7Solution !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_7', fieldKey: 'solution', beforeValue: row.solution, afterValue: dto.form7Solution, editedBy: currentUser.id, editedAt });
        row.solution = dto.form7Solution;
      }
      await this.phase3StandardLogsRepository.save(row);
    }

    if (dto.form8Rows !== undefined) {
      const beforeRows = await this.beliefTransformationLogsRepository.find({ userId: journal.userId, logDate: journal.reportDate });
      this.addEditLog(editLogs, {
        journalId: journal.id,
        userId: journal.userId,
        logDate: journal.reportDate,
        formType: 'FORM_8',
        fieldKey: 'rows',
        beforeValue: beforeRows || [],
        afterValue: dto.form8Rows || [],
        editedBy: currentUser.id,
        editedAt,
      });
      await this.beliefTransformationLogsRepository.delete({ userId: journal.userId, logDate: journal.reportDate });
      const rows = (dto.form8Rows || []).map((item) =>
        this.beliefTransformationLogsRepository.create({
          userId: journal.userId,
          logDate: journal.reportDate,
          situation: item.situation || '',
          oldBelief: item.oldBelief || '',
          newChosenBelief: item.newChosenBelief || '',
          newBehavior: item.newBehavior || '',
          result: item.result || '',
        }),
      );
      if (rows.length > 0) {
        await this.beliefTransformationLogsRepository.save(rows);
      }
    }

    if (
      dto.form9SelfLimitArea !== undefined ||
      dto.form9ProofBehavior !== undefined ||
      dto.form9RaiseStandard !== undefined ||
      dto.form9ActionPlan !== undefined
    ) {
      let row = await this.incomeBreakthroughLogsRepository.findOne({ userId: journal.userId, logDate: journal.reportDate });
      if (!row) {
        row = this.incomeBreakthroughLogsRepository.create({ userId: journal.userId, logDate: journal.reportDate });
      }
      if (dto.form9SelfLimitArea !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_9', fieldKey: 'selfLimitArea', beforeValue: row.selfLimitArea, afterValue: dto.form9SelfLimitArea, editedBy: currentUser.id, editedAt });
        row.selfLimitArea = dto.form9SelfLimitArea;
      }
      if (dto.form9ProofBehavior !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_9', fieldKey: 'proofBehavior', beforeValue: row.proofBehavior, afterValue: dto.form9ProofBehavior, editedBy: currentUser.id, editedAt });
        row.proofBehavior = dto.form9ProofBehavior;
      }
      if (dto.form9RaiseStandard !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_9', fieldKey: 'raiseStandard', beforeValue: row.raiseStandard, afterValue: dto.form9RaiseStandard, editedBy: currentUser.id, editedAt });
        row.raiseStandard = dto.form9RaiseStandard;
      }
      if (dto.form9ActionPlan !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_9', fieldKey: 'actionPlan', beforeValue: row.actionPlan, afterValue: dto.form9ActionPlan, editedBy: currentUser.id, editedAt });
        row.actionPlan = dto.form9ActionPlan;
      }
      await this.incomeBreakthroughLogsRepository.save(row);
    }

    if (dto.form12DeclarationText !== undefined || dto.form12CommitmentSignature !== undefined) {
      let row = await this.careerCommitmentLogsRepository.findOne({ userId: journal.userId, logDate: journal.reportDate });
      if (!row) {
        row = this.careerCommitmentLogsRepository.create({ userId: journal.userId, logDate: journal.reportDate });
      }
      if (dto.form12DeclarationText !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_12', fieldKey: 'declarationText', beforeValue: row.declarationText, afterValue: dto.form12DeclarationText, editedBy: currentUser.id, editedAt });
        row.declarationText = dto.form12DeclarationText;
      }
      if (dto.form12CommitmentSignature !== undefined) {
        this.addEditLog(editLogs, { journalId: journal.id, userId: journal.userId, logDate: journal.reportDate, formType: 'FORM_12', fieldKey: 'commitmentSignature', beforeValue: row.commitmentSignature, afterValue: dto.form12CommitmentSignature, editedBy: currentUser.id, editedAt });
        row.commitmentSignature = dto.form12CommitmentSignature;
      }
      await this.careerCommitmentLogsRepository.save(row);
    }

    const statuses = dto.statuses || {};
    const map = [
      ['form1Awareness', 'FORM_1_AWARENESS'],
      ['form1Standards', 'FORM_1_STANDARDS'],
      ['form3', 'FORM_3'],
      ['form4', 'FORM_4'],
      ['form5', 'FORM_5'],
      ['form7', 'FORM_7'],
      ['form8', 'FORM_8'],
      ['form9', 'FORM_9'],
      ['form12', 'FORM_12'],
    ] as const;
    for (const [key, formType] of map) {
      const status = statuses[key];
      if (status) {
        await this.upsertDailyReview(journal.userId, journal.reportDate, formType, status, currentUser.id);

        // Sync with evaluations if it's FORM_1_AWARENESS or FORM_1_STANDARDS
        if ((formType === 'FORM_1_AWARENESS' || formType === 'FORM_1_STANDARDS') && status === 'APPROVED') {
          let evaluation = await this.evaluationsRepository.findOne({ journalId: journal.id });
          if (!evaluation) {
            evaluation = this.evaluationsRepository.create({
              journalId: journal.id,
              managerId: currentUser.id,
              awarenessReviewed: false,
              standardsReviewed: false,
            });
          }
          if (formType === 'FORM_1_AWARENESS') {
            evaluation.awarenessReviewed = true;
          }
          if (formType === 'FORM_1_STANDARDS') {
            evaluation.standardsReviewed = true;
          }
          await this.evaluationsRepository.save(evaluation);
        }
      }
    }
    if (editLogs.length > 0) {
      await this.dailyFormEditLogsRepository.save(editLogs);
    }
    return { success: true };
  }

  async getJourneyPhaseConfigs() {
    const rows = await this.journeyPhaseConfigsRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', startDate: 'ASC' },
    });
    return rows.map((item) => ({
      id: item.id,
      phaseCode: item.phaseCode,
      phaseName: item.phaseName,
      startDate: item.startDate,
      endDate: item.endDate,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      allowedForms: item.allowedForms || [],
    }));
  }

  async getJourneyPhaseConfigsForAdmin() {
    return this.journeyPhaseConfigsRepository.find({
      order: { sortOrder: 'ASC', startDate: 'ASC' },
    });
  }

  async upsertJourneyPhaseConfig(id: string | null, dto: UpsertJourneyPhaseConfigDto) {
    if (dto.startDate && dto.endDate && new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc');
    }
    let item = id ? await this.journeyPhaseConfigsRepository.findOne(id) : null;
    if (!item) {
      item = this.journeyPhaseConfigsRepository.create();
    }
    item.phaseCode = String(dto.phaseCode || '').trim().toUpperCase();
    item.phaseName = String(dto.phaseName || '').trim();
    item.startDate = dto.startDate || null;
    item.endDate = dto.endDate || null;
    item.sortOrder = Number(dto.sortOrder || 1);
    item.isActive = dto.isActive !== false;
    if (dto.allowedForms) {
      item.allowedForms = dto.allowedForms;
    }
    return this.journeyPhaseConfigsRepository.save(item);
  }

  async getCutoffTime() {
    const config = await this.systemConfigsRepository.findOne({ where: { key: 'CUTOFF_HOUR' } });
    const managerConfig = await this.systemConfigsRepository.findOne({ where: { key: 'CUTOFF_HOUR_MANAGER' } });
    return { 
      hour: config ? Number(config.value) : 7,
      hourManager: managerConfig ? Number(managerConfig.value) : 7
    };
  }

  async getSystemConfigs() {
    const cutoffConfig = await this.systemConfigsRepository.findOne({ where: { key: 'CUTOFF_HOUR' } });
    const cutoffManagerConfig = await this.systemConfigsRepository.findOne({ where: { key: 'CUTOFF_HOUR_MANAGER' } });
    const disableConfig = await this.systemConfigsRepository.findOne({ where: { key: 'DISABLE_CROSS_TIME_MANAGER' } });
    const lockedDatesConfig = await this.systemConfigsRepository.findOne({ where: { key: 'LOCKED_ENTRY_DATES' } });
    return {
      cutoffHour: cutoffConfig ? Number(cutoffConfig.value) : 7,
      cutoffHourManager: cutoffManagerConfig ? Number(cutoffManagerConfig.value) : 7,
      disableCrossTimeManager: disableConfig ? disableConfig.value === 'true' : false,
      lockedEntryDates: this.parseLockedEntryDates(lockedDatesConfig?.value),
    };
  }

  async updateSystemConfigs(payload: { cutoffHour?: number, cutoffHourManager?: number, disableCrossTimeManager?: boolean, lockedEntryDates?: string[] }) {
    if (payload.cutoffHour !== undefined) {
      if (isNaN(payload.cutoffHour) || payload.cutoffHour < 0 || payload.cutoffHour > 23) {
        throw new BadRequestException('Giờ cắt ngày cho nhân viên phải là số từ 0 đến 23');
      }
      let config = await this.systemConfigsRepository.findOne({ where: { key: 'CUTOFF_HOUR' } });
      if (!config) {
        config = this.systemConfigsRepository.create({ key: 'CUTOFF_HOUR' });
      }
      config.value = String(payload.cutoffHour);
      await this.systemConfigsRepository.save(config);
      BusinessTimeUtil.CUTOFF_HOUR = payload.cutoffHour;
    }

    if (payload.cutoffHourManager !== undefined) {
      if (isNaN(payload.cutoffHourManager) || payload.cutoffHourManager < 0 || payload.cutoffHourManager > 23) {
        throw new BadRequestException('Giờ cắt ngày cho quản lý phải là số từ 0 đến 23');
      }
      let config = await this.systemConfigsRepository.findOne({ where: { key: 'CUTOFF_HOUR_MANAGER' } });
      if (!config) {
        config = this.systemConfigsRepository.create({ key: 'CUTOFF_HOUR_MANAGER' });
      }
      config.value = String(payload.cutoffHourManager);
      await this.systemConfigsRepository.save(config);
      BusinessTimeUtil.CUTOFF_HOUR_MANAGER = payload.cutoffHourManager;
    }

    if (payload.disableCrossTimeManager !== undefined) {
      let config = await this.systemConfigsRepository.findOne({ where: { key: 'DISABLE_CROSS_TIME_MANAGER' } });
      if (!config) {
        config = this.systemConfigsRepository.create({ key: 'DISABLE_CROSS_TIME_MANAGER' });
      }
      config.value = payload.disableCrossTimeManager ? 'true' : 'false';
      await this.systemConfigsRepository.save(config);
      BusinessTimeUtil.DISABLE_CROSS_TIME_MANAGER = payload.disableCrossTimeManager;
    }

    if (payload.lockedEntryDates !== undefined) {
      const normalizedDates = this.normalizeLockedEntryDates(payload.lockedEntryDates);
      let config = await this.systemConfigsRepository.findOne({ where: { key: 'LOCKED_ENTRY_DATES' } });
      if (!config) {
        config = this.systemConfigsRepository.create({ key: 'LOCKED_ENTRY_DATES' });
      }
      config.value = normalizedDates.join(',');
      await this.systemConfigsRepository.save(config);
      BusinessTimeUtil.LOCKED_ENTRY_DATES = new Set(normalizedDates);
    }

    return { message: 'Đã cập nhật cấu hình hệ thống' };
  }

  async updateCutoffTime(hour: number) {
    if (hour < 0 || hour > 23) {
      throw new BadRequestException('Giờ cắt ngày phải từ 0 đến 23');
    }
    let config = await this.systemConfigsRepository.findOne({ where: { key: 'CUTOFF_HOUR' } });
    if (!config) {
      config = this.systemConfigsRepository.create({ key: 'CUTOFF_HOUR' });
    }
    config.value = String(hour);
    await this.systemConfigsRepository.save(config);
    
    // Cập nhật cấu hình hiện tại trong bộ nhớ
    BusinessTimeUtil.CUTOFF_HOUR = hour;
    
    return { success: true, hour };
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

  async getApprovedJournals(
    currentUser: any,
    filters: { fromDate?: string; toDate?: string; unitId?: string; keyword?: string },
  ) {
    let query = `
      SELECT 
        j.id AS "id",
        j."reportDate" AS "reportDate",
        u.id AS "userId",
        u."fullName" AS "fullName",
        u.username AS "username",
        u."unitId" AS "unitId",
        STRING_AGG(DISTINCT sub.form_type, ',') AS "approvedFormsText"
      FROM journals j
      INNER JOIN users u ON u.id = j."userId"
      LEFT JOIN units un ON un.id = u."unitId"
      INNER JOIN (
        SELECT user_id::uuid AS user_id, log_date, form_type 
        FROM daily_form_reviews 
        WHERE status = 'APPROVED'
        UNION
        SELECT j2."userId" AS user_id, j2."reportDate" AS log_date, 'FORM_1_AWARENESS' AS form_type 
        FROM evaluations e 
        INNER JOIN journals j2 ON j2.id = e."journalId" 
        WHERE e."awarenessReviewed" = true
        UNION
        SELECT j2."userId" AS user_id, j2."reportDate" AS log_date, 'FORM_1_STANDARDS' AS form_type 
        FROM evaluations e 
        INNER JOIN journals j2 ON j2.id = e."journalId" 
        WHERE e."standardsReviewed" = true
        UNION
        SELECT user_id::uuid AS user_id, log_date, 'FORM_2' AS form_type 
        FROM behavior_checklist_logs 
        WHERE status = 'APPROVED'
      ) sub ON sub.user_id = j."userId" AND sub.log_date = j."reportDate"
      WHERE u.role != 'ADMIN' AND (un."excludeFromStatistics" IS NULL OR un."excludeFromStatistics" = false)
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.fromDate) {
      query += ` AND j."reportDate" >= $${paramIndex++}`;
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      query += ` AND j."reportDate" <= $${paramIndex++}`;
      params.push(filters.toDate);
    }
    if (currentUser.role === Role.MANAGER) {
      query += ` AND u."unitId" = $${paramIndex++}`;
      params.push(currentUser.unitId);
    } else if (filters.unitId) {
      query += ` AND u."unitId" = $${paramIndex++}`;
      params.push(filters.unitId);
    }
    const keyword = String(filters.keyword || '').trim().toLowerCase();
    if (keyword) {
      query += ` AND (LOWER(u."fullName") LIKE $${paramIndex} OR LOWER(u.username) LIKE $${paramIndex++})`;
      params.push(`%${keyword}%`);
    }

    query += `
      GROUP BY j.id, j."reportDate", u.id, u."fullName", u.username, u."unitId"
      ORDER BY j."reportDate" DESC, u."fullName" ASC
    `;

    const rows = await this.journalsRepository.query(query, params);

    return rows.map((row) => ({
      id: row.id,
      reportDate: row.reportDate,
      user: {
        id: row.userId,
        fullName: row.fullName || '',
        username: row.username || '',
        unitId: row.unitId || '',
      },
      approvedForms: String(row.approvedFormsText || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    }));
  }

  async exportApprovedJournalsStatusFile(
    currentUser: any,
    filters: { reportDate: string; unitId?: string },
  ) {
    const reportDate = String(filters?.reportDate || '').slice(0, 10);
    if (!reportDate) {
      throw new BadRequestException('Thiếu reportDate');
    }

    let query = `
      WITH target_date AS (
        SELECT
          CAST($1 AS DATE) AS report_date,
          (CAST($1 AS DATE) + INTERVAL '8 hour') AS start_time,
          (CAST($1 AS DATE) + INTERVAL '1 day' + INTERVAL '8 hour') AS end_time
      ),
      form1_data AS (
        SELECT j."userId" AS user_id
        FROM journals j
        CROSS JOIN target_date t
        WHERE j."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh' >= t.start_time
          AND j."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh' < t.end_time
        GROUP BY j."userId"
      ),
      form3_data AS (
        SELECT m.user_id
        FROM mindset_logs m
        CROSS JOIN target_date t
        WHERE m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' >= t.start_time
          AND m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' < t.end_time
        GROUP BY m.user_id
      ),
      form8_data AS (
        SELECT b.user_id
        FROM belief_transformation_logs b
        CROSS JOIN target_date t
        WHERE b.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' >= t.start_time
          AND b.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' < t.end_time
        GROUP BY b.user_id
      ),
      reviews AS (
        SELECT
          user_id,
          MAX(CASE WHEN form_type IN ('FORM_1_AWARENESS', 'FORM_1_STANDARDS') AND status = 'APPROVED' THEN 1 ELSE 0 END) as form1_approved,
          MAX(CASE WHEN form_type = 'FORM_3' AND status = 'APPROVED' THEN 1 ELSE 0 END) as form3_approved,
          MAX(CASE WHEN form_type = 'FORM_8' AND status = 'APPROVED' THEN 1 ELSE 0 END) as form8_approved
        FROM daily_form_reviews
        CROSS JOIN target_date t
        WHERE log_date = t.report_date
        GROUP BY user_id
      )
      SELECT
        u.name AS "Tên đơn vị",
        e."fullName" AS "Tên nhân viên",
        e."employeeCode" AS "Mã nhân viên",
        TO_CHAR((SELECT report_date FROM target_date), 'DD/MM/YYYY') AS "Ngày thực hiện",
        CASE
          WHEN r.form1_approved = 1 THEN 'Đã duyệt'
          WHEN f1.user_id IS NOT NULL THEN 'Đã nhập'
          ELSE 'Chưa nhập'
        END AS "Mẫu 01",
        CASE
          WHEN r.form3_approved = 1 THEN 'Đã duyệt'
          WHEN f3.user_id IS NOT NULL THEN 'Đã nhập'
          ELSE 'Chưa nhập'
        END AS "Mẫu 03",
        CASE
          WHEN r.form8_approved = 1 THEN 'Đã duyệt'
          WHEN f8.user_id IS NOT NULL THEN 'Đã nhập'
          ELSE 'Chưa nhập'
        END AS "Mẫu 08"
      FROM users e
      JOIN units u ON e."unitId" = u.id
      LEFT JOIN form1_data f1 ON e.id = f1.user_id
      LEFT JOIN form3_data f3 ON e.id = f3.user_id
      LEFT JOIN form8_data f8 ON e.id = f8.user_id
      LEFT JOIN reviews r ON e.id = r.user_id::uuid
      WHERE e.role = 'EMPLOYEE'
        AND (u."excludeFromStatistics" IS NULL OR u."excludeFromStatistics" = false)
    `;

    const params: any[] = [reportDate];
    let paramIndex = 2;

    if (currentUser.role === Role.MANAGER) {
      query += ` AND e."unitId" = $${paramIndex++}`;
      params.push(currentUser.unitId);
    } else if (filters?.unitId) {
      query += ` AND e."unitId" = $${paramIndex++}`;
      params.push(filters.unitId);
    }

    query += ` ORDER BY u.name ASC, e."fullName" ASC`;

    const rows = await this.journalsRepository.query(query, params);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MauDaDuyet');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: `bao-cao-mau-da-duyet-${reportDate}.xlsx`,
    };
  }

  async exportApprovedJournalsStatusForms2345File(
    currentUser: any,
    filters: { reportDate: string; unitId?: string },
  ) {
    const reportDate = String(filters?.reportDate || '').slice(0, 10);
    if (!reportDate) {
      throw new BadRequestException('Thiếu reportDate');
    }

    let query = `
      WITH target_date AS (
        SELECT
          CAST($1 AS DATE) AS report_date,
          (CAST($1 AS DATE) + INTERVAL '8 hour') AS start_time,
          (CAST($1 AS DATE) + INTERVAL '1 day' + INTERVAL '8 hour') AS end_time
      ),
      form2_data AS (
        SELECT b.user_id
        FROM behavior_checklist_logs b
        CROSS JOIN target_date t
        WHERE b.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' >= t.start_time
          AND b.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' < t.end_time
        GROUP BY b.user_id
      ),
      form2_reviews AS (
        SELECT
          b.user_id,
          MAX(CASE WHEN b.status = 'APPROVED' THEN 1 ELSE 0 END) AS form2_approved
        FROM behavior_checklist_logs b
        CROSS JOIN target_date t
        WHERE b.log_date = t.report_date
        GROUP BY b.user_id
      ),
      form3_data AS (
        SELECT m.user_id
        FROM mindset_logs m
        CROSS JOIN target_date t
        WHERE m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' >= t.start_time
          AND m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' < t.end_time
        GROUP BY m.user_id
      ),
      form4_data AS (
        SELECT s.user_id
        FROM sales_activity_reports s
        CROSS JOIN target_date t
        WHERE s.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' >= t.start_time
          AND s.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' < t.end_time
        GROUP BY s.user_id
      ),
      form5_data AS (
        SELECT e.user_id
        FROM end_of_day_logs e
        CROSS JOIN target_date t
        WHERE e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' >= t.start_time
          AND e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' < t.end_time
        GROUP BY e.user_id
      ),
      reviews AS (
        SELECT
          user_id,
          MAX(CASE WHEN form_type = 'FORM_3' AND status = 'APPROVED' THEN 1 ELSE 0 END) AS form3_approved,
          MAX(CASE WHEN form_type = 'FORM_4' AND status = 'APPROVED' THEN 1 ELSE 0 END) AS form4_approved,
          MAX(CASE WHEN form_type = 'FORM_5' AND status = 'APPROVED' THEN 1 ELSE 0 END) AS form5_approved
        FROM daily_form_reviews
        CROSS JOIN target_date t
        WHERE log_date = t.report_date
        GROUP BY user_id
      )
      SELECT
        u.name AS "Tên đơn vị",
        e."fullName" AS "Tên nhân viên",
        e."employeeCode" AS "Mã nhân viên",
        TO_CHAR((SELECT report_date FROM target_date), 'DD/MM/YYYY') AS "Ngày thực hiện",
        CASE
          WHEN f2r.form2_approved = 1 THEN 'Đã duyệt'
          WHEN f2.user_id IS NOT NULL THEN 'Đã nhập'
          ELSE 'Chưa nhập'
        END AS "Mẫu 02",
        CASE
          WHEN r.form3_approved = 1 THEN 'Đã duyệt'
          WHEN f3.user_id IS NOT NULL THEN 'Đã nhập'
          ELSE 'Chưa nhập'
        END AS "Mẫu 03",
        CASE
          WHEN r.form4_approved = 1 THEN 'Đã duyệt'
          WHEN f4.user_id IS NOT NULL THEN 'Đã nhập'
          ELSE 'Chưa nhập'
        END AS "Mẫu 04",
        CASE
          WHEN r.form5_approved = 1 THEN 'Đã duyệt'
          WHEN f5.user_id IS NOT NULL THEN 'Đã nhập'
          ELSE 'Chưa nhập'
        END AS "Mẫu 05"
      FROM users e
      JOIN units u ON e."unitId" = u.id
      LEFT JOIN form2_data f2 ON e.id = f2.user_id
      LEFT JOIN form2_reviews f2r ON e.id = f2r.user_id
      LEFT JOIN form3_data f3 ON e.id = f3.user_id
      LEFT JOIN form4_data f4 ON e.id = f4.user_id
      LEFT JOIN form5_data f5 ON e.id = f5.user_id
      LEFT JOIN reviews r ON e.id = r.user_id::uuid
      WHERE e.role = 'EMPLOYEE'
        AND (u."excludeFromStatistics" IS NULL OR u."excludeFromStatistics" = false)
    `;

    const params: any[] = [reportDate];
    let paramIndex = 2;

    if (currentUser.role === Role.MANAGER) {
      query += ` AND e."unitId" = $${paramIndex++}`;
      params.push(currentUser.unitId);
    } else if (filters?.unitId) {
      query += ` AND e."unitId" = $${paramIndex++}`;
      params.push(filters.unitId);
    }

    query += ` ORDER BY u.name ASC, e."fullName" ASC`;

    const rows = await this.journalsRepository.query(query, params);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau2345');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: `bao-cao-trang-thai-mau-2-3-4-5-${reportDate}.xlsx`,
    };
  }

  async exportApprovedJournalsForms2345File(
    currentUser: any,
    filters: { fromDate?: string; toDate?: string; unitId?: string; keyword?: string },
  ) {
    let query = `
      WITH approved_form2 AS (
        SELECT b.user_id, b.log_date
        FROM behavior_checklist_logs b
        WHERE b.status = 'APPROVED'
      ),
      approved_form345 AS (
        SELECT d.user_id::uuid AS user_id, d.log_date, d.form_type
        FROM daily_form_reviews d
        WHERE d.status = 'APPROVED'
          AND d.form_type IN ('FORM_3', 'FORM_4', 'FORM_5')
      ),
      base_dates AS (
        SELECT user_id, log_date FROM approved_form2
        UNION
        SELECT user_id, log_date FROM approved_form345
      ),
      form4_agg AS (
        SELECT
          s.user_id,
          s.log_date,
          STRING_AGG(COALESCE(s.customer_name, ''), ' | ' ORDER BY s.created_at) AS customer_names,
          STRING_AGG(COALESCE(s.customer_issue, ''), ' | ' ORDER BY s.created_at) AS customer_issues,
          STRING_AGG(COALESCE(s.solution_offered, ''), ' | ' ORDER BY s.created_at) AS solutions,
          STRING_AGG(COALESCE(s.result, ''), ' | ' ORDER BY s.created_at) AS results
        FROM sales_activity_reports s
        GROUP BY s.user_id, s.log_date
      )
      SELECT
        TO_CHAR(base.log_date, 'YYYY-MM-DD') AS "Ngày",
        un.name AS "Tên đơn vị",
        u."fullName" AS "Tên nhân viên",
        u.username AS "Tài khoản",
        CASE WHEN f2.user_id IS NOT NULL THEN 'Đã duyệt' ELSE 'Chưa duyệt' END AS "Mẫu 2 - Trạng thái",
        COALESCE(f2.customer_met_count, 0) AS "Mẫu 2 - Số khách gặp",
        CASE WHEN COALESCE(f2.asked_deep_question, false) THEN 'Có' ELSE 'Không' END AS "Mẫu 2 - Hỏi sâu",
        CASE WHEN COALESCE(f2.full_consultation, false) THEN 'Có' ELSE 'Không' END AS "Mẫu 2 - Tư vấn đủ",
        CASE WHEN COALESCE(f2.followed_through, false) THEN 'Có' ELSE 'Không' END AS "Mẫu 2 - Theo đến cùng",
        COALESCE(f2.employee_notes, '') AS "Mẫu 2 - Ghi chú nhân viên",
        CASE WHEN r3.user_id IS NOT NULL THEN 'Đã duyệt' ELSE 'Chưa duyệt' END AS "Mẫu 3 - Trạng thái",
        COALESCE(m3.negative_thought, '') AS "Mẫu 3 - Suy nghĩ tiêu cực",
        COALESCE(m3.new_mindset, '') AS "Mẫu 3 - Tư duy mới",
        COALESCE(m3.behavior_change, '') AS "Mẫu 3 - Hành vi thay đổi",
        CASE WHEN r4.user_id IS NOT NULL THEN 'Đã duyệt' ELSE 'Chưa duyệt' END AS "Mẫu 4 - Trạng thái",
        COALESCE(f4.customer_names, '') AS "Mẫu 4 - Khách hàng",
        COALESCE(f4.customer_issues, '') AS "Mẫu 4 - Vấn đề khách hàng",
        COALESCE(f4.solutions, '') AS "Mẫu 4 - Giải pháp đề xuất",
        COALESCE(f4.results, '') AS "Mẫu 4 - Kết quả",
        CASE WHEN r5.user_id IS NOT NULL THEN 'Đã duyệt' ELSE 'Chưa duyệt' END AS "Mẫu 5 - Trạng thái",
        COALESCE(e5.tomorrow_lesson, '') AS "Mẫu 5 - Bài học ngày mai",
        COALESCE(e5.different_action, '') AS "Mẫu 5 - Việc làm khác đi"
      FROM base_dates base
      INNER JOIN users u ON u.id = base.user_id
      INNER JOIN units un ON un.id = u."unitId"
      LEFT JOIN behavior_checklist_logs f2
        ON f2.user_id = base.user_id
        AND f2.log_date = base.log_date
        AND f2.status = 'APPROVED'
      LEFT JOIN approved_form345 r3
        ON r3.user_id = base.user_id
        AND r3.log_date = base.log_date
        AND r3.form_type = 'FORM_3'
      LEFT JOIN mindset_logs m3
        ON m3.user_id = base.user_id
        AND m3.log_date = base.log_date
      LEFT JOIN approved_form345 r4
        ON r4.user_id = base.user_id
        AND r4.log_date = base.log_date
        AND r4.form_type = 'FORM_4'
      LEFT JOIN form4_agg f4
        ON f4.user_id = base.user_id
        AND f4.log_date = base.log_date
      LEFT JOIN approved_form345 r5
        ON r5.user_id = base.user_id
        AND r5.log_date = base.log_date
        AND r5.form_type = 'FORM_5'
      LEFT JOIN end_of_day_logs e5
        ON e5.user_id = base.user_id
        AND e5.log_date = base.log_date
      WHERE u.role = 'EMPLOYEE'
        AND (un."excludeFromStatistics" IS NULL OR un."excludeFromStatistics" = false)
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (filters.fromDate) {
      query += ` AND base.log_date >= $${paramIndex++}`;
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      query += ` AND base.log_date <= $${paramIndex++}`;
      params.push(filters.toDate);
    }
    if (currentUser.role === Role.MANAGER) {
      query += ` AND u."unitId" = $${paramIndex++}`;
      params.push(currentUser.unitId);
    } else if (filters.unitId) {
      query += ` AND u."unitId" = $${paramIndex++}`;
      params.push(filters.unitId);
    }
    const keyword = String(filters.keyword || '').trim().toLowerCase();
    if (keyword) {
      query += ` AND (LOWER(u."fullName") LIKE $${paramIndex} OR LOWER(u.username) LIKE $${paramIndex++})`;
      params.push(`%${keyword}%`);
    }

    query += ` ORDER BY un.name ASC, u."fullName" ASC, base.log_date DESC`;

    const rows = await this.journalsRepository.query(query, params);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau2345');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: `bao-cao-mau-2-3-4-5-${filters.fromDate || 'all'}-${filters.toDate || 'all'}.xlsx`,
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

  async getJournalSubmissionsStats(currentUser: any, date: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    
    let usersQuery = this.usersRepository.createQueryBuilder('u')
      .leftJoinAndSelect('u.unit', 'unit')
      .where('u.role = :employeeRole', { employeeRole: Role.EMPLOYEE })
      .andWhere('(unit.excludeFromStatistics IS NULL OR unit.excludeFromStatistics = false)');

    if (currentUser.role === Role.MANAGER) {
      usersQuery = usersQuery.andWhere('u.unitId = :unitId', { unitId: currentUser.unitId });
    }

    const allUsers = await usersQuery.getMany();

    const journals = await this.journalsRepository.find({
      where: { reportDate: targetDate },
      select: ['userId']
    });
    
    const submittedUserIds = new Set(journals.map(j => j.userId));

    const provinceStats = {
      total: allUsers.length,
      submitted: 0,
      notSubmitted: 0,
      submittedRate: 0,
      notSubmittedRate: 0
    };

    const unitMap = new Map<string, any>();

    allUsers.forEach(user => {
      const hasSubmitted = submittedUserIds.has(user.id);
      if (hasSubmitted) {
        provinceStats.submitted += 1;
      } else {
        provinceStats.notSubmitted += 1;
      }

      const unitName = user.unit?.name || 'Chưa phân bổ';
      const unitId = user.unitId || 'unassigned';

      if (!unitMap.has(unitId)) {
        unitMap.set(unitId, {
          unitId,
          unitName,
          total: 0,
          submitted: 0,
          notSubmitted: 0,
          submittedRate: 0,
          notSubmittedRate: 0,
          submittedUsers: [],
          notSubmittedUsers: []
        });
      }

      const unitStats = unitMap.get(unitId)!;
      unitStats.total += 1;
      if (hasSubmitted) {
        unitStats.submitted += 1;
        unitStats.submittedUsers.push({
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          employeeCode: user.employeeCode || '',
        });
      } else {
        unitStats.notSubmitted += 1;
        unitStats.notSubmittedUsers.push({
          id: user.id,
          fullName: user.fullName,
          username: user.username,
          employeeCode: user.employeeCode || '',
        });
      }
    });

    provinceStats.submittedRate = provinceStats.total > 0 ? Number(((provinceStats.submitted / provinceStats.total) * 100).toFixed(2)) : 0;
    provinceStats.notSubmittedRate = provinceStats.total > 0 ? Number(((provinceStats.notSubmitted / provinceStats.total) * 100).toFixed(2)) : 0;

    const unitStatsArray = Array.from(unitMap.values()).map(u => {
      u.submittedRate = u.total > 0 ? Number(((u.submitted / u.total) * 100).toFixed(2)) : 0;
      u.notSubmittedRate = u.total > 0 ? Number(((u.notSubmitted / u.total) * 100).toFixed(2)) : 0;
      return u;
    });

    return {
      date: targetDate,
      province: provinceStats,
      units: unitStatsArray.sort((a, b) => b.submittedRate - a.submittedRate)
    };
  }

  async getWeeklySummary(weekId: string, currentUser: any, unitId?: string) {
    const week = await this.weeklyConfigsRepository.findOne({
      where: { id: weekId },
    });
    if (!week) {
      throw new NotFoundException('Không tìm thấy cấu hình tuần');
    }

    const totalDays =
      Math.floor(
        (new Date(week.endDate).getTime() - new Date(week.startDate).getTime()) /
          86400000,
      ) + 1;

    // Fetch all employees in manager's unit
    const qb = this.usersRepository.createQueryBuilder('u')
      .leftJoinAndSelect('u.unit', 'un')
      .where('u.role = :role', { role: Role.EMPLOYEE })
      .andWhere('(un.excludeFromStatistics IS NULL OR un.excludeFromStatistics = false)');

    if (currentUser.role === Role.MANAGER) {
      qb.andWhere('u.unitId = :unitId', { unitId: currentUser.unitId });
    } else if (unitId) {
      qb.andWhere('u.unitId = :unitId', { unitId });
    }

    const users = await qb.orderBy('u.fullName', 'ASC').getMany();

    // Fetch submissions for this week
    const submissions = await this.weeklyReportSubmissionsRepository.find({
      where: { weekId: week.id }
    });

    const items = users.map(u => {
      const sub = submissions.find(s => s.userId === u.id);
      return {
        userId: u.id,
        fullName: u.fullName,
        employeeCode: u.employeeCode || '',
        unitName: u.unit ? u.unit.name : '',
        totalCustomerMet: sub ? Number(sub.customerMetCount) : 0,
        deepInquiryRate: sub ? Number(sub.deepInquiryRate) : 0,
        fullConsultationRate: sub ? Number(sub.fullConsultationRate) : 0,
        followedThroughRate: sub ? Number(sub.followedThroughRate) : 0,
        managerFeedback: sub ? sub.managerFeedback : ''
      };
    });

    return {
      week,
      totalDays,
      items,
    };
  }

  async saveWeeklySummary(user: any, dto: SaveWeeklyReportDto) {
    if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ quản lý mới được phép lưu báo cáo tuần');
    }
    const week = await this.weeklyConfigsRepository.findOne(dto.weekId);
    if (!week) {
      throw new NotFoundException('Không tìm thấy tuần');
    }
    const targetUser = await this.usersRepository.findOne({ where: { id: dto.userId } });
    if (!targetUser) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }

    let submission = await this.weeklyReportSubmissionsRepository.findOne({
      where: { weekId: dto.weekId, userId: dto.userId }
    });

    if (!submission) {
      submission = this.weeklyReportSubmissionsRepository.create({
        weekId: dto.weekId,
        userId: dto.userId,
        managerId: user.id
      });
    }

    submission.managerId = user.id;
    if (dto.customerMetCount !== undefined) submission.customerMetCount = dto.customerMetCount;
    if (dto.deepInquiryRate !== undefined) submission.deepInquiryRate = dto.deepInquiryRate;
    if (dto.fullConsultationRate !== undefined) submission.fullConsultationRate = dto.fullConsultationRate;
    if (dto.followedThroughRate !== undefined) submission.followedThroughRate = dto.followedThroughRate;
    if (dto.managerFeedback !== undefined) submission.managerFeedback = dto.managerFeedback;

    return this.weeklyReportSubmissionsRepository.save(submission);
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
    return { message: 'Đã xóa tuần' };
  }

  async getManagerWeeklyJournals(
    user: User,
    weekId?: string,
    status?: string,
    unitId?: string,
  ) {
    const qb = this.weeklyJournalLogsRepository
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.user', 'u')
      .leftJoinAndSelect('u.unit', 'un')
      .leftJoinAndSelect('l.week', 'w')
      .orderBy('w.startDate', 'DESC')
      .addOrderBy('u.fullName', 'ASC');

    if (user.role === Role.MANAGER) {
      qb.andWhere('u.unitId = :unitId', { unitId: user.unitId });
    } else if (unitId) {
      qb.andWhere('u.unitId = :unitId', { unitId });
    }

    if (weekId) {
      qb.andWhere('l.weekId = :weekId', { weekId });
    }

    if (status) {
      qb.andWhere('l.status = :status', { status });
    }

    const logs = await qb.getMany();

    // Group logs by user and week to make it easier for frontend
    const map = new Map<string, any>();
    logs.forEach(log => {
      const key = `${log.userId}_${log.weekId}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          user: log.user,
          week: log.week,
          status: log.status,
          managerComment: log.managerComment,
          submittedAt: log.submittedAt,
          forms: []
        });
      }
      map.get(key).forms.push({
        formType: log.formType,
        entries: log.entries,
        id: log.id
      });
      
      // Update overall status if any form is PENDING or REJECTED
      if (log.status === 'PENDING') map.get(key).status = 'PENDING';
      else if (log.status === 'REJECTED' && map.get(key).status !== 'PENDING') map.get(key).status = 'REJECTED';
    });

    return Array.from(map.values());
  }

  async exportManagerWeeklyJournalsFile(
    user: User,
    weekId?: string,
    status?: string,
    unitId?: string,
  ) {
    const rows = await this.getManagerWeeklyJournals(user, weekId, status, unitId);
    const toText = (value: any) => String(value || '').trim();
    const resolveStatus = (value: string) =>
      value === 'APPROVED' ? 'Đã duyệt' : value === 'REJECTED' ? 'Bị trả lại' : 'Chờ duyệt';
    const mergeEntries = (entries: any[], key: string) =>
      (Array.isArray(entries) ? entries : [])
        .map((item) => toText(item?.[key]))
        .filter(Boolean)
        .join(' | ');

    const exportRows = rows.map((item) => {
      const form10 = (item.forms || []).find((f) => f.formType === 'FORM_10');
      const form11 = (item.forms || []).find((f) => f.formType === 'FORM_11');
      return {
        'Tuần': toText(item.week?.weekName),
        'Từ ngày': toText(item.week?.startDate),
        'Đến ngày': toText(item.week?.endDate),
        'Đơn vị': toText(item.user?.unit?.name),
        'Nhân viên': toText(item.user?.fullName),
        'Tài khoản': toText(item.user?.username),
        'Trạng thái': resolveStatus(item.status),
        'Nhận xét quản lý': toText(item.managerComment),
        'Mẫu 10 - Hành động thu nhập cao': mergeEntries(form10?.entries, 'highIncomeAction'),
        'Mẫu 10 - Kết quả': mergeEntries(form10?.entries, 'result'),
        'Mẫu 10 - Cảm xúc': mergeEntries(form10?.entries, 'feeling'),
        'Mẫu 11 - Lĩnh vực tạo giá trị tốt nhất': mergeEntries(form11?.entries, 'bestValueArea'),
        'Mẫu 11 - Hành vi gia tăng thu nhập': mergeEntries(form11?.entries, 'incomeIncreaseBehavior'),
        'Mẫu 11 - Dấu hiệu tụt chuẩn': mergeEntries(form11?.entries, 'backslideSign'),
        'Mẫu 11 - Kế hoạch tuần tới': mergeEntries(form11?.entries, 'nextWeekPlan'),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'WeeklyReview');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const selectedWeek = rows[0]?.week?.weekName || 'all';
    const normalizedWeek = selectedWeek.replace(/[^\w-]+/g, '-').toLowerCase();

    return {
      buffer,
      fileName: `bao-cao-duyet-nhat-ky-tuan-${normalizedWeek}.xlsx`,
    };
  }

  async exportManagerWeeklyJournalsStatusFile(
    user: User,
    filters: { weekId: string; unitId?: string },
  ) {
    const weekId = String(filters?.weekId || '').trim();
    if (!weekId) {
      throw new BadRequestException('Thiếu weekId');
    }

    const week = await this.weeklyConfigsRepository.findOne(weekId);
    if (!week) {
      throw new NotFoundException('Không tìm thấy tuần đã chọn');
    }

    let query = `
      WITH form10_data AS (
        SELECT
          user_id,
          MAX(CASE WHEN status = 'APPROVED' THEN 2 ELSE 1 END) AS form10_state
        FROM weekly_journal_logs
        WHERE week_id = $1 AND form_type = 'FORM_10'
        GROUP BY user_id
      ),
      form11_data AS (
        SELECT
          user_id,
          MAX(CASE WHEN status = 'APPROVED' THEN 2 ELSE 1 END) AS form11_state
        FROM weekly_journal_logs
        WHERE week_id = $1 AND form_type = 'FORM_11'
        GROUP BY user_id
      )
      SELECT
        un.name AS "Tên đơn vị",
        u."fullName" AS "Tên nhân viên",
        $2 AS "Tuần",
        $3 AS "Từ ngày",
        $4 AS "Đến ngày",
        CASE
          WHEN f10.form10_state = 2 THEN 'Đã duyệt'
          WHEN f10.form10_state = 1 THEN 'Đã nhập'
          ELSE 'Chưa nhập'
        END AS "Mẫu 10",
        CASE
          WHEN f11.form11_state = 2 THEN 'Đã duyệt'
          WHEN f11.form11_state = 1 THEN 'Đã nhập'
          ELSE 'Chưa nhập'
        END AS "Mẫu 11"
      FROM users u
      INNER JOIN units un ON un.id = u."unitId"
      LEFT JOIN form10_data f10 ON u.id = f10.user_id
      LEFT JOIN form11_data f11 ON u.id = f11.user_id
      WHERE u.role = 'EMPLOYEE'
        AND (un."excludeFromStatistics" IS NULL OR un."excludeFromStatistics" = false)
    `;

    const params: any[] = [weekId, week.weekName, week.startDate, week.endDate];
    let paramIndex = 5;

    if (user.role === Role.MANAGER) {
      query += ` AND u."unitId" = $${paramIndex++}`;
      params.push(user.unitId);
    } else if (filters.unitId) {
      query += ` AND u."unitId" = $${paramIndex++}`;
      params.push(filters.unitId);
    }

    query += ` ORDER BY un.name ASC, u."fullName" ASC`;

    const rows = await this.journalsRepository.query(query, params);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TrangThaiMau1011');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const normalizedWeek = String(week.weekName || 'all')
      .replace(/[^\w-]+/g, '-')
      .toLowerCase();

    return {
      buffer,
      fileName: `bao-cao-trang-thai-mau-10-11-${normalizedWeek}.xlsx`,
    };
  }

  async reviewWeeklyJournal(manager: User, dto: any) {
    const { userId, weekId, status, managerComment } = dto;
    if (!userId || !weekId || !status) {
      throw new BadRequestException('Thiếu thông tin userId, weekId hoặc status');
    }

    const logs = await this.weeklyJournalLogsRepository.find({
      where: { userId, weekId }
    });

    if (!logs.length) {
      throw new NotFoundException('Không tìm thấy nhật ký tuần của nhân viên này');
    }

    for (const log of logs) {
      log.status = status;
      if (managerComment !== undefined) {
        log.managerComment = managerComment;
      }
      log.reviewerId = manager.id;
    }

    await this.weeklyJournalLogsRepository.save(logs);
    return { message: 'Đã cập nhật trạng thái nhật ký tuần' };
  }
}
