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
import { Between, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
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
import { CoachingPhaseConfig } from './entities/coaching-phase-config.entity';
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
import { UpsertCoachingPhaseConfigDto } from './dto/upsert-coaching-phase-config.dto';
import { UpdateWeeklyConfigDto } from './dto/update-weekly-config.dto';
import { validateActionTimeForDate } from '../common/utils/time-validator.util';
import { Evaluation } from '../evaluations/entities/evaluation.entity';
import { BusinessTimeUtil } from '../common/utils/business-time.util';

import { SaveWeeklyReportDto } from './dto/save-weekly-report.dto';
import { WeeklyReportSubmission } from './entities/weekly-report-submission.entity';
import { ManagerCoachingLog } from './entities/manager-coaching-log.entity';
import { CreateManagerCoachingLogDto } from './dto/create-manager-coaching-log.dto';
import { UpdateManagerCoachingLogDto } from './dto/update-manager-coaching-log.dto';
import { DailyCoachingCustomer } from './entities/daily-coaching-customer.entity';
import { SaveDailyCoachingCustomerDto } from './dto/save-daily-coaching-customer.dto';
import { CatalogItem } from '../catalogs/entities/catalog-item.entity';

const JOURNEY_PHASE_FORM_MAP: Record<string, string[]> = {
  PHASE_1: ['awareness', 'form3', 'form8'],
  PHASE_2: ['behavior', 'form3', 'form4', 'form5'],
  PHASE_3: ['form3', 'form4', 'form5', 'form7', 'form9', 'form12'],
};

const COACHING_PHASE_FORM_MAP: Record<string, string[]> = {
  PHASE_1: ['coaching_form_1'],
  PHASE_2: ['coaching_form_2'],
  PHASE_3: ['coaching_form_2'],
};

const COACHING_FORM_IDS = ['coaching_form_1', 'coaching_form_2'];
const DEBUG_PREFIX = '[DEBUG]';
const DEBUG_SESSION_ID = 'journals-7912-500';
const DEBUG_ENV_PATH = `.dbg/${DEBUG_SESSION_ID}.env`;

function reportDebugEvent(payload: {
  runId?: string;
  hypothesisId: string;
  location: string;
  msg: string;
  data?: Record<string, any>;
  traceId?: string;
}) {
  try {
    const fs = require('fs');
    const http = require('http');
    const https = require('https');
    let debugServerUrl = 'http://127.0.0.1:7777/event';
    let sessionId = DEBUG_SESSION_ID;
    try {
      const envContent = fs.readFileSync(DEBUG_ENV_PATH, 'utf8');
      debugServerUrl =
        envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
      sessionId =
        envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
    } catch {}

    const url = new URL(debugServerUrl);
    const body = JSON.stringify({
      sessionId,
      runId: payload.runId || 'pre-fix',
      hypothesisId: payload.hypothesisId,
      location: payload.location,
      msg: payload.msg.startsWith(DEBUG_PREFIX) ? payload.msg : `${DEBUG_PREFIX} ${payload.msg}`,
      data: payload.data || {},
      traceId: payload.traceId,
      ts: Date.now(),
    });
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      () => {},
    );
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch {}
}

type JourneyFormDefinition = {
  key: string;
  label: string;
  formType: string;
  type: 'journal' | 'log';
};

type JourneyPhaseInfo = {
  id: string;
  phaseCode: string;
  phaseName: string;
  startDate: string;
  endDate: string;
};

type JourneyUserSummary = {
  id: string;
  fullName: string;
  username: string;
  employeeCode: string;
};

type JourneyFormStats = {
  key: string;
  label: string;
  formType: string;
  submitted: number;
  notSubmitted: number;
  submittedRate: number;
  notSubmittedRate: number;
  submittedUsers: JourneyUserSummary[];
  notSubmittedUsers: JourneyUserSummary[];
};

type JournalSubmissionUnitStats = {
  unitId: string;
  unitName: string;
  total: number;
  submitted: number;
  notSubmitted: number;
  submittedRate: number;
  notSubmittedRate: number;
  submittedUsers: JourneyUserSummary[];
  notSubmittedUsers: JourneyUserSummary[];
  forms: JourneyFormStats[];
};

const JOURNEY_FORM_DEFINITIONS: Record<string, JourneyFormDefinition> = {
  awareness: {
    key: 'awareness',
    label: 'Mẫu 1 - Nhận thức',
    formType: 'FORM_1_AWARENESS',
    type: 'journal',
  },
  standards: {
    key: 'standards',
    label: 'Mẫu 1 - Tiêu chuẩn',
    formType: 'FORM_1_STANDARDS',
    type: 'journal',
  },
  behavior: {
    key: 'behavior',
    label: 'Mẫu 2',
    formType: 'FORM_2',
    type: 'log',
  },
  form3: {
    key: 'form3',
    label: 'Mẫu 3',
    formType: 'FORM_3',
    type: 'log',
  },
  form4: {
    key: 'form4',
    label: 'Mẫu 4',
    formType: 'FORM_4',
    type: 'log',
  },
  form5: {
    key: 'form5',
    label: 'Mẫu 5',
    formType: 'FORM_5',
    type: 'log',
  },
  form7: {
    key: 'form7',
    label: 'Mẫu 7',
    formType: 'FORM_7',
    type: 'log',
  },
  form8: {
    key: 'form8',
    label: 'Mẫu 8',
    formType: 'FORM_8',
    type: 'log',
  },
  form9: {
    key: 'form9',
    label: 'Mẫu 9',
    formType: 'FORM_9',
    type: 'log',
  },
  form12: {
    key: 'form12',
    label: 'Mẫu 12',
    formType: 'FORM_12',
    type: 'log',
  },
};

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
    @InjectRepository(CoachingPhaseConfig)
    private readonly coachingPhaseConfigsRepository: Repository<CoachingPhaseConfig>,
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
    @InjectRepository(ManagerCoachingLog)
    private readonly managerCoachingLogsRepository: Repository<ManagerCoachingLog>,
    @InjectRepository(DailyCoachingCustomer)
    private readonly dailyCoachingCustomersRepository: Repository<DailyCoachingCustomer>,
    @InjectRepository(CatalogItem)
    private readonly catalogItemsRepository: Repository<CatalogItem>,
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

  private async hasDatabaseTable(tableName: string) {
    const rows = await this.journalsRepository.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
        ) AS "exists"
      `,
      [tableName],
    );
    return !!rows?.[0]?.exists;
  }

  private async getExistingDatabaseColumns(tableName: string, columnNames: string[]) {
    if (!columnNames.length) {
      return new Set<string>();
    }

    const placeholders = columnNames.map((_, index) => `$${index + 2}`).join(', ');
    const rows = await this.journalsRepository.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name IN (${placeholders})
      `,
      [tableName, ...columnNames],
    );

    return new Set<string>(rows.map((row: { column_name: string }) => row.column_name));
  }

  private sanitizeExcelCellValue(value: any) {
    if (typeof value !== 'string') {
      return value;
    }

    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
  }

  private sanitizeExcelRows<T extends Record<string, any>>(rows: T[]): T[] {
    return rows.map((row) => {
      const sanitizedEntries = Object.entries(row).map(([key, value]) => [
        key,
        this.sanitizeExcelCellValue(value),
      ]);
      return Object.fromEntries(sanitizedEntries) as T;
    });
  }

  private normalizeCoachingDateFilter(value?: string) {
    const normalized = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
  }

  private normalizePersonalRevenue(value?: string) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '0.00';
    }

    let normalized = raw.replace(/\s+/g, '');
    if (normalized.includes(',') && normalized.includes('.')) {
      normalized = normalized.replace(/,/g, '');
    } else if (normalized.includes(',')) {
      normalized = normalized.replace(',', '.');
    }

    normalized = normalized.replace(/[^\d.-]/g, '');
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric)) {
      return '0.00';
    }

    const max = 999999999999.99; // max for numeric(14,2)
    const clamped = Math.min(Math.max(numeric, 0), max);
    return clamped.toFixed(2);
  }

  private convertVndToThousandDisplay(value: any) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 0;
    }
    return Number((numeric / 1000).toFixed(2));
  }

  private getCoachingExcelValue(row: any, keys: string[]) {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
    return '';
  }

  private parseCoachingFlag(value: any) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return 0;
    if (['1', 'true', 'co', 'có', 'yes', 'y', 'dung', 'đúng'].includes(normalized)) return 1;
    return 0;
  }

  private normalizeCoachingScheduleDate(value: any) {
    const text = String(value || '').trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) {
      const dd = String(match[1]).padStart(2, '0');
      const mm = String(match[2]).padStart(2, '0');
      const yyyy = String(match[3]);
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  private normalizeCoachingForm(value?: string) {
    const form = String(value || '').trim();
    if (COACHING_FORM_IDS.includes(form)) {
      return form;
    }
    return 'coaching_form_1';
  }

  private async getCoachingReportCutoffHour() {
    const config = await this.systemConfigsRepository.findOne({ where: { key: 'CUTOFF_HOUR' } });
    const parsed = Number(config?.value);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 23) {
      return parsed;
    }
    if (Number.isFinite(BusinessTimeUtil.CUTOFF_HOUR)) {
      return BusinessTimeUtil.CUTOFF_HOUR;
    }
    return 7;
  }

  async getDailyCoachingCustomers(currentUser: any, logDate?: string, coachingForm?: string) {
    const date = this.resolveLogDate(logDate);
    const normalizedCoachingForm = this.normalizeCoachingForm(coachingForm);
    const rows = await this.dailyCoachingCustomersRepository.find({
      where: { userId: currentUser.id, logDate: date, coachingForm: normalizedCoachingForm },
      order: { createdAt: 'DESC' },
    });

    return rows.map((item) => ({
      id: item.id,
      logDate: item.logDate,
      coachingForm: item.coachingForm || 'coaching_form_1',
      salesPlan: Number(item.salesPlan) || 0,
      customerName: item.customerName || '',
      ward: item.ward || '',
      customerAddress: item.customerAddress || '',
      oldReferral: Number(item.oldReferral) || 0,
      customerFollowUp: Number(item.customerFollowUp) || 0,
      noEarlyQuote: Number(item.noEarlyQuote) || 0,
      consultStandard: Number(item.consultStandard) || 0,
      consultEnoughLayers: Number(item.consultEnoughLayers) || 0,
      consultSolutionMatchingNeed: Number(item.consultSolutionMatchingNeed) || 0,
      consultClearBenefit: Number(item.consultClearBenefit) || 0,
      consultMentionLossAvoidance: Number(item.consultMentionLossAvoidance) || 0,
      closedService: Number(item.closedService) || 0,
      personalRevenue: String(item.personalRevenue || '0'),
      nextFollowRequired: Number(item.nextFollowRequired) || 0,
      nextFollowStep: item.nextFollowStep || '',
      nextFollowSchedule: item.nextFollowSchedule || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  async saveDailyCoachingCustomer(currentUser: any, dto: SaveDailyCoachingCustomerDto) {
    const logDate = this.resolveLogDate(dto.logDate);
    const coachingForm = this.normalizeCoachingForm(dto.coachingForm);
    validateActionTimeForDate(logDate, 'Nhập form coaching khách hàng');
    const personalRevenue = this.normalizePersonalRevenue(dto.personalRevenue);
    const consultEnoughLayers = Number(dto.consultEnoughLayers || 0);
    const consultSolutionMatchingNeed = Number(dto.consultSolutionMatchingNeed || 0);
    const consultClearBenefit = Number(dto.consultClearBenefit || 0);
    const consultMentionLossAvoidance = Number(dto.consultMentionLossAvoidance || 0);
    const consultStandard =
      dto.consultStandard !== undefined
        ? Number(dto.consultStandard || 0)
        : consultEnoughLayers &&
            consultSolutionMatchingNeed &&
            consultClearBenefit &&
            consultMentionLossAvoidance
          ? 1
          : 0;

    const created = this.dailyCoachingCustomersRepository.create({
      userId: currentUser.id,
      logDate,
      coachingForm,
      salesPlan: Number(dto.salesPlan) || 0,
      customerName: String(dto.customerName || '').trim(),
      ward: String(dto.ward || '').trim(),
      customerAddress: String(dto.customerAddress || '').trim(),
      oldReferral: Number(dto.oldReferral) || 0,
      customerFollowUp: Number(dto.customerFollowUp) || 0,
      noEarlyQuote: Number(dto.noEarlyQuote) || 0,
      consultStandard,
      consultEnoughLayers,
      consultSolutionMatchingNeed,
      consultClearBenefit,
      consultMentionLossAvoidance,
      closedService: Number(dto.closedService) || 0,
      personalRevenue,
      nextFollowRequired: Number(dto.nextFollowRequired) || 0,
      nextFollowStep: String(dto.nextFollowStep || '').trim(),
      nextFollowSchedule: dto.nextFollowSchedule
        ? String(dto.nextFollowSchedule).slice(0, 10)
        : null,
    });

    const saved = await this.dailyCoachingCustomersRepository.save(created);
    return {
      id: saved.id,
      logDate: saved.logDate,
      coachingForm: saved.coachingForm || 'coaching_form_1',
      salesPlan: Number(saved.salesPlan) || 0,
      customerName: saved.customerName || '',
      ward: saved.ward || '',
      customerAddress: saved.customerAddress || '',
      oldReferral: Number(saved.oldReferral) || 0,
      customerFollowUp: Number(saved.customerFollowUp) || 0,
      noEarlyQuote: Number(saved.noEarlyQuote) || 0,
      consultStandard: Number(saved.consultStandard) || 0,
      consultEnoughLayers: Number(saved.consultEnoughLayers) || 0,
      consultSolutionMatchingNeed: Number(saved.consultSolutionMatchingNeed) || 0,
      consultClearBenefit: Number(saved.consultClearBenefit) || 0,
      consultMentionLossAvoidance: Number(saved.consultMentionLossAvoidance) || 0,
      closedService: Number(saved.closedService) || 0,
      personalRevenue: String(saved.personalRevenue || '0'),
      nextFollowRequired: Number(saved.nextFollowRequired) || 0,
      nextFollowStep: saved.nextFollowStep || '',
      nextFollowSchedule: saved.nextFollowSchedule || '',
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async importDailyCoachingCustomersFromExcel(
    currentUser: any,
    file: any,
    logDate?: string,
    coachingForm?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Vui lòng chọn file Excel để import');
    }

    const date = this.resolveLogDate(logDate);
    const normalizedCoachingForm = this.normalizeCoachingForm(coachingForm);
    validateActionTimeForDate(date, 'Import form coaching khách hàng');
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('File Excel không có dữ liệu');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as any[];
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('File Excel trống');
    }

    let imported = 0;
    let skipped = 0;
    const entities: DailyCoachingCustomer[] = [];
    const wards = await this.catalogItemsRepository.find({
      where: { category: 'WARD', isActive: true },
      order: { name: 'ASC' },
    });
    const wardNameMap = new Map(wards.map((item) => [String(item.name || '').trim().toLowerCase(), item]));
    const wardCodeMap = new Map(wards.map((item) => [String(item.code || '').trim().toLowerCase(), item]));

    for (const row of rows) {
      const customerName = this.getCoachingExcelValue(row, [
        'Tên khách hàng',
        'Tên khách hàng tiếp xúc/tư vấn',
        'Ten khach hang',
      ]);
      if (!customerName) {
        skipped += 1;
        continue;
      }

      const wardCode = this.getCoachingExcelValue(row, ['Mã phường/xã', 'Ma phuong/xa']);
      const wardText = this.getCoachingExcelValue(row, ['Phường/Xã', 'Phuong/Xa']);
      const wardByCode = wardCode ? wardCodeMap.get(wardCode.toLowerCase()) : undefined;
      const wardByName = wardText ? wardNameMap.get(wardText.toLowerCase()) : undefined;
      const resolvedWard = wardByCode?.name || wardByName?.name || '';
      const consultEnoughLayers = this.parseCoachingFlag(
        this.getCoachingExcelValue(row, ['Số cuộc tư vấn có đủ 3 lớp', 'So cuoc tu van co du 3 lop']),
      );
      const consultSolutionMatchingNeed = this.parseCoachingFlag(
        this.getCoachingExcelValue(row, [
          'Số cuộc tư vấn có gán giải pháp với nhu cầu',
          'So cuoc tu van co gan giai phap voi nhu cau',
        ]),
      );
      const consultClearBenefit = this.parseCoachingFlag(
        this.getCoachingExcelValue(row, [
          'Số cuộc tư vấn có nói rõ lợi ích',
          'So cuoc tu van co noi ro loi ich',
        ]),
      );
      const consultMentionLossAvoidance = this.parseCoachingFlag(
        this.getCoachingExcelValue(row, [
          'Số cuộc tư vấn có nhắc thiệt hại tránh được',
          'So cuoc tu van co nhac thiet hai tranh duoc',
        ]),
      );
      const explicitConsultStandard = this.parseCoachingFlag(
        this.getCoachingExcelValue(row, ['Cuộc tư vấn đủ chuẩn', 'Cuoc tu van du chuan']),
      );
      const consultStandard =
        explicitConsultStandard ||
        (consultEnoughLayers &&
        consultSolutionMatchingNeed &&
        consultClearBenefit &&
        consultMentionLossAvoidance
          ? 1
          : 0);

      const entity = this.dailyCoachingCustomersRepository.create({
        userId: currentUser.id,
        logDate: date,
        coachingForm: normalizedCoachingForm,
        salesPlan: this.parseCoachingFlag(
          this.getCoachingExcelValue(row, ['Kế hoạch bán hàng', 'Ke hoach ban hang']),
        ),
        customerName,
        ward: resolvedWard,
        customerAddress: this.getCoachingExcelValue(row, [
          'Địa chỉ',
          'Địa chỉ khách hàng tiếp xúc/tư vấn',
          'Dia chi',
        ]),
        oldReferral: this.parseCoachingFlag(
          this.getCoachingExcelValue(row, ['Khách cũ giới thiệu', 'Khach cu gioi thieu']),
        ),
        customerFollowUp: this.parseCoachingFlag(
          this.getCoachingExcelValue(row, ['Khách follow up', 'Khach follow up']),
        ),
        noEarlyQuote: this.parseCoachingFlag(
          this.getCoachingExcelValue(row, ['Không báo giá sớm', 'Khong bao gia som']),
        ),
        consultEnoughLayers,
        consultSolutionMatchingNeed,
        consultClearBenefit,
        consultMentionLossAvoidance,
        consultStandard,
        closedService: this.parseCoachingFlag(
          this.getCoachingExcelValue(row, ['Chốt dịch vụ', 'Chot dich vu']),
        ),
        personalRevenue: this.normalizePersonalRevenue(
          this.getCoachingExcelValue(row, ['Doanh thu cá nhân', 'Doanh thu cá nhân (VND)', 'Doanh thu cá nhân (Ngàn đồng)', 'Doanh thu'])
        ),
        nextFollowRequired: this.parseCoachingFlag(
          this.getCoachingExcelValue(row, [
            'Khách follow up tiếp theo',
            'Khach follow up tiep theo',
            'Khách follow tiếp theo/ Bước tiếp theo',
            'Khach follow tiep theo/ Buoc tiep theo',
          ]),
        ),
        nextFollowStep: this.getCoachingExcelValue(row, [
          'Bước tiếp theo',
          'Buoc tiep theo',
          'Ghi chú chi tiết bước tiếp theo',
          'Khách follow tiếp theo/ Bước tiếp theo',
          'Khach follow tiep theo/ Buoc tiep theo',
        ]),
        nextFollowSchedule: this.normalizeCoachingScheduleDate(
          this.getCoachingExcelValue(row, ['Lịch hẹn follow tiếp theo', 'Lich hen follow tiep theo']),
        ),
      });

      entities.push(entity);
      imported += 1;
    }

    if (entities.length > 0) {
      await this.dailyCoachingCustomersRepository.save(entities);
    }

    return {
      logDate: date,
      coachingForm: normalizedCoachingForm,
      total: rows.length,
      imported,
      skipped,
      message: `Import coaching thành công cho ngày ${date}`,
    };
  }

  async getDailyCoachingCustomersImportTemplateFile(coachingForm?: string) {
    const wards = await this.catalogItemsRepository.find({
      where: { category: 'WARD', isActive: true },
      order: { name: 'ASC' },
    });
    const workbook = new ExcelJS.Workbook();

    const templateSheet = workbook.addWorksheet('Template');
    const isPhase2Template = String(coachingForm || '').trim() === 'coaching_form_2';
    const headers = isPhase2Template
      ? [
          'Kế hoạch bán hàng',
          'Tên khách hàng tiếp xúc/tư vấn',
          'Địa chỉ khách hàng tiếp xúc/tư vấn',
          'Khách cũ giới thiệu',
          'Khách follow up',
          'Không báo giá sớm',
          'Số cuộc tư vấn có đủ 3 lớp',
          'Số cuộc tư vấn có gán giải pháp với nhu cầu',
          'Số cuộc tư vấn có nói rõ lợi ích',
          'Số cuộc tư vấn có nhắc thiệt hại tránh được',
          'Chốt dịch vụ',
          'Doanh thu cá nhân (Ngàn đồng)',
          'Khách follow tiếp theo/ Bước tiếp theo',
          'Lịch hẹn follow tiếp theo',
          'Phường/Xã',
        ]
      : [
          'Kế hoạch bán hàng',
          'Tên khách hàng tiếp xúc/tư vấn',
          'Địa chỉ khách hàng tiếp xúc/tư vấn',
          'Khách cũ giới thiệu',
          'Khách follow up',
          'Không báo giá sớm',
          'Cuộc tư vấn đủ chuẩn',
          'Chốt dịch vụ',
          'Doanh thu cá nhân (Ngàn đồng)',
          'Khách follow up tiếp theo/ Bước tiếp theo',
          'Lịch hẹn follow tiếp theo',
        ];
    templateSheet.addRow(headers);
    templateSheet.addRow(
      isPhase2Template
        ? [
            'Có',
            'Nguyen Van A',
            '123 Đường ABC',
            'Có',
            'Đúng',
            'Đúng',
            'Đúng',
            'Đúng',
            'Đúng',
            'Sai',
            'Có',
            2500,
            'Cần follow / Gọi xác nhận lắp đặt',
            '2026-05-30',
            wards[0]?.name || '',
          ]
        : [
            'Có',
            'Nguyen Van A',
            '123 Đường ABC',
            'Có',
            'Đúng',
            'Đúng',
            'Đúng',
            'Có',
            2500,
            'Cần follow / Gọi xác nhận lắp đặt',
            '2026-05-30',
          ],
    );

    templateSheet.getRow(1).font = { bold: true };
    templateSheet.columns = headers.map((header) => ({ header, width: 24 }));

    const wardSheet = workbook.addWorksheet('DanhMucPhuongXa');
    wardSheet.addRow(['Mã phường/xã', 'Tên phường/xã']);
    for (const ward of wards) {
      wardSheet.addRow([ward.code || '', ward.name || '']);
    }
    wardSheet.getRow(1).font = { bold: true };
    wardSheet.columns = [
      { header: 'Mã phường/xã', width: 24 },
      { header: 'Tên phường/xã', width: 30 },
    ];

    const guideSheet = workbook.addWorksheet('HuongDan');
    guideSheet.addRow(['COT', 'HUONG_DAN']);
    (isPhase2Template
      ? [
          ['Kế hoạch bán hàng', 'Chọn Có=1 hoặc Không=0'],
          ['Tên khách hàng tiếp xúc/tư vấn', 'Bắt buộc'],
          ['Địa chỉ khách hàng tiếp xúc/tư vấn', 'Tên đường, phường (xã), số nhà/tel...'],
          ['Khách cũ giới thiệu', 'Được KH cũ giới thiệu=1, không được giới thiệu=0'],
          ['Khách follow up', 'Đúng=1, sai=0'],
          ['Không báo giá sớm', 'Đúng=1, sai=0'],
          ['Số cuộc tư vấn có đủ 3 lớp', 'Đúng=1, sai=0'],
          ['Số cuộc tư vấn có gán giải pháp với nhu cầu', 'Đúng=1, sai=0'],
          ['Số cuộc tư vấn có nói rõ lợi ích', 'Đúng=1, sai=0'],
          ['Số cuộc tư vấn có nhắc thiệt hại tránh được', 'Đúng=1, sai=0'],
          ['Chốt dịch vụ', 'Lắp đặt/hòa mạng=1, chưa lắp đặt/HM=0'],
          ['Doanh thu cá nhân (Ngàn đồng)', 'Số tiền ngàn đồng, ví dụ 2500 = 2.500.000 VND'],
          ['Khách follow tiếp theo/ Bước tiếp theo', 'Có follow=1, không cần follow=0 hoặc ghi bước tiếp theo'],
          ['Lịch hẹn follow tiếp theo', 'dd/mm/yyyy hoặc yyyy-mm-dd'],
          ['Phường/Xã', 'Chọn từ dropdown theo sheet DanhMucPhuongXa'],
        ]
      : [
          ['Kế hoạch bán hàng', 'Có danh sách KH, phân loại KH, chuẩn bị câu hỏi... (Có=1, không=0)'],
          ['Tên khách hàng tiếp xúc/tư vấn', 'Bắt buộc'],
          ['Địa chỉ khách hàng tiếp xúc/tư vấn', 'Tên đường, phường (xã), số nhà/tel...'],
          ['Khách cũ giới thiệu', '(Được KH cũ giới thiệu=1, không được giới thiệu=0)'],
          ['Khách follow up', 'Tư vấn lại KH tiềm năng đã được tư vấn chưa thành công (Đúng=1, sai=0)'],
          ['Không báo giá sớm', '(Đúng=1, sai=0)'],
          ['Cuộc tư vấn đủ chuẩn', 'Ko giới thiệu gói, báo giá sớm, hỏi khách có mua không... (Đúng=1, sai=0)'],
          ['Chốt dịch vụ', '(Lắp đặt/hòa mạng=1, chưa lắp đặt HM=0)'],
          ['Doanh thu cá nhân (Ngàn đồng)', 'Số tiền ngàn đồng, ví dụ 2500 = 2.500.000 VND'],
          ['Khách follow up tiếp theo/ Bước tiếp theo', '(Có follow=1, không cần follow=0) / Bước tiếp theo'],
          ['Lịch hẹn follow tiếp theo', 'Lần follow...(1): dd/mm/yyyy: Gọi lại/Tư vấn trực tiếp/nhờ giới thiệu/...'],
        ]
    ).forEach((row) => guideSheet.addRow(row));
    guideSheet.getRow(1).font = { bold: true };
    guideSheet.columns = [
      { header: 'COT', width: 34 },
      { header: 'HUONG_DAN', width: 80 },
    ];

    const lastWardRow = Math.max(2, wards.length + 1);
    const wardNameFormula = `'DanhMucPhuongXa'!$B$2:$B$${lastWardRow}`;
    const wardColumn = isPhase2Template ? 'O' : '';
    const salesPlanColumn = 'A';
    const oldReferralColumn = 'D';
    const customerFollowColumn = 'E';
    const noEarlyQuoteColumn = 'F';
    const consultEnoughLayersColumn = isPhase2Template ? 'G' : '';
    const consultSolutionMatchingNeedColumn = isPhase2Template ? 'H' : '';
    const consultClearBenefitColumn = isPhase2Template ? 'I' : '';
    const consultMentionLossAvoidanceColumn = isPhase2Template ? 'J' : '';
    const consultStandardColumn = isPhase2Template ? '' : 'G';
    const closedServiceColumn = isPhase2Template ? 'K' : 'H';
    const followColumn = isPhase2Template ? 'M' : 'J';
    for (let row = 2; row <= 1000; row += 1) {
      if (wardColumn) {
        templateSheet.getCell(`${wardColumn}${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [wardNameFormula],
          showErrorMessage: true,
        };
      }

      templateSheet.getCell(`${salesPlanColumn}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Có,Không"'],
        showErrorMessage: true,
      };
      templateSheet.getCell(`${oldReferralColumn}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Có,Không"'],
        showErrorMessage: true,
      };
      templateSheet.getCell(`${customerFollowColumn}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Đúng,Sai"'],
        showErrorMessage: true,
      };
      templateSheet.getCell(`${noEarlyQuoteColumn}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Đúng,Sai"'],
        showErrorMessage: true,
      };
      if (consultEnoughLayersColumn) {
        templateSheet.getCell(`${consultEnoughLayersColumn}${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Đúng,Sai"'],
          showErrorMessage: true,
        };
      }
      if (consultSolutionMatchingNeedColumn) {
        templateSheet.getCell(`${consultSolutionMatchingNeedColumn}${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Đúng,Sai"'],
          showErrorMessage: true,
        };
      }
      if (consultClearBenefitColumn) {
        templateSheet.getCell(`${consultClearBenefitColumn}${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Đúng,Sai"'],
          showErrorMessage: true,
        };
      }
      if (consultMentionLossAvoidanceColumn) {
        templateSheet.getCell(`${consultMentionLossAvoidanceColumn}${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Đúng,Sai"'],
          showErrorMessage: true,
        };
      }
      if (consultStandardColumn) {
        templateSheet.getCell(`${consultStandardColumn}${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"Đúng,Sai"'],
          showErrorMessage: true,
        };
      }
      templateSheet.getCell(`${closedServiceColumn}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Có,Không"'],
        showErrorMessage: true,
      };
      templateSheet.getCell(`${followColumn}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Cần follow,Không"'],
        showErrorMessage: true,
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buffer),
      fileName: 'mau-import-coaching-khach-hang.xlsx',
    };
  }

  private formatManagerCoachingLog(row: any) {
    return {
      id: row.id,
      coachingTime: row.coachingTime,
      coachingContent: row.coachingContent || '',
      contentToImprove: row.contentToImprove || '',
      keepTnc: Number(row.keepTnc) || 0,
      keepTncLabel: Number(row.keepTnc) === 1 ? 'Có giữ chuẩn' : 'Chưa giữ chuẩn',
      evaluationResult: Number(row.evaluationResult) || 0,
      evaluationResultLabel: Number(row.evaluationResult) === 1 ? 'Đạt' : 'Chưa đạt',
      coachUserId: row.coachUserId,
      coachName: row.coachName || '',
      coachedUserId: row.coachedUserId,
      coachedUserName: row.coachedUserName || '',
      coachedUsername: row.coachedUsername || '',
      coachedEmployeeCode: row.coachedEmployeeCode || '',
      coachedUnitId: row.coachedUnitId || '',
      coachedUnitName: row.coachedUnitName || '',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async getManageableEmployeeForCoaching(currentUser: any, coachedUserId: string) {
    const actor = await this.resolveManagerCoachingActor(currentUser);
    if (!this.canEditManagerCoaching(actor)) {
      throw new ForbiddenException('Bạn không có quyền nhập phiếu coaching');
    }
    const employee = await this.usersRepository.findOne({
      where: { id: coachedUserId },
      relations: ['unit'],
    });

    if (!employee || employee.role !== Role.EMPLOYEE) {
      throw new BadRequestException('Không tìm thấy nhân viên được coaching');
    }

    if (actor.role !== Role.ADMIN && employee.unitId !== actor.unitId) {
      throw new ForbiddenException('Chỉ được coaching nhân viên trong cùng đơn vị');
    }

    if (employee.id === actor.id) {
      throw new BadRequestException('Người được coaching không được trùng người coach');
    }

    return employee;
  }

  private canViewManagerCoaching(currentUser: any) {
    return (
      currentUser?.role === Role.ADMIN ||
      currentUser?.role === Role.PROVINCIAL_VIEWER ||
      currentUser?.role === Role.MANAGER ||
      !!currentUser?.canManageCoaching
    );
  }

  private canEditManagerCoaching(currentUser: any) {
    return (
      currentUser?.role === Role.ADMIN ||
      currentUser?.role === Role.MANAGER ||
      !!currentUser?.canManageCoaching
    );
  }

  private async resolveManagerCoachingActor(currentUser: any) {
    const actorId = currentUser?.sub || currentUser?.id;
    if (!actorId) {
      return currentUser;
    }
    const actor = await this.usersRepository.findOne({
      where: { id: actorId },
      relations: ['unit'],
    });
    if (!actor) {
      return currentUser;
    }
    return {
      ...currentUser,
      id: actor.id,
      sub: actor.id,
      role: actor.role,
      unitId: actor.unitId,
      unitName: actor.unit?.name || currentUser?.unitName,
      fullName: actor.fullName,
      canManageCoaching: !!actor.canManageCoaching,
    };
  }

  private async getManagerCoachingLogById(logId: string) {
    const row = await this.managerCoachingLogsRepository
      .createQueryBuilder('log')
      .leftJoin('log.coachUser', 'coach')
      .leftJoin('log.coachedUser', 'coached')
      .leftJoin('coached.unit', 'unit')
      .select([
        'log.id AS id',
        'log.coachingTime AS "coachingTime"',
        'log.coachingContent AS "coachingContent"',
        'log.contentToImprove AS "contentToImprove"',
        'log.keepTnc AS "keepTnc"',
        'log.evaluationResult AS "evaluationResult"',
        'log.coachUserId AS "coachUserId"',
        'log.coachedUserId AS "coachedUserId"',
        'log.createdAt AS "createdAt"',
        'log.updatedAt AS "updatedAt"',
        'coach.fullName AS "coachName"',
        'coached.fullName AS "coachedUserName"',
        'coached.username AS "coachedUsername"',
        'coached.employeeCode AS "coachedEmployeeCode"',
        'coached.unitId AS "coachedUnitId"',
        'unit.name AS "coachedUnitName"',
      ])
      .where('log.id = :logId', { logId })
      .getRawOne();

    return row ? this.formatManagerCoachingLog(row) : null;
  }

  private async assertManagerCoachingLogAccess(logId: string, currentUser: any) {
    const actor = await this.resolveManagerCoachingActor(currentUser);
    if (!this.canEditManagerCoaching(actor)) {
      throw new ForbiddenException('Bạn không có quyền thao tác phiếu coaching');
    }
    const log = await this.managerCoachingLogsRepository.findOne({ where: { id: logId } });
    if (!log) {
      throw new NotFoundException('Không tìm thấy phiếu coaching');
    }
    if (actor.role !== Role.ADMIN && log.coachUserId !== actor.id) {
      throw new ForbiddenException('Chỉ được thao tác trên phiếu coaching do bạn tạo');
    }
    return log;
  }

  async getManagerCoachingLogs(
    currentUser: any,
    filters: { fromDate?: string; toDate?: string; coachedUserId?: string; keyword?: string },
  ) {
    const actor = await this.resolveManagerCoachingActor(currentUser);
    if (!this.canViewManagerCoaching(actor)) {
      throw new ForbiddenException('Bạn không có quyền xem phiếu coaching');
    }
    const fromDate = this.normalizeCoachingDateFilter(filters?.fromDate);
    const toDate = this.normalizeCoachingDateFilter(filters?.toDate);
    const coachedUserId = String(filters?.coachedUserId || '').trim();
    const keyword = String(filters?.keyword || '').trim().toLowerCase();

    const qb = this.managerCoachingLogsRepository
      .createQueryBuilder('log')
      .leftJoin('log.coachUser', 'coach')
      .leftJoin('log.coachedUser', 'coached')
      .leftJoin('coached.unit', 'unit')
      .select([
        'log.id AS id',
        'log.coachingTime AS "coachingTime"',
        'log.coachingContent AS "coachingContent"',
        'log.contentToImprove AS "contentToImprove"',
        'log.keepTnc AS "keepTnc"',
        'log.evaluationResult AS "evaluationResult"',
        'log.coachUserId AS "coachUserId"',
        'log.coachedUserId AS "coachedUserId"',
        'log.createdAt AS "createdAt"',
        'log.updatedAt AS "updatedAt"',
        'coach.fullName AS "coachName"',
        'coached.fullName AS "coachedUserName"',
        'coached.username AS "coachedUsername"',
        'coached.employeeCode AS "coachedEmployeeCode"',
        'coached.unitId AS "coachedUnitId"',
        'unit.name AS "coachedUnitName"',
      ]);

    if (actor.role !== Role.ADMIN && actor.role !== Role.PROVINCIAL_VIEWER) {
      qb.andWhere('log.coachUserId = :coachUserId', { coachUserId: actor.id });
    }

    if (fromDate) {
      qb.andWhere('DATE(log.coachingTime) >= :fromDate', { fromDate });
    }
    if (toDate) {
      qb.andWhere('DATE(log.coachingTime) <= :toDate', { toDate });
    }
    if (coachedUserId) {
      qb.andWhere('log.coachedUserId = :coachedUserId', { coachedUserId });
    }
    if (keyword) {
      qb.andWhere(
        '(LOWER(coached.fullName) LIKE :keyword OR LOWER(coached.username) LIKE :keyword OR LOWER(log.coachingContent) LIKE :keyword OR LOWER(log.contentToImprove) LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    const rows = await qb
      .orderBy('log.coachingTime', 'DESC')
      .addOrderBy('log.createdAt', 'DESC')
      .getRawMany();

    return rows.map((row) => this.formatManagerCoachingLog(row));
  }

  async getManagerCoachingEmployees(currentUser: any) {
    const actor = await this.resolveManagerCoachingActor(currentUser);
    if (!this.canViewManagerCoaching(actor)) {
      throw new ForbiddenException('Bạn không có quyền xem danh sách nhân viên coaching');
    }
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .leftJoin('user.unit', 'unit')
      .select([
        'user.id AS id',
        'user.fullName AS "fullName"',
        'user.username AS username',
        'user.employeeCode AS "employeeCode"',
        'user.unitId AS "unitId"',
        'unit.name AS "unitName"',
      ])
      .where('user.role = :role', { role: Role.EMPLOYEE })
      .andWhere('user.id <> :currentUserId', { currentUserId: actor.id });

    if (actor.role !== Role.ADMIN && actor.role !== Role.PROVINCIAL_VIEWER) {
      qb.andWhere('user.unitId = :unitId', { unitId: actor.unitId });
    }

    const rows = await qb.orderBy('user.fullName', 'ASC').addOrderBy('user.username', 'ASC').getRawMany();
    return rows.map((row) => ({
      id: row.id,
      fullName: row.fullName || '',
      username: row.username || '',
      employeeCode: row.employeeCode || '',
      unitId: row.unitId || '',
      unitName: row.unitName || '',
    }));
  }

  async createManagerCoachingLog(currentUser: any, dto: CreateManagerCoachingLogDto) {
    const actor = await this.resolveManagerCoachingActor(currentUser);
    if (!this.canEditManagerCoaching(actor)) {
      throw new ForbiddenException('Bạn không có quyền nhập phiếu coaching');
    }
    await this.getManageableEmployeeForCoaching(actor, dto.coachedUserId);

    const log = this.managerCoachingLogsRepository.create({
      coachUserId: actor.id,
      coachedUserId: dto.coachedUserId,
      coachingTime: new Date(dto.coachingTime),
      coachingContent: dto.coachingContent.trim(),
      contentToImprove: dto.contentToImprove.trim(),
      keepTnc: Number(dto.keepTnc) || 0,
      evaluationResult: Number(dto.evaluationResult) || 0,
    });

    const saved = await this.managerCoachingLogsRepository.save(log);
    return this.getManagerCoachingLogById(saved.id);
  }

  async updateManagerCoachingLog(
    logId: string,
    currentUser: any,
    dto: UpdateManagerCoachingLogDto,
  ) {
    const actor = await this.resolveManagerCoachingActor(currentUser);
    if (!this.canEditManagerCoaching(actor)) {
      throw new ForbiddenException('Bạn không có quyền cập nhật phiếu coaching');
    }
    const target = await this.assertManagerCoachingLogAccess(logId, actor);

    if (dto.coachedUserId) {
      await this.getManageableEmployeeForCoaching(actor, dto.coachedUserId);
      target.coachedUserId = dto.coachedUserId;
    }
    if (dto.coachingTime) {
      target.coachingTime = new Date(dto.coachingTime);
    }
    if (dto.coachingContent !== undefined) {
      target.coachingContent = dto.coachingContent.trim();
    }
    if (dto.contentToImprove !== undefined) {
      target.contentToImprove = dto.contentToImprove.trim();
    }
    if (dto.keepTnc !== undefined) {
      target.keepTnc = Number(dto.keepTnc) || 0;
    }
    if (dto.evaluationResult !== undefined) {
      target.evaluationResult = Number(dto.evaluationResult) || 0;
    }

    await this.managerCoachingLogsRepository.save(target);
    return this.getManagerCoachingLogById(target.id);
  }

  async deleteManagerCoachingLog(logId: string, currentUser: any) {
    const actor = await this.resolveManagerCoachingActor(currentUser);
    if (!this.canEditManagerCoaching(actor)) {
      throw new ForbiddenException('Bạn không có quyền xóa phiếu coaching');
    }
    const target = await this.assertManagerCoachingLogAccess(logId, actor);
    await this.managerCoachingLogsRepository.remove(target);
    return { success: true };
  }

  async exportManagerCoachingLogsFile(
    currentUser: any,
    filters: { fromDate?: string; toDate?: string; coachedUserId?: string; keyword?: string },
  ) {
    const rows = await this.getManagerCoachingLogs(currentUser, filters);
    const excelRows = rows.map((item) => ({
      'Thời gian coaching': String(item.coachingTime || '').replace('T', ' ').slice(0, 16),
      'Người coach': item.coachName || '',
      'Người được coaching': item.coachedUserName || '',
      'Nội dung coach': item.coachingContent || '',
      'Sửa nội dung gì': item.contentToImprove || '',
      'Giữ chuẩn TNC': item.keepTncLabel,
      'Đánh giá người được coaching': item.evaluationResultLabel,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 24 },
      { wch: 28 },
      { wch: 40 },
      { wch: 40 },
      { wch: 20 },
      { wch: 28 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Coaching');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const suffix = this.normalizeCoachingDateFilter(filters?.fromDate) || 'all';

    return {
      buffer,
      fileName: `phieu-coaching-quan-ly-${suffix}.xlsx`,
    };
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
    if (logDate) {
      return String(logDate).slice(0, 10);
    }
    return BusinessTimeUtil.getEffectiveBusinessDate().format('YYYY-MM-DD');
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

  async getJourneyTimelineFormStatuses(
    currentUser: any,
    filters: { fromDate?: string; toDate?: string },
  ) {
    const userId = currentUser.id;
    const fromDate = String(filters?.fromDate || '').slice(0, 10);
    const toDate = String(filters?.toDate || '').slice(0, 10);

    if (!fromDate || !toDate) {
      throw new BadRequestException('Thiếu fromDate hoặc toDate');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('fromDate không được lớn hơn toDate');
    }

    const dateRange = Between(fromDate, toDate);
    const createDefaultEntry = () => ({
      awareness: false,
      standards: false,
      behavior: false,
      form3: false,
      form4: false,
      form5: false,
      form7: false,
      form8: false,
      form9: false,
      form12: false,
      approved: {
        awareness: false,
        standards: false,
        behavior: false,
        form3: false,
        form4: false,
        form5: false,
        form7: false,
        form8: false,
        form9: false,
        form12: false,
      },
    });
    const timelineMap: Record<string, any> = {};
    const ensure = (dateKey: string) => {
      if (!timelineMap[dateKey]) {
        timelineMap[dateKey] = createDefaultEntry();
      }
      return timelineMap[dateKey];
    };

    const [
      journals,
      behaviorLogs,
      mindsetLogs,
      salesReports,
      endOfDayLogs,
      phase3Logs,
      beliefLogs,
      incomeLogs,
      careerLogs,
      reviews,
    ] = await Promise.all([
      this.journalsRepository.find({
        where: { userId, reportDate: dateRange },
      }),
      this.behaviorChecklistLogsRepository.find({
        where: { userId, logDate: dateRange },
      }),
      this.mindsetLogsRepository.find({
        where: { userId, logDate: dateRange },
      }),
      this.salesActivityReportsRepository.find({
        where: { userId, logDate: dateRange },
      }),
      this.endOfDayLogsRepository.find({
        where: { userId, logDate: dateRange },
      }),
      this.phase3StandardLogsRepository.find({
        where: { userId, logDate: dateRange },
      }),
      this.beliefTransformationLogsRepository.find({
        where: { userId, logDate: dateRange },
      }),
      this.incomeBreakthroughLogsRepository.find({
        where: { userId, logDate: dateRange },
      }),
      this.careerCommitmentLogsRepository.find({
        where: { userId, logDate: dateRange },
      }),
      this.dailyFormReviewsRepository.find({
        where: { userId, logDate: dateRange },
      }),
    ]);

    journals.forEach((journal) => {
      const entry = ensure(journal.reportDate);
      entry.awareness = !!journal.awarenessSubmittedAt;
      entry.standards = !!journal.standardsSubmittedAt;
    });

    behaviorLogs.forEach((log) => {
      const entry = ensure(log.logDate);
      entry.behavior = true;
      entry.approved.behavior = log.status === BehaviorChecklistStatus.APPROVED;
    });
    mindsetLogs.forEach((log) => {
      ensure(log.logDate).form3 = true;
    });
    salesReports.forEach((log) => {
      ensure(log.logDate).form4 = true;
    });
    endOfDayLogs.forEach((log) => {
      ensure(log.logDate).form5 = true;
    });
    phase3Logs.forEach((log) => {
      ensure(log.logDate).form7 = true;
    });
    beliefLogs.forEach((log) => {
      ensure(log.logDate).form8 = true;
    });
    incomeLogs.forEach((log) => {
      ensure(log.logDate).form9 = true;
    });
    careerLogs.forEach((log) => {
      ensure(log.logDate).form12 = true;
    });

    reviews.forEach((review) => {
      const entry = ensure(review.logDate);
      if (review.formType === 'FORM_1_AWARENESS' && review.status === 'APPROVED') {
        entry.approved.awareness = true;
      }
      if (review.formType === 'FORM_1_STANDARDS' && review.status === 'APPROVED') {
        entry.approved.standards = true;
      }
      if (review.formType === 'FORM_3' && review.status === 'APPROVED') {
        entry.approved.form3 = true;
      }
      if (review.formType === 'FORM_4' && review.status === 'APPROVED') {
        entry.approved.form4 = true;
      }
      if (review.formType === 'FORM_5' && review.status === 'APPROVED') {
        entry.approved.form5 = true;
      }
      if (review.formType === 'FORM_7' && review.status === 'APPROVED') {
        entry.approved.form7 = true;
      }
      if (review.formType === 'FORM_8' && review.status === 'APPROVED') {
        entry.approved.form8 = true;
      }
      if (review.formType === 'FORM_9' && review.status === 'APPROVED') {
        entry.approved.form9 = true;
      }
      if (review.formType === 'FORM_12' && review.status === 'APPROVED') {
        entry.approved.form12 = true;
      }
    });

    return timelineMap;
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
      allowedForms: (item.allowedForms || []).filter(
        (form) => !COACHING_FORM_IDS.includes(String(form || '').trim()),
      ),
    }));
  }

  private resolveJourneyPhaseStatsByDate(
    targetDate: string,
    phaseConfigs: JourneyPhaseConfig[],
  ): { phaseInfo: JourneyPhaseInfo | null; formDefs: JourneyFormDefinition[] } {
    const activePhaseConfigs = (Array.isArray(phaseConfigs) ? phaseConfigs : [])
      .filter((item) => item?.isActive !== false)
      .sort((a, b) => {
        const sortDiff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
        if (sortDiff !== 0) {
          return sortDiff;
        }
        return String(a.startDate || '').localeCompare(String(b.startDate || ''));
      });

    const matched =
      activePhaseConfigs.find(
        (item) =>
          (!item.startDate || targetDate >= item.startDate) &&
          (!item.endDate || targetDate <= item.endDate),
      ) || null;

    const phaseCode = String(matched?.phaseCode || '').toUpperCase();
    const allowedForms =
      Array.isArray(matched?.allowedForms) && matched.allowedForms.length > 0
        ? matched.allowedForms
        : JOURNEY_PHASE_FORM_MAP[phaseCode] || JOURNEY_PHASE_FORM_MAP.PHASE_1;

    const formEntries: Array<[string, JourneyFormDefinition]> = (Array.isArray(allowedForms)
      ? allowedForms
      : []
    )
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .reduce<Array<[string, JourneyFormDefinition]>>((acc, key) => {
        const definition = JOURNEY_FORM_DEFINITIONS[key];
        if (definition) {
          acc.push([key, definition]);
        }
        return acc;
      }, []);

    const formDefs = Array.from(new Map<string, JourneyFormDefinition>(formEntries).values());

    return {
      phaseInfo: matched
        ? {
            id: matched.id,
            phaseCode: matched.phaseCode,
            phaseName: matched.phaseName,
            startDate: matched.startDate,
            endDate: matched.endDate,
          }
        : null,
      formDefs,
    };
  }

  private async getSubmittedUserIdsByJourneyForm(formKey: string, targetDate: string) {
    if (formKey === 'awareness' || formKey === 'standards') {
      const columnName = formKey === 'awareness' ? 'awarenessSubmittedAt' : 'standardsSubmittedAt';
      const rows = await this.journalsRepository
        .createQueryBuilder('j')
        .select('DISTINCT j."userId"', 'userId')
        .where('j."reportDate" = :targetDate', { targetDate })
        .andWhere(`j."${columnName}" IS NOT NULL`)
        .getRawMany();
      return new Set(rows.map((item) => item.userId));
    }

    const logRepositoryMap: Record<string, Repository<any>> = {
      behavior: this.behaviorChecklistLogsRepository,
      form3: this.mindsetLogsRepository,
      form4: this.salesActivityReportsRepository,
      form5: this.endOfDayLogsRepository,
      form7: this.phase3StandardLogsRepository,
      form8: this.beliefTransformationLogsRepository,
      form9: this.incomeBreakthroughLogsRepository,
      form12: this.careerCommitmentLogsRepository,
    };

    const repository = logRepositoryMap[formKey];
    if (!repository) {
      return new Set<string>();
    }

    const rows = await repository
      .createQueryBuilder('t')
      .select('DISTINCT t.userId', 'userId')
      .where('t.logDate = :targetDate', { targetDate })
      .getRawMany();

    return new Set(rows.map((item) => item.userId));
  }

  async getJourneyPhaseConfigsForAdmin() {
    const rows = await this.journeyPhaseConfigsRepository.find({
      order: { sortOrder: 'ASC', startDate: 'ASC' },
    });
    return rows.map((item) => ({
      ...item,
      allowedForms: (item.allowedForms || [])
        .map((f) => String(f || '').trim())
        .filter((f) => Boolean(f) && !COACHING_FORM_IDS.includes(f)),
    }));
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
      item.allowedForms = dto.allowedForms
        .map((f) => String(f || '').trim())
        .filter((f) => Boolean(f) && !COACHING_FORM_IDS.includes(f));
    }
    return this.journeyPhaseConfigsRepository.save(item);
  }

  async getCoachingPhaseConfigs() {
    const rows = await this.coachingPhaseConfigsRepository.find({
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
      allowedCoachingForms: (() => {
        const forms = (item.allowedForms || [])
          .map((form) => String(form || '').trim())
          .filter((form) => COACHING_FORM_IDS.includes(form));
        if (forms.length > 0) {
          return forms;
        }
        const phaseCode = String(item.phaseCode || '').toUpperCase();
        return COACHING_PHASE_FORM_MAP[phaseCode] || ['coaching_form_1'];
      })(),
    }));
  }

  async getCoachingPhaseConfigsForAdmin() {
    const rows = await this.coachingPhaseConfigsRepository.find({
      order: { sortOrder: 'ASC', startDate: 'ASC' },
    });
    return rows.map((item) => ({
      ...item,
      allowedCoachingForms: (() => {
        const forms = (item.allowedForms || [])
          .map((form) => String(form || '').trim())
          .filter((form) => COACHING_FORM_IDS.includes(form));
        if (forms.length > 0) {
          return forms;
        }
        const phaseCode = String(item.phaseCode || '').toUpperCase();
        return COACHING_PHASE_FORM_MAP[phaseCode] || ['coaching_form_1'];
      })(),
    }));
  }

  async upsertCoachingPhaseConfig(id: string | null, dto: UpsertCoachingPhaseConfigDto) {
    if (dto.startDate && dto.endDate && new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc');
    }
    let item = id ? await this.coachingPhaseConfigsRepository.findOne(id) : null;
    if (!item) {
      item = this.coachingPhaseConfigsRepository.create();
    }
    item.phaseCode = String(dto.phaseCode || '').trim().toUpperCase();
    item.phaseName = String(dto.phaseName || '').trim();
    item.startDate = dto.startDate || null;
    item.endDate = dto.endDate || null;
    item.sortOrder = Number(dto.sortOrder || 1);
    item.isActive = dto.isActive !== false;
    if (dto.allowedCoachingForms) {
      item.allowedForms = dto.allowedCoachingForms
        .map((f) => String(f || '').trim())
        .filter((f) => COACHING_FORM_IDS.includes(f));
    }
    return this.coachingPhaseConfigsRepository.save(item);
  }

  async getCoachingProvincialData(filters: { fromDate?: string; toDate?: string; unitId?: string }) {
    const formatDateYmd = (value: any) => {
      if (!value) return '';
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      const raw = String(value).trim();
      const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) return isoMatch[1];
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return raw;
    };

    const fromDate = filters.fromDate || new Date().toISOString().slice(0, 10);
    const toDate = filters.toDate || fromDate;
    const cutoffHour = await this.getCoachingReportCutoffHour();

    const qb = this.dailyCoachingCustomersRepository
      .createQueryBuilder('c')
      .leftJoin('c.user', 'u')
      .leftJoin('u.unit', 'unit')
      .select([
        'c.logDate AS "logDate"',
        'u.employeeCode AS "employeeCode"',
        'u.fullName AS "fullName"',
        'c.salesPlan AS "salesPlan"',
        'c.customerName AS "customerName"',
        'c.customerAddress AS "customerAddress"',
        'c.ward AS "ward"',
        'c.oldReferral AS "oldReferral"',
        'c.customerFollowUp AS "customerFollowUp"',
        'c.noEarlyQuote AS "noEarlyQuote"',
        'c.consultStandard AS "consultStandard"',
        'c.closedService AS "closedService"',
        'c.personalRevenue AS "personalRevenue"',
        'c.nextFollowRequired AS "nextFollowRequired"',
        'c.nextFollowStep AS "nextFollowStep"',
        'c.nextFollowSchedule AS "nextFollowSchedule"',
        'unit.name AS "unitName"',
      ])
      .where('c.logDate >= :fromDate', { fromDate })
      .andWhere('c.logDate <= :toDate', { toDate })
      .andWhere('c.coachingForm = :coachingForm', { coachingForm: 'coaching_form_1' });

    if (filters.unitId) {
      qb.andWhere('u.unitId = :unitId', { unitId: filters.unitId });
    }

    qb.orderBy('c.logDate', 'ASC')
      .addOrderBy('u.fullName', 'ASC')
      .addOrderBy('c.createdAt', 'ASC');

    const rows = await qb.getRawMany();
    return {
      cutoffHour,
      rows: rows.map((row, idx) => ({
      stt: idx + 1,
      logDate: formatDateYmd(row.logDate),
      employeeCode: row.employeeCode || '',
      fullName: row.fullName || '',
      salesPlan: Number(row.salesPlan) || 0,
      customerName: row.customerName || '',
      customerAddress: [row.customerAddress, row.ward].filter(Boolean).join(', ') || '',
      oldReferral: Number(row.oldReferral) || 0,
      customerFollowUp: Number(row.customerFollowUp) || 0,
      noEarlyQuote: Number(row.noEarlyQuote) || 0,
      consultStandard: Number(row.consultStandard) || 0,
      closedService: Number(row.closedService) || 0,
      personalRevenue: this.convertVndToThousandDisplay(row.personalRevenue),
      nextFollowRequired: Number(row.nextFollowRequired) || 0,
      nextFollowSchedule: formatDateYmd(row.nextFollowSchedule),
      unitName: row.unitName || '',
      })),
    };
  }

  async exportCoachingProvincialFile(filters: { fromDate?: string; toDate?: string; unitId?: string }) {
    const fromDate = filters.fromDate || new Date().toISOString().slice(0, 10);
    const coachingData = await this.getCoachingProvincialData(filters);
    const rows = coachingData.rows || [];
    const cutoffHour = Number(coachingData.cutoffHour || 7);

    const headerTitles = [
      'TT',
      'Ngày báo cáo',
      'Đơn vị',
      'Mã NV',
      'Họ và tên NV',
      'Kế hoạch bán hàng',
      'Tên KH tiếp xúc/tư vấn',
      'Địa chỉ KH',
      'Khách cũ giới thiệu',
      'Khách follow up',
      'Không báo giá sớm',
      'Tư vấn đủ chuẩn',
      'Chốt dịch vụ',
      'Doanh thu (Ngàn đồng)',
      'Follow tiếp theo',
      'Lịch hẹn follow',
    ];

    const headerIndexes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

    const sumField = (items: any[], field: string) =>
      items.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);

    const sheetData: any[][] = [
      [`Mốc cắt ngày thống kê: ${String(cutoffHour).padStart(2, '0')}:00`],
      headerTitles,
      headerIndexes,
    ];
    const merges: any[] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }];

    let group: any[] = [];
    let lastKey = '';

    const pushGroup = () => {
      if (group.length === 0) return;

      group.forEach((row) => {
        sheetData.push([
          row.stt,
          row.logDate,
          row.unitName,
          row.employeeCode,
          row.fullName,
          row.salesPlan,
          row.customerName,
          row.customerAddress,
          row.oldReferral,
          row.customerFollowUp,
          row.noEarlyQuote,
          row.consultStandard,
          row.closedService,
          row.personalRevenue,
          row.nextFollowRequired,
          row.nextFollowSchedule,
        ]);
      });

      const first = group[0];
      const subtotalRowIndex = sheetData.length;
      sheetData.push([
        `Tổng của ${first.fullName || ''} ngày ${first.logDate || ''}`,
        '',
        '',
        '',
        '',
        sumField(group, 'salesPlan'),
        group.filter((item) => String(item.customerName || '').trim() !== '').length,
        '',
        sumField(group, 'oldReferral'),
        sumField(group, 'customerFollowUp'),
        sumField(group, 'noEarlyQuote'),
        sumField(group, 'consultStandard'),
        sumField(group, 'closedService'),
        sumField(group, 'personalRevenue'),
        sumField(group, 'nextFollowRequired'),
        '',
      ]);
      merges.push({ s: { r: subtotalRowIndex, c: 0 }, e: { r: subtotalRowIndex, c: 4 } });

      group = [];
    };

    rows.forEach((row) => {
      const key = `${row.employeeCode || ''}_${row.logDate || ''}`;
      if (lastKey && key !== lastKey) {
        pushGroup();
      }
      lastKey = key;
      group.push(row);
    });
    pushGroup();

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!merges'] = merges;
    worksheet['!cols'] = [
      { wch: 5 },   // TT
      { wch: 14 },  // Ngày báo cáo
      { wch: 22 },  // Đơn vị
      { wch: 14 },  // Mã nhân viên
      { wch: 22 },  // Họ và tên NV
      { wch: 14 },  // Kế hoạch bán hàng
      { wch: 28 },  // Tên KH
      { wch: 32 },  // Địa chỉ
      { wch: 14 },  // Khách cũ giới thiệu
      { wch: 14 },  // Khách follow up
      { wch: 14 },  // Không báo giá sớm
      { wch: 18 },  // Cuộc tư vấn đủ chuẩn
      { wch: 14 },  // Chốt dịch vụ
      { wch: 18 },  // Doanh thu
      { wch: 16 },  // Follow tiếp theo
      { wch: 22 },  // Lịch hẹn follow
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Coaching');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: `bao-cao-coaching-toan-tinh-${fromDate}.xlsx`,
    };
  }

  async getCoachingProvincialGd2Data(filters: { fromDate?: string; toDate?: string; unitId?: string }) {
    const formatDateYmd = (value: any) => {
      if (!value) return '';
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      const raw = String(value).trim();
      const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) return isoMatch[1];
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return raw;
    };

    const fromDate = filters.fromDate || new Date().toISOString().slice(0, 10);
    const toDate = filters.toDate || fromDate;
    const cutoffHour = await this.getCoachingReportCutoffHour();

    const qb = this.dailyCoachingCustomersRepository
      .createQueryBuilder('c')
      .leftJoin('c.user', 'u')
      .leftJoin('u.unit', 'unit')
      .select([
        'c.logDate AS "logDate"',
        'u.employeeCode AS "employeeCode"',
        'u.fullName AS "fullName"',
        'c.salesPlan AS "salesPlan"',
        'c.customerName AS "customerName"',
        'c.customerAddress AS "customerAddress"',
        'c.ward AS "ward"',
        'c.oldReferral AS "oldReferral"',
        'c.customerFollowUp AS "customerFollowUp"',
        'c.noEarlyQuote AS "noEarlyQuote"',
        'c.consultEnoughLayers AS "consultEnoughLayers"',
        'c.consultSolutionMatchingNeed AS "consultSolutionMatchingNeed"',
        'c.consultClearBenefit AS "consultClearBenefit"',
        'c.consultMentionLossAvoidance AS "consultMentionLossAvoidance"',
        'c.closedService AS "closedService"',
        'c.personalRevenue AS "personalRevenue"',
        'c.nextFollowRequired AS "nextFollowRequired"',
        'c.nextFollowSchedule AS "nextFollowSchedule"',
        'unit.name AS "unitName"',
      ])
      .where('c.logDate >= :fromDate', { fromDate })
      .andWhere('c.logDate <= :toDate', { toDate })
      .andWhere('c.coachingForm = :coachingForm', { coachingForm: 'coaching_form_2' });

    if (filters.unitId) {
      qb.andWhere('u.unitId = :unitId', { unitId: filters.unitId });
    }

    qb.orderBy('c.logDate', 'ASC')
      .addOrderBy('u.fullName', 'ASC')
      .addOrderBy('c.createdAt', 'ASC');

    const rows = await qb.getRawMany();

    return {
      cutoffHour,
      rows: rows.map((row, idx) => ({
      stt: idx + 1,
      logDate: formatDateYmd(row.logDate),
      unitName: row.unitName || '',
      employeeCode: row.employeeCode || '',
      fullName: row.fullName || '',
      salesPlan: Number(row.salesPlan) || 0,
      customerName: row.customerName || '',
      customerAddress: [row.customerAddress, row.ward].filter(Boolean).join(', ') || '',
      oldReferral: Number(row.oldReferral) || 0,
      customerFollowUp: Number(row.customerFollowUp) || 0,
      noEarlyQuote: Number(row.noEarlyQuote) || 0,
      consultEnoughLayers: Number(row.consultEnoughLayers) || 0,
      consultSolutionMatchingNeed: Number(row.consultSolutionMatchingNeed) || 0,
      consultClearBenefit: Number(row.consultClearBenefit) || 0,
      consultMentionLossAvoidance: Number(row.consultMentionLossAvoidance) || 0,
      closedService: Number(row.closedService) || 0,
      personalRevenue: this.convertVndToThousandDisplay(row.personalRevenue),
      nextFollowRequired: Number(row.nextFollowRequired) || 0,
      nextFollowSchedule: formatDateYmd(row.nextFollowSchedule),
      })),
    };
  }

  async exportCoachingProvincialGd2File(filters: { fromDate?: string; toDate?: string; unitId?: string }) {
    const fromDate = filters.fromDate || new Date().toISOString().slice(0, 10);
    const coachingData = await this.getCoachingProvincialGd2Data(filters);
    const rows = coachingData.rows || [];
    const cutoffHour = Number(coachingData.cutoffHour || 7);

    const headerTitles = [
      'TT',
      'Ngày báo cáo',
      'Mã nhân viên',
      'Họ và tên NV',
      'Kế hoạch bán hàng',
      'Tên khách hàng tiếp xúc/tư vấn',
      'Địa chỉ khách hàng tiếp xúc/tư vấn',
      'Khách cũ giới thiệu',
      'Khách follow up',
      'Không báo giá sớm',
      'Số cuộc tư vấn có đủ 3 lớp',
      'Số cuộc tư vấn có gắn giải pháp với nhu cầu',
      'Số cuộc tư vấn có nói rõ lợi ích',
      'Số cuộc tư vấn có nhắc thiệt hại tránh được',
      'Chốt dịch vụ',
      'Doanh thu cá nhân (Ngàn đồng)',
      'Khách follow tiếp theo/ Bước tiếp theo',
      'Lịch hẹn follow tiếp theo',
    ];

    const headerDescriptions = [
      '',
      '',
      '',
      '',
      'Có danh sách KH, phân loại KH, chuẩn bị câu hỏi... (Có=1, không=0)',
      '',
      'Tên đường, phường (xã), số nhà/tel...',
      '(Được KH cũ giới thiệu=1, không được giới thiệu=0)',
      'Tư vấn lại KH tiềm năng đã được tư vấn chưa thành công (Đúng=1, sai=0)',
      '(Đúng=1, sai=0)',
      '(Đúng=1, sai=0)',
      '(Đúng=1, sai=0)',
      '(Đúng=1, sai=0)',
      '(Đúng=1, sai=0)',
      '(lắp đặt/ hòa mạng=1, chưa lắp đặt/HM=0)',
      '',
      '(có follow=1, không cần follow=0)',
      'Lần follow ...(2): dd/mm/yyyy: Gọi lại/Tư vấn trực tiếp/nhờ giới thiệu/...',
    ];

    const sumField = (items: any[], field: string) =>
      items.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);

    const sheetData: any[][] = [
      [`Mốc cắt ngày thống kê: ${String(cutoffHour).padStart(2, '0')}:00`],
      headerTitles,
      headerDescriptions,
    ];
    const merges: any[] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 17 } }];
    let group: any[] = [];
    let lastKey = '';

    const pushGroup = () => {
      if (group.length === 0) return;

      group.forEach((row) => {
        sheetData.push([
          row.stt,
          row.logDate,
          row.employeeCode,
          row.fullName,
          row.salesPlan,
          row.customerName,
          row.customerAddress,
          row.oldReferral,
          row.customerFollowUp,
          row.noEarlyQuote,
          row.consultEnoughLayers,
          row.consultSolutionMatchingNeed,
          row.consultClearBenefit,
          row.consultMentionLossAvoidance,
          row.closedService,
          row.personalRevenue,
          row.nextFollowRequired,
          row.nextFollowSchedule,
        ]);
      });

      const first = group[0];
      const subtotalRowIndex = sheetData.length;
      sheetData.push([
        `Tổng của ${first.fullName || ''} ngày ${first.logDate || ''}`,
        '',
        '',
        '',
        sumField(group, 'salesPlan'),
        group.filter((item) => String(item.customerName || '').trim() !== '').length,
        '',
        sumField(group, 'oldReferral'),
        sumField(group, 'customerFollowUp'),
        sumField(group, 'noEarlyQuote'),
        sumField(group, 'consultEnoughLayers'),
        sumField(group, 'consultSolutionMatchingNeed'),
        sumField(group, 'consultClearBenefit'),
        sumField(group, 'consultMentionLossAvoidance'),
        sumField(group, 'closedService'),
        sumField(group, 'personalRevenue'),
        sumField(group, 'nextFollowRequired'),
        '',
      ]);
      merges.push({ s: { r: subtotalRowIndex, c: 0 }, e: { r: subtotalRowIndex, c: 3 } });

      group = [];
    };

    rows.forEach((row) => {
      const key = `${row.employeeCode || ''}_${row.logDate || ''}`;
      if (lastKey && key !== lastKey) {
        pushGroup();
      }
      lastKey = key;
      group.push(row);
    });
    pushGroup();

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!merges'] = merges;
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 16 },
      { wch: 24 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 26 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Coaching-GD2');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: `bao-cao-coaching-gd2-${fromDate}.xlsx`,
    };
  }

  async getCoachingProvincialGd2Summary(filters: { fromDate?: string; toDate?: string; unitId?: string }) {
    const coachingData = await this.getCoachingProvincialGd2Data(filters);
    const rows = coachingData.rows || [];
    const cutoffHour = Number(coachingData.cutoffHour || 7);
    const safeDiv = (a: number, b: number) => (b > 0 ? Number((a / b).toFixed(4)) : 0);
    const fromDate = filters.fromDate || new Date().toISOString().slice(0, 10);
    const toDate = filters.toDate || fromDate;

    const historicalScheduleQb = this.dailyCoachingCustomersRepository
      .createQueryBuilder('c')
      .leftJoin('c.user', 'u')
      .select([
        'c.logDate AS "logDate"',
        'u.employeeCode AS "employeeCode"',
        'c.nextFollowRequired AS "nextFollowRequired"',
        'c.nextFollowSchedule AS "nextFollowSchedule"',
      ])
      .where('c.coachingForm = :coachingForm', { coachingForm: 'coaching_form_2' })
      .andWhere('c.logDate < :fromDate', { fromDate })
      .andWhere('c.nextFollowRequired = 1')
      .andWhere('c.nextFollowSchedule >= :fromDate', { fromDate })
      .andWhere('c.nextFollowSchedule <= :toDate', { toDate });

    if (filters.unitId) {
      historicalScheduleQb.andWhere('u.unitId = :unitId', { unitId: filters.unitId });
    }

    const historicalScheduleRows = await historicalScheduleQb.getRawMany();
    const historicalScheduleCounts = new Map<string, number>();
    historicalScheduleRows.forEach((row) => {
      const key = `${String(row.employeeCode || '')}__${String(row.nextFollowSchedule || '')}`;
      historicalScheduleCounts.set(key, (historicalScheduleCounts.get(key) || 0) + 1);
    });

    const grouped = new Map<string, any[]>();
    rows.forEach((row) => {
      const key = `${row.logDate || ''}__${row.employeeCode || ''}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

    const revenueTimelineByEmployee = new Map<string, Array<{ date: string; revenue: number }>>();
    const revenueByEmployeeDate = new Map<string, number>();
    rows.forEach((row) => {
      const employeeCode = String(row.employeeCode || '');
      const date = String(row.logDate || '');
      const key = `${employeeCode}__${date}`;
      const revenue = Number(row.personalRevenue) || 0;
      revenueByEmployeeDate.set(key, (revenueByEmployeeDate.get(key) || 0) + revenue);
    });
    revenueByEmployeeDate.forEach((revenue, key) => {
      const [employeeCode, date] = key.split('__');
      const timeline = revenueTimelineByEmployee.get(employeeCode) || [];
      timeline.push({ date, revenue });
      revenueTimelineByEmployee.set(employeeCode, timeline);
    });
    revenueTimelineByEmployee.forEach((timeline) => {
      timeline.sort((a, b) => a.date.localeCompare(b.date));
    });

    const summaryRows = Array.from(grouped.values())
      .map((items, idx) => {
        const first = items[0] || {};
        const executionDate = String(first.logDate || '');
        const employeeCode = String(first.employeeCode || '');

        const totalCustomers = items.filter((row) => String(row.customerName || '').trim() !== '').length;
        const totalOldReferral = items.reduce((sum, row) => sum + (Number(row.oldReferral) || 0), 0);
        const totalCustomerFollowUp = items.reduce((sum, row) => sum + (Number(row.customerFollowUp) || 0), 0);
        const totalNoEarlyQuote = items.reduce((sum, row) => sum + (Number(row.noEarlyQuote) || 0), 0);
        const totalConsultEnoughLayers = items.reduce(
          (sum, row) => sum + (Number(row.consultEnoughLayers) || 0),
          0,
        );
        const totalClosedService = items.reduce((sum, row) => sum + (Number(row.closedService) || 0), 0);

        const rowsWithCustomer = items.filter((row) => String(row.customerName || '').trim() !== '');
        const rowsClosed0 = rowsWithCustomer.filter((row) => Number(row.closedService) === 0);
        const totalFollowRequired = items.reduce((sum, row) => sum + (Number(row.nextFollowRequired) || 0), 0);
        const totalPotentialWithScheduleWhenNotClosed = rowsClosed0.filter(
          (row) => Number(row.nextFollowRequired) === 1,
        ).length;
        const totalCustomersCondition17Eq0 = rowsWithCustomer.filter(
          (row) => Number(row.nextFollowRequired) === 0,
        ).length;
        const hangingCustomers = totalCustomersCondition17Eq0 - totalPotentialWithScheduleWhenNotClosed;

        const followAndClosed = items.filter(
          (row) => Number(row.customerFollowUp) === 1 && Number(row.closedService) === 1,
        ).length;

        const previousDaysMatchedScheduleInRange = rows.filter((row) => {
          const rowEmployeeCode = String(row.employeeCode || '');
          const rowDate = String(row.logDate || '');
          const rowSchedule = String(row.nextFollowSchedule || '');
          return (
            rowEmployeeCode === employeeCode
            && rowDate < executionDate
            && Number(row.nextFollowRequired) === 1
            && rowSchedule === executionDate
          );
        }).length;
        const previousDaysMatchedScheduleFromHistory =
          historicalScheduleCounts.get(`${employeeCode}__${executionDate}`) || 0;
        const previousDaysMatchedSchedule =
          previousDaysMatchedScheduleInRange + previousDaysMatchedScheduleFromHistory;

        const currentRevenue = Number(
          items.reduce((sum, row) => sum + (Number(row.personalRevenue) || 0), 0),
        );
        const timeline = revenueTimelineByEmployee.get(employeeCode) || [];
        const currentIndex = timeline.findIndex((item) => item.date === executionDate);
        const previousRevenue = currentIndex > 0 ? Number(timeline[currentIndex - 1]?.revenue || 0) : 0;

        return {
          stt: idx + 1,
          executionDate: first.logDate || '',
          unitName: first.unitName || '',
          employeeCode: first.employeeCode || '',
          employeeName: first.fullName || '',
          totalCustomersOfDay: totalCustomers,
          metrics: {
            m19: safeDiv(totalClosedService, totalCustomers),
            m20: safeDiv(totalOldReferral, totalCustomers),
            m21: safeDiv(totalNoEarlyQuote, totalCustomers),
            m22: totalConsultEnoughLayers,
            m23: totalFollowRequired,
            m24: totalPotentialWithScheduleWhenNotClosed,
            m25: totalCustomerFollowUp,
            m26: hangingCustomers,
            m27: safeDiv(followAndClosed, totalCustomerFollowUp),
            m28: safeDiv(totalPotentialWithScheduleWhenNotClosed, rowsClosed0.length),
            m29: safeDiv(totalCustomerFollowUp, previousDaysMatchedSchedule),
            m30: safeDiv(currentRevenue - previousRevenue, previousRevenue),
            totals: {
              totalOldReferral,
              totalNoEarlyQuote,
              totalConsultEnoughLayers,
              totalClosedService,
              totalFollowRequired,
              totalPotentialWithScheduleWhenNotClosed,
              totalCustomersCondition17Eq0,
              totalCustomerFollowUp,
              hangingCustomers,
              followAndClosed,
              previousDaysMatchedSchedule,
              previousDaysMatchedScheduleInRange,
              previousDaysMatchedScheduleFromHistory,
              currentRevenue,
              previousRevenue,
            },
          },
        };
      })
      .sort((a, b) => {
        const d = String(a.executionDate || '').localeCompare(String(b.executionDate || ''));
        if (d !== 0) return d;
        return String(a.employeeName || '').localeCompare(String(b.employeeName || ''));
      })
      .map((row, index) => ({ ...row, stt: index + 1 }));

    return {
      filters: {
        fromDate,
        toDate,
        unitId: filters.unitId || null,
        cutoffHour,
      },
      rows: summaryRows,
    };
  }

  async exportCoachingProvincialGd2SummaryFile(filters: { fromDate?: string; toDate?: string; unitId?: string }) {
    const summary = await this.getCoachingProvincialGd2Summary(filters);
    const percent = (v: number) => `${(Number(v || 0) * 100).toFixed(2)}%`;

    const headerTitles = [
      'STT',
      'Ngày thực hiện',
      'Đơn vị',
      'Mã nhân viên',
      'Tên nhân viên',
      'Tổng số khách hàng ngày đó',
      'Tỷ lệ chốt dịch vụ',
      'Tỷ lệ khách cũ giới thiệu',
      'Tỷ lệ cuộc không báo giá sớm',
      'Tỷ lệ tư vấn đủ 3 lớp',
      'Tỷ lệ theo đuổi có nội dung mới',
      'Số KH tiềm năng có lịch follow-up',
      'Số KH được theo đuổi trong ngày',
      'Số KH bị treo không có bước tiếp theo',
      'Tỷ lệ KH đồng ý sau follow-up',
      'Tỷ lệ KH tiềm năng có lịch follow-up',
      'Tỷ lệ theo đuổi đúng hẹn',
      'Tỷ lệ Doanh thu cá nhân mới tăng thêm',
    ];

    const formulaRow = [
      '',
      '',
      '',
      '',
      '',
      '',
      '(A) = tong(chot dich vu) / tong(khach hang)',
      '(B) = tong(khach cu gioi thieu) / tong(khach hang)',
      '(C) = tong(khong bao gia som) / tong(khach hang)',
      '(22) = tong(11)',
      '(23) = tong(17)',
      '(24) = tong((17) voi dieu kien (15)=0)',
      '(25) = tong(9)',
      '(26) = tong(6) voi dieu kien (17)=0 - tong(24)',
      '(27) = tong(9) voi dieu kien (15)=1 / tong(9)',
      '(28) = tong(24) / tong(15)=0',
      '(29) = tong(9) / tong(17) cac ngay truoc = ngay hien tai',
      '(Doanh thu) = (tong(16) - tong(16) ngay truoc) / tong(16) ngay truoc',
    ];

    const valueRows = (summary.rows || []).map((row: any) => [
      Number(row.stt || 0),
      row.executionDate || '',
      row.unitName || '',
      row.employeeCode || '',
      row.employeeName || '',
      Number(row.totalCustomersOfDay || 0),
      percent(row?.metrics?.m19),
      percent(row?.metrics?.m20),
      percent(row?.metrics?.m21),
      Number(row?.metrics?.m22 || 0),
      Number(row?.metrics?.m23 || 0),
      Number(row?.metrics?.m24 || 0),
      Number(row?.metrics?.m25 || 0),
      Number(row?.metrics?.m26 || 0),
      percent(row?.metrics?.m27),
      percent(row?.metrics?.m28),
      percent(row?.metrics?.m29),
      percent(row?.metrics?.m30),
    ]);

    const sheetData = [
      [`Mốc cắt ngày thống kê: ${String(summary?.filters?.cutoffHour || 7).padStart(2, '0')}:00`],
      headerTitles,
      formulaRow,
      ...valueRows,
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 18 } }];
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 20 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 22 },
      { wch: 26 },
      { wch: 30 },
      { wch: 28 },
      { wch: 30 },
      { wch: 28 },
      { wch: 34 },
      { wch: 28 },
      { wch: 24 },
      { wch: 30 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tong-hop-coaching-GD2');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fromDate = summary.filters.fromDate;

    return {
      buffer,
      fileName: `bao-cao-coaching-gd2-tong-hop-${fromDate}.xlsx`,
    };
  }

  async getCoachingProvincialSummary(filters: { fromDate?: string; toDate?: string; unitId?: string }) {
    const coachingData = await this.getCoachingProvincialData(filters);
    const rows = coachingData.rows || [];
    const cutoffHour = Number(coachingData.cutoffHour || 7);
    const safeDiv = (a: number, b: number) => (b > 0 ? Number((a / b).toFixed(4)) : 0);

    const totalCustomersByEmployeeDate = new Map<string, number>();
    rows.forEach((row) => {
      const dateKey = String(row.logDate || '');
      const employeeKey = String(row.employeeCode || '');
      const hasCustomer = String(row.customerName || '').trim() !== '';
      const key = `${dateKey}__${employeeKey}`;
      const current = totalCustomersByEmployeeDate.get(key) || 0;
      totalCustomersByEmployeeDate.set(key, current + (hasCustomer ? 1 : 0));
    });

    const grouped = new Map<string, any[]>();
    rows.forEach((row) => {
      const key = `${row.logDate || ''}__${row.employeeCode || ''}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

    const summaryRows = Array.from(grouped.values())
      .map((items, idx) => {
        const first = items[0] || {};
        const executionDate = String(first.logDate || '');
        const employeeCode = String(first.employeeCode || '');
        const total6 = items.filter((row) => String(row.customerName || '').trim() !== '').length;
        const total8 = items.reduce((sum, row) => sum + (Number(row.oldReferral) || 0), 0);
        const total9 = items.filter((row) => Number(row.customerFollowUp) > 0).length;
        const total10 = items.reduce((sum, row) => sum + (Number(row.noEarlyQuote) || 0), 0);
        const total11 = items.reduce((sum, row) => sum + (Number(row.consultStandard) || 0), 0);
        const total12 = items.reduce((sum, row) => sum + (Number(row.closedService) || 0), 0);
        const total14 = items.reduce((sum, row) => sum + (Number(row.nextFollowRequired) || 0), 0);

        const rowsClosed0 = items.filter((row) => Number(row.closedService) === 0);
        const rowsClosed1 = items.filter((row) => Number(row.closedService) === 1);
        const total15Eq1 = items.filter((row) => Number(row.nextFollowRequired) === 1).length;
        const total13Eq0 = rowsClosed0.length;
        const total23 = total15Eq1 + total13Eq0;
        const total22 = rowsClosed0.reduce((sum, row) => sum + (Number(row.nextFollowRequired) || 0), 0);
        const total7Eq1 = items.filter((row) => String(row.customerName || '').trim() !== '').length;
        const total24 = total7Eq1 + total13Eq0 - total23;
        const total15Eq1FromPreviousDaysMatchedSchedule = rows.filter((row) => {
          const rowEmployeeCode = String(row.employeeCode || '');
          const rowDate = String(row.logDate || '');
          const rowSchedule = String(row.nextFollowSchedule || '');
          return (
            rowEmployeeCode === employeeCode
            && rowDate < executionDate
            && Number(row.nextFollowRequired) === 1
            && rowSchedule === executionDate
          );
        }).length;
        const total27 = safeDiv(total9, total15Eq1FromPreviousDaysMatchedSchedule);

        return {
          stt: idx + 1,
          executionDate: first.logDate || '',
          unitName: first.unitName || '',
          employeeCode: first.employeeCode || '',
          employeeName: first.fullName || '',
          totalCustomersOfDay:
            totalCustomersByEmployeeDate.get(
              `${String(first.logDate || '')}__${String(first.employeeCode || '')}`,
            ) || 0,
          metrics: {
            m16: safeDiv(total12, total6),
            m17: safeDiv(total8, total6),
            m18: safeDiv(total10, total6),
            m19: total10,
            m20: total11,
            m21: safeDiv(total11, total6),
            m22: total23,
            m23: total9,
            m24: total24,
            m25: safeDiv(total9 + total12, total9),
            m26: safeDiv(total23, rowsClosed0.length),
            m27: total27,
          },
        };
      })
      .sort((a, b) => {
        const d = String(a.executionDate || '').localeCompare(String(b.executionDate || ''));
        if (d !== 0) return d;
        return String(a.employeeName || '').localeCompare(String(b.employeeName || ''));
      })
      .map((row, index) => ({ ...row, stt: index + 1 }));

    return {
      filters: {
        fromDate: filters.fromDate || new Date().toISOString().slice(0, 10),
        toDate: filters.toDate || filters.fromDate || new Date().toISOString().slice(0, 10),
        unitId: filters.unitId || null,
        cutoffHour,
      },
      rows: summaryRows,
    };
  }

  async exportCoachingProvincialSummaryFile(filters: { fromDate?: string; toDate?: string; unitId?: string }) {
    const summary = await this.getCoachingProvincialSummary(filters);
    const percent = (v: number) => `${(Number(v || 0) * 100).toFixed(2)}%`;

    const headerTitles = [
      'STT',
      'Ngày thực hiện',
      'Đơn vị',
      'Mã nhân viên',
      'Tên nhân viên',
      'Tổng số khách hàng ngày đó',
      'Tỷ lệ chốt dịch vụ',
      'Tỷ lệ khách cũ giới thiệu',
      'Tỷ lệ cuộc không báo giá sớm',
      'Tỷ lệ nhân viên trả lời chuyển hướng đúng',
      'Số lần tư vấn có hỏi nhu cầu trước khi nói giá',
      'Tỷ lệ cuộc tư vấn đủ chuẩn',
      'Số khách hàng tiềm năng có lịch follow-up',
      'Số khách hàng được theo đuổi mỗi ngày',
      'Số khách hàng bị treo không có bước tiếp theo',
      'Tỷ lệ khách hàng đồng ý dịch vụ sau follow-up',
      'Tỷ lệ khách hàng tiềm năng có lịch follow-up',
      'Tỷ lệ theo đuổi đúng hẹn',
    ];

    const formulaRow = [
      '',
      '',
      '',
      '',
      '',
      '',
      '(17) = tong(13) / tong(7)',
      '(18) = tong(9) / tong(7)',
      '(19) = tong(11) / tong(7)',
      '(20) = tong(11)',
      '(21) = tong(12)',
      '(22) = tong(12) / tong(7)',
      '(23) = (tong(15)=1) + (tong(13)=0)',
      '(24) = tong(10)',
      '(25) = ((tong(7)=1) + (tong(13)=0)) - (23)',
      '(26) = ((tong(10)=1) + (tong(13)=1)) / tong(10)',
      '(27) = tong(23) / so dong (13)=0',
      '(28) = tong(10) hien tai / tong(15)=1 cac ngay truoc co lich follow = ngay hien tai',
    ];

    const valueRows = (summary.rows || []).map((row: any) => [
      Number(row.stt || 0),
      row.executionDate || '',
      row.unitName || '',
      row.employeeCode || '',
      row.employeeName || '',
      Number(row.totalCustomersOfDay || 0),
      percent(row?.metrics?.m16),
      percent(row?.metrics?.m17),
      percent(row?.metrics?.m18),
      Number(row?.metrics?.m19 || 0),
      Number(row?.metrics?.m20 || 0),
      percent(row?.metrics?.m21),
      Number(row?.metrics?.m22 || 0),
      Number(row?.metrics?.m23 || 0),
      Number(row?.metrics?.m24 || 0),
      percent(row?.metrics?.m25),
      percent(row?.metrics?.m26),
      percent(row?.metrics?.m27),
    ]);

    const sheetData = [
      [`Mốc cắt ngày thống kê: ${String(summary?.filters?.cutoffHour || 7).padStart(2, '0')}:00`],
      headerTitles,
      formulaRow,
      ...valueRows,
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 17 } }];
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 20 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 28 },
      { wch: 34 },
      { wch: 24 },
      { wch: 30 },
      { wch: 26 },
      { wch: 34 },
      { wch: 32 },
      { wch: 32 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tong-hop-coaching');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fromDate = summary.filters.fromDate;

    return {
      buffer,
      fileName: `bao-cao-coaching-tong-hop-${fromDate}.xlsx`,
    };
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

  async exportApprovedJournalsForms7912File(
    currentUser: any,
    filters: { fromDate?: string; toDate?: string; unitId?: string; keyword?: string },
  ) {
    const traceId = `exp3457912-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // #region debug-point A:export-7912-entry
    reportDebugEvent({
      hypothesisId: 'A',
      traceId,
      location: 'behavior.service.ts:exportApprovedJournalsForms7912File:entry',
      msg: 'export 3/4/5/7/9/12 requested',
      data: {
        role: currentUser?.role,
        unitId: currentUser?.unitId,
        userId: currentUser?.id || currentUser?.sub,
        filters,
      },
    });
    // #endregion
    try {
      const form7TableName = 'phase_3_standard_logs';
      const form9TableName = 'income_breakthrough_logs';
      const form12TableName = 'career_commitment_logs';

      const [hasForm7Table, hasForm9Table, hasForm12Table] = await Promise.all([
        this.hasDatabaseTable(form7TableName),
        this.hasDatabaseTable(form9TableName),
        this.hasDatabaseTable(form12TableName),
      ]);

      const [form7Columns, form9Columns, form12Columns] = await Promise.all([
        hasForm7Table
          ? this.getExistingDatabaseColumns(form7TableName, [
              'user_id',
              'log_date',
              'kept_standard',
              'backslide_sign',
              'solution',
            ])
          : Promise.resolve(new Set<string>()),
        hasForm9Table
          ? this.getExistingDatabaseColumns(form9TableName, [
              'user_id',
              'log_date',
              'self_limit_area',
              'proof_behavior',
              'raise_standard',
              'action_plan',
            ])
          : Promise.resolve(new Set<string>()),
        hasForm12Table
          ? this.getExistingDatabaseColumns(form12TableName, [
              'user_id',
              'log_date',
              'declaration_text',
              'commitment_signature',
            ])
          : Promise.resolve(new Set<string>()),
      ]);

      // #region debug-point A:export-7912-schema
      reportDebugEvent({
        hypothesisId: 'A',
        traceId,
        location: 'behavior.service.ts:exportApprovedJournalsForms7912File:schema',
        msg: 'schema inspection completed',
        data: {
          hasForm7Table,
          hasForm9Table,
          hasForm12Table,
          form7Columns: [...form7Columns],
          form9Columns: [...form9Columns],
          form12Columns: [...form12Columns],
        },
      });
      // #endregion

      const form7Join =
        hasForm7Table && form7Columns.has('user_id') && form7Columns.has('log_date')
          ? `
      LEFT JOIN ${form7TableName} f7
        ON f7.user_id::text = base.user_id
        AND f7.log_date = base.log_date`
          : '';
      const form9Join =
        hasForm9Table && form9Columns.has('user_id') && form9Columns.has('log_date')
          ? `
      LEFT JOIN ${form9TableName} f9
        ON f9.user_id::text = base.user_id
        AND f9.log_date = base.log_date`
          : '';
      const form12Join =
        hasForm12Table && form12Columns.has('user_id') && form12Columns.has('log_date')
          ? `
      LEFT JOIN ${form12TableName} f12
        ON f12.user_id::text = base.user_id
        AND f12.log_date = base.log_date`
          : '';

      const form7Select = [
        `CASE WHEN r7.user_id IS NOT NULL THEN 'Đã duyệt' ELSE 'Chưa duyệt' END AS "Mẫu 7 - Trạng thái"`,
        form7Join && form7Columns.has('kept_standard')
          ? `COALESCE(f7.kept_standard, '') AS "Mẫu 7 - Chuẩn đã giữ"`
          : `'' AS "Mẫu 7 - Chuẩn đã giữ"`,
        form7Join && form7Columns.has('backslide_sign')
          ? `COALESCE(f7.backslide_sign, '') AS "Mẫu 7 - Dấu hiệu tụt chuẩn"`
          : `'' AS "Mẫu 7 - Dấu hiệu tụt chuẩn"`,
        form7Join && form7Columns.has('solution')
          ? `COALESCE(f7.solution, '') AS "Mẫu 7 - Cách xử lý"`
          : `'' AS "Mẫu 7 - Cách xử lý"`,
      ].join(',\n        ');

      const form9Select = [
        `CASE WHEN r9.user_id IS NOT NULL THEN 'Đã duyệt' ELSE 'Chưa duyệt' END AS "Mẫu 9 - Trạng thái"`,
        form9Join && form9Columns.has('self_limit_area')
          ? `COALESCE(f9.self_limit_area, '') AS "Mẫu 9 - Tự giới hạn"`
          : `'' AS "Mẫu 9 - Tự giới hạn"`,
        form9Join && form9Columns.has('proof_behavior')
          ? `COALESCE(f9.proof_behavior, '') AS "Mẫu 9 - Hành vi chứng minh"`
          : `'' AS "Mẫu 9 - Hành vi chứng minh"`,
        form9Join && form9Columns.has('raise_standard')
          ? `COALESCE(f9.raise_standard, '') AS "Mẫu 9 - Nâng chuẩn"`
          : `'' AS "Mẫu 9 - Nâng chuẩn"`,
        form9Join && form9Columns.has('action_plan')
          ? `COALESCE(f9.action_plan, '') AS "Mẫu 9 - Hành động"`
          : `'' AS "Mẫu 9 - Hành động"`,
      ].join(',\n        ');

      const form12Select = [
        `CASE WHEN r12.user_id IS NOT NULL THEN 'Đã duyệt' ELSE 'Chưa duyệt' END AS "Mẫu 12 - Trạng thái"`,
        form12Join && form12Columns.has('declaration_text')
          ? `COALESCE(f12.declaration_text, '') AS "Mẫu 12 - Tuyên ngôn"`
          : `'' AS "Mẫu 12 - Tuyên ngôn"`,
        form12Join && form12Columns.has('commitment_signature')
          ? `COALESCE(f12.commitment_signature, '') AS "Mẫu 12 - Ký tên"`
          : `'' AS "Mẫu 12 - Ký tên"`,
      ].join(',\n        ');

      let query = `
      WITH form4_agg AS (
        SELECT
          s.user_id,
          s.log_date,
          STRING_AGG(COALESCE(s.customer_name, ''), ' | ' ORDER BY s.created_at) AS customer_names,
          STRING_AGG(COALESCE(s.customer_issue, ''), ' | ' ORDER BY s.created_at) AS customer_issues,
          STRING_AGG(COALESCE(s.solution_offered, ''), ' | ' ORDER BY s.created_at) AS solutions,
          STRING_AGG(COALESCE(s.result, ''), ' | ' ORDER BY s.created_at) AS results
        FROM sales_activity_reports s
        GROUP BY s.user_id, s.log_date
      ),
      approved_forms AS (
        SELECT d.user_id::text AS user_id, d.log_date, d.form_type
        FROM daily_form_reviews d
        WHERE d.status = 'APPROVED'
          AND d.form_type IN ('FORM_3', 'FORM_4', 'FORM_5', 'FORM_7', 'FORM_9', 'FORM_12')
      ),
      base_dates AS (
        SELECT user_id, log_date
        FROM approved_forms
        GROUP BY user_id, log_date
      )
      SELECT
        TO_CHAR(base.log_date, 'YYYY-MM-DD') AS "Ngày",
        un.name AS "Tên đơn vị",
        u."fullName" AS "Tên nhân viên",
        u.username AS "Tài khoản",
        u."employeeCode" AS "Mã nhân viên",
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
        COALESCE(e5.different_action, '') AS "Mẫu 5 - Việc làm khác đi",
        ${form7Select},
        ${form9Select},
        ${form12Select}
      FROM base_dates base
      INNER JOIN users u ON u.id::text = base.user_id
      INNER JOIN units un ON un.id = u."unitId"
      LEFT JOIN approved_forms r3
        ON r3.user_id = base.user_id
        AND r3.log_date = base.log_date
        AND r3.form_type = 'FORM_3'
      LEFT JOIN mindset_logs m3
        ON m3.user_id::text = base.user_id
        AND m3.log_date = base.log_date
      LEFT JOIN approved_forms r4
        ON r4.user_id = base.user_id
        AND r4.log_date = base.log_date
        AND r4.form_type = 'FORM_4'
      LEFT JOIN form4_agg f4
        ON f4.user_id::text = base.user_id
        AND f4.log_date = base.log_date
      LEFT JOIN approved_forms r5
        ON r5.user_id = base.user_id
        AND r5.log_date = base.log_date
        AND r5.form_type = 'FORM_5'
      LEFT JOIN end_of_day_logs e5
        ON e5.user_id::text = base.user_id
        AND e5.log_date = base.log_date
      LEFT JOIN approved_forms r7
        ON r7.user_id = base.user_id
        AND r7.log_date = base.log_date
        AND r7.form_type = 'FORM_7'
      ${form7Join}
      LEFT JOIN approved_forms r9
        ON r9.user_id = base.user_id
        AND r9.log_date = base.log_date
        AND r9.form_type = 'FORM_9'
      ${form9Join}
      LEFT JOIN approved_forms r12
        ON r12.user_id = base.user_id
        AND r12.log_date = base.log_date
        AND r12.form_type = 'FORM_12'
      ${form12Join}
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

      // #region debug-point C:export-7912-before-query
      reportDebugEvent({
        hypothesisId: 'C',
        traceId,
        location: 'behavior.service.ts:exportApprovedJournalsForms7912File:before-query',
        msg: 'about to execute export query',
        data: {
          params,
          queryTail: query.slice(-1200),
        },
      });
      // #endregion
      const rows = await this.journalsRepository.query(query, params);
      // #region debug-point C:export-7912-after-query
      reportDebugEvent({
        hypothesisId: 'C',
        traceId,
        location: 'behavior.service.ts:exportApprovedJournalsForms7912File:after-query',
        msg: 'query executed',
        data: {
          rowCount: rows.length,
          sampleRowKeys: rows[0] ? Object.keys(rows[0]) : [],
        },
      });
      // #endregion
      const sanitizedRows = this.sanitizeExcelRows(rows);
      // #region debug-point B:export-7912-before-xlsx
      reportDebugEvent({
        hypothesisId: 'B',
        traceId,
        location: 'behavior.service.ts:exportApprovedJournalsForms7912File:before-xlsx',
        msg: 'about to generate xlsx workbook',
        data: {
          rowCount: sanitizedRows.length,
          firstRowPreview: sanitizedRows[0] || null,
        },
      });
      // #endregion
      const worksheet = XLSX.utils.json_to_sheet(sanitizedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau3457912');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      // #region debug-point B:export-7912-after-xlsx
      reportDebugEvent({
        hypothesisId: 'B',
        traceId,
        location: 'behavior.service.ts:exportApprovedJournalsForms7912File:after-xlsx',
        msg: 'xlsx generated successfully',
        data: {
          bufferLength: buffer?.length || 0,
        },
      });
      // #endregion

      return {
        buffer,
        fileName: `bao-cao-mau-3-4-5-7-9-12-${filters.fromDate || 'all'}-${filters.toDate || 'all'}.xlsx`,
      };
    } catch (error: any) {
      // #region debug-point E:export-7912-error
      reportDebugEvent({
        hypothesisId: 'E',
        traceId,
        location: 'behavior.service.ts:exportApprovedJournalsForms7912File:catch',
        msg: 'export 3/4/5/7/9/12 failed',
        data: {
          message: error?.message || '',
          name: error?.name || '',
          stack: String(error?.stack || '').slice(0, 4000),
          code: error?.code || '',
          detail: error?.detail || '',
        },
      });
      // #endregion
      throw error;
    }
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
      .andWhere('COALESCE("unit"."excludeFromStatistics", false) = false');

    if (currentUser.role === Role.MANAGER) {
      usersQuery = usersQuery.andWhere('u.unitId = :unitId', { unitId: currentUser.unitId });
    }

    const allUsers = await usersQuery.getMany();

    const journals = await this.journalsRepository.find({
      where: { reportDate: targetDate },
      select: ['userId'],
    });

    const submittedUserIds = new Set(journals.map((j) => j.userId));
    const phaseConfigs = await this.journeyPhaseConfigsRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', startDate: 'ASC' },
    });
    const { phaseInfo, formDefs } = this.resolveJourneyPhaseStatsByDate(targetDate, phaseConfigs);
    const formSubmissionEntries: Array<[string, Set<string>]> = await Promise.all(
      formDefs.map(
        async (form): Promise<[string, Set<string>]> => [
          form.key,
          await this.getSubmittedUserIdsByJourneyForm(form.key, targetDate),
        ],
      ),
    );
    const submittedUserIdsByForm = new Map<string, Set<string>>(formSubmissionEntries);
    const toUserSummary = (user: User): JourneyUserSummary => ({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      employeeCode: user.employeeCode || '',
    });
    const createFormStats = (form: JourneyFormDefinition): JourneyFormStats => ({
      key: form.key,
      label: form.label,
      formType: form.formType,
      submitted: 0,
      notSubmitted: 0,
      submittedRate: 0,
      notSubmittedRate: 0,
      submittedUsers: [],
      notSubmittedUsers: [],
    });

    const provinceStats = {
      total: allUsers.length,
      submitted: 0,
      notSubmitted: 0,
      submittedRate: 0,
      notSubmittedRate: 0,
    };
    const provincePhaseStats = {
      total: allUsers.length,
      forms: formDefs.map((form) => createFormStats(form)),
    };
    const provincePhaseStatsMap = new Map<string, JourneyFormStats>(
      provincePhaseStats.forms.map((form) => [form.key, form]),
    );

    const unitMap = new Map<string, JournalSubmissionUnitStats>();

    allUsers.forEach((user) => {
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
          notSubmittedUsers: [],
          forms: formDefs.map((form) => createFormStats(form)),
        });
      }

      const unitStats = unitMap.get(unitId)!;
      unitStats.total += 1;
      if (hasSubmitted) {
        unitStats.submitted += 1;
        unitStats.submittedUsers.push(toUserSummary(user));
      } else {
        unitStats.notSubmitted += 1;
        unitStats.notSubmittedUsers.push(toUserSummary(user));
      }

      const unitFormsMap = new Map<string, JourneyFormStats>(
        unitStats.forms.map((form) => [form.key, form]),
      );
      formDefs.forEach((form) => {
        const isSubmittedInForm = submittedUserIdsByForm.get(form.key)?.has(user.id);
        const provinceFormStats = provincePhaseStatsMap.get(form.key);
        const unitFormStats = unitFormsMap.get(form.key);
        if (!provinceFormStats || !unitFormStats) {
          return;
        }

        if (isSubmittedInForm) {
          provinceFormStats.submitted += 1;
          provinceFormStats.submittedUsers.push(toUserSummary(user));
          unitFormStats.submitted += 1;
          unitFormStats.submittedUsers.push(toUserSummary(user));
        } else {
          provinceFormStats.notSubmitted += 1;
          provinceFormStats.notSubmittedUsers.push(toUserSummary(user));
          unitFormStats.notSubmitted += 1;
          unitFormStats.notSubmittedUsers.push(toUserSummary(user));
        }
      });
    });

    provincePhaseStats.forms.forEach((form) => {
      form.submittedRate =
        provincePhaseStats.total > 0
          ? Number(((form.submitted / provincePhaseStats.total) * 100).toFixed(2))
          : 0;
      form.notSubmittedRate =
        provincePhaseStats.total > 0
          ? Number(((form.notSubmitted / provincePhaseStats.total) * 100).toFixed(2))
          : 0;
    });

    provinceStats.submittedRate =
      provinceStats.total > 0
        ? Number(((provinceStats.submitted / provinceStats.total) * 100).toFixed(2))
        : 0;
    provinceStats.notSubmittedRate =
      provinceStats.total > 0
        ? Number(((provinceStats.notSubmitted / provinceStats.total) * 100).toFixed(2))
        : 0;

    const unitStatsArray = Array.from(unitMap.values())
      .map((u) => {
        u.submittedRate = u.total > 0 ? Number(((u.submitted / u.total) * 100).toFixed(2)) : 0;
        u.notSubmittedRate =
          u.total > 0 ? Number(((u.notSubmitted / u.total) * 100).toFixed(2)) : 0;
        u.forms = (u.forms || []).map((form) => ({
          ...form,
          submittedRate: u.total > 0 ? Number(((form.submitted / u.total) * 100).toFixed(2)) : 0,
          notSubmittedRate:
            u.total > 0 ? Number(((form.notSubmitted / u.total) * 100).toFixed(2)) : 0,
        }));
        return u;
      })
      .sort((a, b) => a.unitName.localeCompare(b.unitName, 'vi'));

    const phaseUnits = unitStatsArray.map((item) => ({
      unitId: item.unitId,
      unitName: item.unitName,
      total: item.total,
      forms: item.forms,
    }));

    const phaseForms = provincePhaseStats.forms.map((form) => ({
      key: form.key,
      label: form.label,
      formType: form.formType,
      submitted: form.submitted,
      notSubmitted: form.notSubmitted,
      submittedRate: form.submittedRate,
      notSubmittedRate: form.notSubmittedRate,
      submittedUsers: form.submittedUsers,
      notSubmittedUsers: form.notSubmittedUsers,
    }));

    return {
      date: targetDate,
      province: provinceStats,
      units: unitStatsArray.sort((a, b) => b.submittedRate - a.submittedRate),
      phaseInfo,
      phaseForms,
      phaseProvince: {
        total: provincePhaseStats.total,
        forms: phaseForms,
      },
      phaseUnits,
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
      .andWhere('COALESCE("un"."excludeFromStatistics", false) = false');

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

  async exportManagerWeeklyJournalsStatusByUnitFile(
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
      WITH employee_base AS (
        SELECT
          u.id AS user_id,
          un.id AS unit_id,
          un.name AS unit_name
        FROM users u
        INNER JOIN units un ON un.id = u."unitId"
        WHERE u.role = 'EMPLOYEE'
          AND (un."excludeFromStatistics" IS NULL OR un."excludeFromStatistics" = false)
      ),
      form10_data AS (
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
        eb.unit_name AS "Tên đơn vị",
        $2 AS "Tuần",
        $3 AS "Từ ngày",
        $4 AS "Đến ngày",
        COUNT(*)::int AS "Tổng nhân viên",
        SUM(CASE WHEN COALESCE(f10.form10_state, 0) > 0 THEN 1 ELSE 0 END)::int AS "Mẫu 10 - Đã nhập",
        ROUND(
          SUM(CASE WHEN COALESCE(f10.form10_state, 0) > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) AS "Mẫu 10 - Tỷ lệ nhập (%)",
        SUM(CASE WHEN COALESCE(f10.form10_state, 0) = 2 THEN 1 ELSE 0 END)::int AS "Mẫu 10 - Đã duyệt",
        ROUND(
          SUM(CASE WHEN COALESCE(f10.form10_state, 0) = 2 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) AS "Mẫu 10 - Tỷ lệ duyệt (%)",
        SUM(CASE WHEN COALESCE(f10.form10_state, 0) = 0 THEN 1 ELSE 0 END)::int AS "Mẫu 10 - Chưa nhập",
        ROUND(
          SUM(CASE WHEN COALESCE(f10.form10_state, 0) = 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) AS "Mẫu 10 - Tỷ lệ chưa nhập (%)",
        SUM(CASE WHEN COALESCE(f11.form11_state, 0) > 0 THEN 1 ELSE 0 END)::int AS "Mẫu 11 - Đã nhập",
        ROUND(
          SUM(CASE WHEN COALESCE(f11.form11_state, 0) > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) AS "Mẫu 11 - Tỷ lệ nhập (%)",
        SUM(CASE WHEN COALESCE(f11.form11_state, 0) = 2 THEN 1 ELSE 0 END)::int AS "Mẫu 11 - Đã duyệt",
        ROUND(
          SUM(CASE WHEN COALESCE(f11.form11_state, 0) = 2 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) AS "Mẫu 11 - Tỷ lệ duyệt (%)",
        SUM(CASE WHEN COALESCE(f11.form11_state, 0) = 0 THEN 1 ELSE 0 END)::int AS "Mẫu 11 - Chưa nhập",
        ROUND(
          SUM(CASE WHEN COALESCE(f11.form11_state, 0) = 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) AS "Mẫu 11 - Tỷ lệ chưa nhập (%)",
        SUM(
          CASE
            WHEN COALESCE(f10.form10_state, 0) > 0 AND COALESCE(f11.form11_state, 0) > 0 THEN 1
            ELSE 0
          END
        )::int AS "Đủ 2 mẫu",
        ROUND(
          SUM(
            CASE
              WHEN COALESCE(f10.form10_state, 0) > 0 AND COALESCE(f11.form11_state, 0) > 0 THEN 1
              ELSE 0
            END
          ) * 100.0 / NULLIF(COUNT(*), 0),
          2
        ) AS "Tỷ lệ đủ 2 mẫu (%)"
      FROM employee_base eb
      LEFT JOIN form10_data f10 ON eb.user_id = f10.user_id
      LEFT JOIN form11_data f11 ON eb.user_id = f11.user_id
      WHERE 1 = 1
    `;

    const params: any[] = [weekId, week.weekName, week.startDate, week.endDate];
    let paramIndex = 5;

    if (user.role === Role.MANAGER) {
      query += ` AND eb.unit_id = $${paramIndex++}`;
      params.push(user.unitId);
    } else if (filters.unitId) {
      query += ` AND eb.unit_id = $${paramIndex++}`;
      params.push(filters.unitId);
    }

    query += `
      GROUP BY eb.unit_name
      ORDER BY "Tỷ lệ đủ 2 mẫu (%)" DESC, eb.unit_name ASC
    `;

    const rows = await this.journalsRepository.query(query, params);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DonViTyLeMau1011');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const normalizedWeek = String(week.weekName || 'all')
      .replace(/[^\w-]+/g, '-')
      .toLowerCase();

    return {
      buffer,
      fileName: `bao-cao-mau-10-11-theo-don-vi-${normalizedWeek}.xlsx`,
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
