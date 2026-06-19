import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BehaviorChecklistLog } from 'src/behavior/entities/behavior-checklist-log.entity';
import { EndOfDayLog } from 'src/behavior/entities/end-of-day-log.entity';
import { ManagerCoachingLog } from 'src/behavior/entities/manager-coaching-log.entity';
import { MindsetLog } from 'src/behavior/entities/mindset-log.entity';
import { SalesActivityReport } from 'src/behavior/entities/sales-activity-report.entity';
import { SystemConfig } from 'src/behavior/entities/system-config.entity';
import { Role } from 'src/common/enums/role.enum';
import { User } from 'src/users/entities/user.entity';
import { Unit } from 'src/users/entities/unit.entity';
import { Between, In, Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { CreateManagerDailyScoreCriterionDto } from './dto/create-manager-daily-score-criterion.dto';
import { SubmitManagerDailyScoreDto } from './dto/submit-manager-daily-score.dto';
import { UpdateManagerDailyScoreCriterionDto } from './dto/update-manager-daily-score-criterion.dto';
import { ManagerDailyScoreCriterion } from './entities/manager-daily-score-criterion.entity';
import { ManagerDailyScoreImport } from './entities/manager-daily-score-import.entity';
import { ManagerDailyScoreItem } from './entities/manager-daily-score-item.entity';
import { ManagerDailyScoreSheet } from './entities/manager-daily-score-sheet.entity';
import { validateActionTimeForDate } from '../common/utils/time-validator.util';

const DEFAULT_CRITERIA = [
  ['LEARNING', 'I. Học tập, rèn luyện', 1, 'LEARNING_TRAINING_PARTICIPATION', 1, '1', 'Tham gia đào tạo, giao ban hằng ngày', 5],
  ['LEARNING', 'I. Học tập, rèn luyện', 1, 'LEARNING_WORKBOOK_EXERCISE', 2, '2.1', 'Làm bài tập Sổ tay thực hành', 4],
  ['LEARNING', 'I. Học tập, rèn luyện', 1, 'LEARNING_MULTIPLE_CHOICE', 3, '2.2', 'Làm bài tập trắc nghiệm', 3],
  ['LEARNING', 'I. Học tập, rèn luyện', 1, 'LEARNING_STAGE_EXERCISE', 4, '2.3', 'Chủ động làm bài tập theo giai đoạn', 3],
  ['BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_SALES_PLAN', 5, '1', 'Lập kế hoạch bán hàng (chương trình hành động cá nhân)', 3],
  ['BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_PREPARE_CONSULT', 6, '2', 'Chuẩn bị câu hỏi tư vấn thu nhập cao cho từng đối tượng khách hàng', 2],
  ['BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_CUSTOMERS_CONTACTED', 7, '3', 'Số khách hàng tiếp cận', 10],
  ['BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_OLD_CUSTOMERS_CONSULTED', 8, '4', 'Số khách hàng cũ tư vấn (KH theo lịch hẹn/ KH hiện hữu)', 4],
  ['BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_SUCCESSFUL_CARE_CALLS', 9, '5', 'Số cuộc gọi CSKH thành công (chỉ dành riêng cho TT CSKH)', 10],
  ['BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_DAILY_CHECKLIST', 10, '6', 'Ghi nhật ký bán hàng, checklist hành vi', 7],
  ['BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_DIRECTOR_EVALUATION', 11, '7', 'Giám đốc đánh giá', 9],
  ['PERFORMANCE', 'III. Nâng cao hiệu quả hoạt động', 3, 'PERFORMANCE_RENEWAL_SERVICES', 12, '1', 'Số dịch vụ phát triển mới/gia hạn/nâng gói hàng chu kỳ', 10],
  ['PERFORMANCE', 'III. Nâng cao hiệu quả hoạt động', 3, 'PERFORMANCE_NEW_PTM_PACKAGES', 13, '2', 'Số gói ca PTM mới', 4],
  ['PERFORMANCE', 'III. Nâng cao hiệu quả hoạt động', 3, 'PERFORMANCE_CLOSE_RATE', 14, '3', 'Tỷ lệ chốt dịch vụ', 4],
  ['PERFORMANCE', 'III. Nâng cao hiệu quả hoạt động', 3, 'PERFORMANCE_REVENUE', 15, '4', 'Doanh thu PTM/GH cá nhân', 30],
  ['PERFORMANCE', 'III. Nâng cao hiệu quả hoạt động', 3, 'PERFORMANCE_RETURNING_REFERRED', 16, '5', 'Số KH quay lại giới thiệu KH mới', 2],
] as const;
const BEHAVIOR_SECTION_CODE = 'BEHAVIOR';
const BEHAVIOR_SECTION_MAX_SCORE = 35;
const BEHAVIOR_CUSTOMERS_CONTACTED_CODE = 'BEHAVIOR_CUSTOMERS_CONTACTED';
const BEHAVIOR_OLD_CUSTOMERS_CONSULTED_CODE = 'BEHAVIOR_OLD_CUSTOMERS_CONSULTED';
const BEHAVIOR_SUCCESSFUL_CARE_CALLS_CODE = 'BEHAVIOR_SUCCESSFUL_CARE_CALLS';
const BEHAVIOR_SALES_PLAN_CODE = 'BEHAVIOR_SALES_PLAN';
const BEHAVIOR_PREPARE_CONSULT_CODE = 'BEHAVIOR_PREPARE_CONSULT';
const BEHAVIOR_DAILY_CHECKLIST_CODE = 'BEHAVIOR_DAILY_CHECKLIST';
const BEHAVIOR_DIRECTOR_EVALUATION_CODE = 'BEHAVIOR_DIRECTOR_EVALUATION';
const PERFORMANCE_RENEWAL_SERVICES_CODE = 'PERFORMANCE_RENEWAL_SERVICES';
const PERFORMANCE_NEW_PTM_PACKAGES_CODE = 'PERFORMANCE_NEW_PTM_PACKAGES';
const PERFORMANCE_CLOSE_RATE_CODE = 'PERFORMANCE_CLOSE_RATE';
const PERFORMANCE_REVENUE_CODE = 'PERFORMANCE_REVENUE';
const PERFORMANCE_RETURNING_REFERRED_CODE = 'PERFORMANCE_RETURNING_REFERRED';

@Injectable()
export class ManagerDailyScoresService {
  constructor(
    @InjectRepository(BehaviorChecklistLog)
    private readonly behaviorChecklistLogsRepository: Repository<BehaviorChecklistLog>,
    @InjectRepository(MindsetLog)
    private readonly mindsetLogsRepository: Repository<MindsetLog>,
    @InjectRepository(SalesActivityReport)
    private readonly salesActivityReportsRepository: Repository<SalesActivityReport>,
    @InjectRepository(EndOfDayLog)
    private readonly endOfDayLogsRepository: Repository<EndOfDayLog>,
    @InjectRepository(ManagerCoachingLog)
    private readonly managerCoachingLogsRepository: Repository<ManagerCoachingLog>,
    @InjectRepository(ManagerDailyScoreCriterion)
    private readonly criteriaRepository: Repository<ManagerDailyScoreCriterion>,
    @InjectRepository(ManagerDailyScoreImport)
    private readonly importsRepository: Repository<ManagerDailyScoreImport>,
    @InjectRepository(ManagerDailyScoreSheet)
    private readonly sheetsRepository: Repository<ManagerDailyScoreSheet>,
    @InjectRepository(ManagerDailyScoreItem)
    private readonly itemsRepository: Repository<ManagerDailyScoreItem>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigsRepository: Repository<SystemConfig>,
  ) {}

  private toDateKey(value: string) {
    if (!value) {
      return '';
    }
    return value.slice(0, 10);
  }

  private normalizeNumber(value: string | number) {
    const parsed = Number(value || 0);
    return Number(parsed.toFixed(2));
  }

  private parseImportedNumber(value: any) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const normalized = String(value).replace(/\s+/g, '').replace(/,/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : NaN;
  }

  private async getConfiguredHolidayDates() {
    const lockedDatesConfig = await this.systemConfigsRepository.findOne({
      where: { key: 'LOCKED_ENTRY_DATES' },
    });
    return new Set(
      String(lockedDatesConfig?.value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  private getValidDateKeysInRange(fromDate: string, toDate: string, holidayDates: Set<string>) {
    const from = this.toDateKey(fromDate || '');
    const to = this.toDateKey(toDate || '');
    if (!from || !to || from > to) {
      return [];
    }
    const dates: string[] = [];
    const cursor = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    while (cursor <= end) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const day = cursor.getUTCDay();
      const isWeekend = day === 0 || day === 6;
      if (!isWeekend && !holidayDates.has(dateKey)) {
        dates.push(dateKey);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }

  private isWeekendDateKey(dateKey: string) {
    if (!dateKey) {
      return false;
    }
    const date = new Date(`${dateKey}T00:00:00Z`);
    const day = date.getUTCDay();
    return day === 0 || day === 6;
  }

  private buildEmployeeDateKey(employeeId: string, dateKey: string) {
    return `${String(employeeId || '')}__${String(dateKey || '')}`;
  }

  private normalizeImportedMetric(value: string | number | null | undefined) {
    const parsed = Number(value || 0);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return Number(parsed.toFixed(2));
  }

  private safeNumericInput(value: any) {
    const parsed = this.parseImportedNumber(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private isCustomerCareUnit(unit?: Unit | null) {
    const normalized = `${String(unit?.code || '')} ${String(unit?.name || '')}`.toUpperCase();
    return normalized.includes('CSKH');
  }

  private calculateSuccessfulCareCallsScore(callCount: number) {
    if (callCount >= 100) {
      return 10;
    }
    if (callCount >= 90) {
      return 8;
    }
    if (callCount >= 80) {
      return 6;
    }
    if (callCount >= 60) {
      return 4;
    }
    return 0;
  }

  private calculateSuccessfulServicesScore(serviceCount: number) {
    if (serviceCount >= 3) {
      return 10;
    }
    if (serviceCount >= 2) {
      return 8;
    }
    if (serviceCount >= 1) {
      return 6;
    }
    return 0;
  }

  private calculateHighPtmPackagesScore(packageCount: number) {
    if (packageCount >= 2) {
      return 4;
    }
    if (packageCount >= 1) {
      return 2;
    }
    return 0;
  }

  private calculateCloseRateScore(closeRate: number) {
    if (closeRate >= 0.3) {
      return 4;
    }
    if (closeRate >= 0.2) {
      return 3;
    }
    if (closeRate >= 0.1) {
      return 2;
    }
    return 0;
  }

  private calculateRevenueScore(revenueThousand: number) {
    if (revenueThousand >= 1000) {
      return 30;
    }
    if (revenueThousand >= 800) {
      return 25;
    }
    if (revenueThousand >= 600) {
      return 20;
    }
    if (revenueThousand >= 400) {
      return 15;
    }
    if (revenueThousand >= 200) {
      return 10;
    }
    if (revenueThousand >= 100) {
      return 5;
    }
    return 0;
  }

  private calculateDailyChecklistScore(submittedJournalCount: number) {
    if (submittedJournalCount >= 4) {
      return 7;
    }
    if (submittedJournalCount >= 3) {
      return 5;
    }
    if (submittedJournalCount >= 2) {
      return 3;
    }
    if (submittedJournalCount >= 1) {
      return 1;
    }
    return 0;
  }

  private getLearningAssessmentLabel(averageScore: number) {
    if (averageScore < 8) {
      return 'Chưa đạt';
    }
    if (averageScore <= 11) {
      return 'Đang hình thành';
    }
    if (averageScore <= 13) {
      return 'Tốt';
    }
    return 'Xuất sắc';
  }

  private getBehaviorAssessmentLabel(averageScore: number) {
    if (averageScore < 18) {
      return 'Chưa đạt';
    }
    if (averageScore <= 28) {
      return 'Đạt';
    }
    if (averageScore <= 32) {
      return 'Tốt';
    }
    return 'Xuất sắc';
  }

  private getOverallCompetitionRankLabel(averageScore: number) {
    if (averageScore >= 90) {
      return 'Chiến binh bán hàng VNPT';
    }
    if (averageScore >= 80) {
      return 'Nhân viên xuất sắc';
    }
    if (averageScore >= 70) {
      return 'Nhân viên tốt';
    }
    if (averageScore >= 60) {
      return 'Cần cải thiện';
    }
    return 'Chưa đạt';
  }

  private toImportedMetricsResponse(item?: ManagerDailyScoreImport | null) {
    if (!item) {
      return null;
    }
    return {
      id: item.id,
      scoreDate: item.scoreDate,
      employeeId: item.employeeId,
      employeeCode: item.employeeCode || item.employee?.employeeCode || '',
      employeeName: item.employee?.fullName || '',
      unitId: item.unitId,
      unitName: item.unit?.name || '',
      successfulCareCalls: this.normalizeNumber(item.successfulCareCalls),
      successfulServices: this.normalizeNumber(item.successfulServices),
      highPtmPackages: this.normalizeNumber(item.highPtmPackages),
      personalRevenueThousand: this.normalizeNumber(item.personalRevenueThousand),
      sourceFileName: item.sourceFileName || '',
      importedByName: item.importedBy?.fullName || '',
      updatedAt: item.updatedAt,
    };
  }

  private async getImportedMetrics(employeeId: string, scoreDate: string) {
    return this.importsRepository.findOne({
      where: {
        employeeId,
        scoreDate,
      },
    });
  }

  private async getEmployeeByScope(currentUser: any, employeeId: string) {
    const employee = await this.usersRepository.findOne(employeeId);
    if (!employee || employee.role !== Role.EMPLOYEE) {
      throw new BadRequestException('Không tìm thấy nhân viên hợp lệ');
    }
    if (currentUser.role === Role.MANAGER && employee.unitId !== currentUser.unitId) {
      throw new ForbiddenException('Chỉ được nhập điểm cho nhân viên cùng đơn vị');
    }
    if (currentUser.role === Role.EMPLOYEE && employee.id !== (currentUser.sub || currentUser.id)) {
      throw new ForbiddenException('Chỉ được xem phiếu của chính mình');
    }
    return employee;
  }

  private toCriterionResponse(item: ManagerDailyScoreCriterion) {
    return {
      id: item.id,
      sectionCode: item.sectionCode,
      sectionName: item.sectionName,
      sectionSortOrder: item.sectionSortOrder,
      itemCode: item.itemCode,
      itemSortOrder: item.itemSortOrder,
      sttLabel: item.sttLabel,
      contentName: item.contentName,
      employeeInputType: item.employeeInputType || 'text',
      maxScore: this.normalizeNumber(item.maxScore),
      isActive: item.isActive,
    };
  }

  private groupCriteria(criteria: ManagerDailyScoreCriterion[]) {
    const sectionsMap = new Map<
      string,
      {
        sectionCode: string;
        sectionName: string;
        sectionSortOrder: number;
        maxScore: number;
        items: Array<{
          id: string;
          itemCode: string;
          sttLabel: string;
          contentName: string;
          employeeInputType: 'text' | 'number';
          maxScore: number;
          sectionCode: string;
        }>;
      }
    >();

    criteria.forEach((criterion) => {
      const section = sectionsMap.get(criterion.sectionCode) || {
        sectionCode: criterion.sectionCode,
        sectionName: criterion.sectionName,
        sectionSortOrder: criterion.sectionSortOrder,
        maxScore: 0,
        items: [],
      };
      const itemMaxScore = this.normalizeNumber(criterion.maxScore);
      section.maxScore += itemMaxScore;
      section.items.push({
        id: criterion.id,
        itemCode: criterion.itemCode,
        sttLabel: criterion.sttLabel,
        contentName: criterion.contentName,
        employeeInputType: criterion.employeeInputType || 'text',
        maxScore: itemMaxScore,
        sectionCode: criterion.sectionCode,
      });
      sectionsMap.set(criterion.sectionCode, section);
    });

    const sections = [...sectionsMap.values()]
      .sort((a, b) => a.sectionSortOrder - b.sectionSortOrder)
      .map((section) => ({
        ...section,
        maxScore:
          section.sectionCode === BEHAVIOR_SECTION_CODE
            ? BEHAVIOR_SECTION_MAX_SCORE
            : Number(section.maxScore.toFixed(2)),
        items: section.items.sort((a, b) => a.sttLabel.localeCompare(b.sttLabel, 'vi')),
      }));

    return sections;
  }

  private async getActiveCriteria() {
    let criteria = await this.criteriaRepository.find({
      where: { isActive: true },
      order: {
        sectionSortOrder: 'ASC',
        itemSortOrder: 'ASC',
      },
    });
    if (criteria.length > 0) {
      return criteria;
    }
    const inserts = DEFAULT_CRITERIA.map((item) =>
      this.criteriaRepository.create({
        sectionCode: item[0],
        sectionName: item[1],
        sectionSortOrder: item[2],
        itemCode: item[3],
        itemSortOrder: item[4],
        sttLabel: item[5],
        contentName: item[6],
        employeeInputType: 'text',
        maxScore: String(item[7]),
        isActive: true,
      }),
    );
    await this.criteriaRepository.save(inserts);
    criteria = await this.criteriaRepository.find({
      where: { isActive: true },
      order: {
        sectionSortOrder: 'ASC',
        itemSortOrder: 'ASC',
      },
    });
    return criteria;
  }

  async getCriteria() {
    const criteria = await this.getActiveCriteria();

    const sections = this.groupCriteria(criteria);
    const totalMaxScore = Number(
      sections.reduce((sum, section) => sum + section.maxScore, 0).toFixed(2),
    );

    return {
      criteria: criteria.map((item) => ({
        ...this.toCriterionResponse(item),
      })),
      sections,
      totalMaxScore,
    };
  }

  async getCriteriaForAdmin() {
    const criteria = await this.criteriaRepository.find({
      order: {
        sectionSortOrder: 'ASC',
        itemSortOrder: 'ASC',
      },
    });
    return criteria.map((item) => this.toCriterionResponse(item));
  }

  async createCriterion(dto: CreateManagerDailyScoreCriterionDto) {
    const itemCode = String(dto.itemCode || '').trim().toUpperCase();
    const existed = await this.criteriaRepository.findOne({ itemCode });
    if (existed) {
      throw new BadRequestException('itemCode đã tồn tại');
    }
    const criterion = this.criteriaRepository.create({
      sectionCode: String(dto.sectionCode || '').trim().toUpperCase(),
      sectionName: String(dto.sectionName || '').trim(),
      sectionSortOrder: Number(dto.sectionSortOrder || 0),
      itemCode,
      itemSortOrder: Number(dto.itemSortOrder || 0),
      sttLabel: String(dto.sttLabel || '').trim(),
      contentName: String(dto.contentName || '').trim(),
      employeeInputType: dto.employeeInputType === 'number' ? 'number' : 'text',
      maxScore: String(Number(dto.maxScore || 0)),
      isActive: dto.isActive !== false,
    });
    const saved = await this.criteriaRepository.save(criterion);
    return this.toCriterionResponse(saved);
  }

  async updateCriterion(id: string, dto: UpdateManagerDailyScoreCriterionDto) {
    const criterion = await this.criteriaRepository.findOne(id);
    if (!criterion) {
      throw new NotFoundException('Không tìm thấy tiêu chí');
    }
    if (dto.itemCode !== undefined) {
      const itemCode = String(dto.itemCode || '').trim().toUpperCase();
      if (!itemCode) {
        throw new BadRequestException('itemCode không hợp lệ');
      }
      const duplicate = await this.criteriaRepository.findOne({ itemCode });
      if (duplicate && duplicate.id !== criterion.id) {
        throw new BadRequestException('itemCode đã tồn tại');
      }
      criterion.itemCode = itemCode;
    }
    if (dto.sectionCode !== undefined) {
      criterion.sectionCode = String(dto.sectionCode || '').trim().toUpperCase();
    }
    if (dto.sectionName !== undefined) {
      criterion.sectionName = String(dto.sectionName || '').trim();
    }
    if (dto.sectionSortOrder !== undefined) {
      criterion.sectionSortOrder = Number(dto.sectionSortOrder || 0);
    }
    if (dto.itemSortOrder !== undefined) {
      criterion.itemSortOrder = Number(dto.itemSortOrder || 0);
    }
    if (dto.sttLabel !== undefined) {
      criterion.sttLabel = String(dto.sttLabel || '').trim();
    }
    if (dto.contentName !== undefined) {
      criterion.contentName = String(dto.contentName || '').trim();
    }
    if (dto.employeeInputType !== undefined) {
      criterion.employeeInputType = dto.employeeInputType === 'number' ? 'number' : 'text';
    }
    if (dto.maxScore !== undefined) {
      criterion.maxScore = String(Number(dto.maxScore || 0));
    }
    if (dto.isActive !== undefined) {
      criterion.isActive = !!dto.isActive;
    }
    const saved = await this.criteriaRepository.save(criterion);
    return this.toCriterionResponse(saved);
  }

  async deleteCriterion(id: string) {
    const criterion = await this.criteriaRepository.findOne(id);
    if (!criterion) {
      throw new NotFoundException('Không tìm thấy tiêu chí');
    }
    criterion.isActive = false;
    await this.criteriaRepository.save(criterion);
    return { success: true };
  }

  async getEmployees(currentUser: any, keyword?: string) {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.unit', 'unit')
      .where('user.role = :role', { role: Role.EMPLOYEE });

    if (currentUser.role === Role.MANAGER) {
      qb.andWhere('user.unitId = :unitId', { unitId: currentUser.unitId });
    }

    const normalizedKeyword = String(keyword || '').trim().toLowerCase();
    if (normalizedKeyword) {
      qb.andWhere(
        '(LOWER(user.fullName) LIKE :keyword OR LOWER(user.username) LIKE :keyword)',
        { keyword: `%${normalizedKeyword}%` },
      );
    }

    const users = await qb.orderBy('user.fullName', 'ASC').getMany();
    return users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      employeeCode: user.employeeCode || '',
      unitId: user.unitId,
      unitName: user.unit?.name || '',
    }));
  }

  async downloadImportPerformanceTemplate() {
    const workbook = XLSX.utils.book_new();
    const templateRows = [
      {
        'Ngày chấm điểm': '2026-06-11',
        'Mã nhân viên': 'NV001',
        'Số cuộc gọi CSKH thành công': 80,
        'Số dịch vụ thành công': 3,
        'Số gói cao PTM': 1,
        'Doanh thu cá nhân (VND)': 1250000,
      },
      {
        'Ngày chấm điểm': '2026-06-11',
        'Mã nhân viên': 'NV002',
        'Số cuộc gọi CSKH thành công': 100,
        'Số dịch vụ thành công': 2,
        'Số gói cao PTM': 0,
        'Doanh thu cá nhân (VND)': 980000,
      },
    ];
    const guideRows = [
      {
        'Tên cột': 'Ngày chấm điểm',
        'Bắt buộc': 'Có',
        'Giải thích': 'Ngày dữ liệu theo định dạng YYYY-MM-DD',
      },
      {
        'Tên cột': 'Mã nhân viên',
        'Bắt buộc': 'Có',
        'Giải thích': 'Mã nhân viên để ánh xạ vào trường user.employeeCode trong hệ thống',
      },
      {
        'Tên cột': 'Số cuộc gọi CSKH thành công',
        'Bắt buộc': 'Có',
        'Giải thích': 'Dành cho TT CSKH, nhập số cuộc gọi CSKH thành công trong ngày',
      },
      {
        'Tên cột': 'Số dịch vụ thành công',
        'Bắt buộc': 'Có',
        'Giải thích': 'Nhập số dịch vụ thành công trong ngày',
      },
      {
        'Tên cột': 'Số gói cao PTM',
        'Bắt buộc': 'Có',
        'Giải thích': 'Nhập số gói cao PTM trong ngày',
      },
      {
        'Tên cột': 'Doanh thu cá nhân (VND)',
        'Bắt buộc': 'Có',
        'Giải thích': 'Nhập đúng doanh thu thực tế theo VND, ví dụ 1.250.000 VND thì nhập 1250000; hệ thống sẽ tự quy đổi sang ngàn đồng khi tính điểm',
      },
      {
        'Tên cột': 'Lưu ý',
        'Bắt buộc': '',
        'Giải thích': 'Chỉ cần điền đúng 6 cột trên tại sheet dữ liệu, hệ thống sẽ import cho toàn hệ thống theo mã nhân viên',
      },
    ];

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(templateRows), 'Du lieu import');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(guideRows), 'Huong dan');

    return {
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
      fileName: 'mau-import-so-lieu-cham-diem.xlsx',
    };
  }

  async importPerformanceData(currentUser: any, file: any) {
    if (![Role.PROVINCIAL_VIEWER, Role.ADMIN].includes(currentUser.role)) {
      throw new ForbiddenException('Chỉ tài khoản thống kê toàn tỉnh hoặc admin mới được import');
    }
    if (!file) {
      throw new BadRequestException('Thiếu file Excel');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    const sheetRows = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as any[][];
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      defval: '',
      raw: false,
    }) as any[];
    const originalHeaders = (Array.isArray(sheetRows?.[0]) ? sheetRows[0] : []).map((header) =>
      String(header ?? '').trim(),
    );

    if (!rows.length) {
      throw new BadRequestException('File Excel không có dữ liệu');
    }

    const imported = [];
    const skipped = [];

    const inputFileBaseName = String(file.originalname || 'du-lieu-import')
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    const processedKeys = new Set<string>();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rawScoreDate = String(
        row.scoreDate ??
          row['Ngày chấm điểm'] ??
          row.ngay ??
          row.date ??
          row.score_date ??
          '',
      ).trim();
      const rawEmployeeCode = String(
        row.employeeCode ??
          row['Mã nhân viên'] ??
          row.maNhanVien ??
          row.maNV ??
          row.employee_code ??
          '',
      ).trim();
      const rawSuccessfulCareCalls =
        row.successfulCareCalls ??
        row['Số cuộc gọi CSKH thành công'] ??
        row.soCuocGoiCSKHThanhCong ??
        row.soCuocGoiCSKH ??
        '';
      const rawSuccessfulServices =
        row.successfulServices ??
        row['Số dịch vụ thành công'] ??
        row.soDichVuThanhCong ??
        row.soDichVu ??
        '';
      const rawHighPtmPackages =
        row.highPtmPackages ?? row['Số gói cao PTM'] ?? row.soGoiCaoPTM ?? row.soGoiCao ?? '';
      const rawPersonalRevenueVnd =
        row['Doanh thu cá nhân (VND)'] ?? row.doanhThuCaNhanVND ?? row.doanhThuVND ?? '';
      const rawPersonalRevenueThousand =
        row.personalRevenueThousand ??
        row['Doanh thu cá nhân (Ngàn đồng)'] ??
        row.doanhThuCaNhanNganDong ??
        row.doanhThuNganDong ??
        row.doanhThuCaNhan ??
        '';
      const scoreDate = this.toDateKey(rawScoreDate);
      const employeeCode = rawEmployeeCode;
      const successfulCareCalls = this.parseImportedNumber(rawSuccessfulCareCalls);
      const successfulServices = this.parseImportedNumber(rawSuccessfulServices);
      const highPtmPackages = this.parseImportedNumber(rawHighPtmPackages);
      const personalRevenueVnd = this.parseImportedNumber(rawPersonalRevenueVnd);
      const personalRevenueThousandRaw = this.parseImportedNumber(rawPersonalRevenueThousand);
      const personalRevenueThousand = !Number.isNaN(personalRevenueVnd)
        ? Number((personalRevenueVnd / 1000).toFixed(2))
        : personalRevenueThousandRaw;

      const skippedRowBase = {
        originalRow: { ...row },
      };

      if (!scoreDate || !employeeCode) {
        skipped.push({
          ...skippedRowBase,
          reason: 'Thiếu ngày hoặc mã nhân viên',
        });
        continue;
      }
      if (
        [successfulCareCalls, successfulServices, highPtmPackages, personalRevenueThousand].some(
          (value) => Number.isNaN(value),
        )
      ) {
        skipped.push({
          ...skippedRowBase,
          reason: 'Có chỉ tiêu không phải số hợp lệ',
        });
        continue;
      }

      const duplicateKey = this.buildEmployeeDateKey(employeeCode, scoreDate);
      if (processedKeys.has(duplicateKey)) {
        skipped.push({
          ...skippedRowBase,
          reason: 'Trùng dữ liệu trong file import',
        });
        continue;
      }
      processedKeys.add(duplicateKey);

      const employee = await this.usersRepository.findOne({
        where: {
          employeeCode,
          role: Role.EMPLOYEE,
        },
      });

      if (!employee) {
        skipped.push({
          ...skippedRowBase,
          reason: 'Không tìm thấy nhân viên theo mã',
        });
        continue;
      }

      let target = await this.importsRepository.findOne({
        where: {
          employeeId: employee.id,
          scoreDate,
        },
      });

      if (!target) {
        target = this.importsRepository.create({
          employeeId: employee.id,
          unitId: employee.unitId,
          scoreDate,
        });
      }

      target.employeeCode = employee.employeeCode || employeeCode;
      target.successfulCareCalls = String(successfulCareCalls);
      target.successfulServices = String(successfulServices);
      target.highPtmPackages = String(highPtmPackages);
      target.personalRevenueThousand = String(personalRevenueThousand);
      target.sourceFileName = String(file.originalname || '');
      target.importedById = currentUser.sub || currentUser.id;
      await this.importsRepository.save(target);

      imported.push({
        employeeId: employee.id,
        employeeCode: target.employeeCode,
        fullName: employee.fullName,
        scoreDate,
      });
    }

    return {
      totalRows: rows.length,
      importedCount: imported.length,
      skippedCount: skipped.length,
      skippedFileName: `du-lieu-khong-import-duoc-${inputFileBaseName || 'excel-import'}.xlsx`,
      skippedHeaders: originalHeaders,
      imported,
      skipped,
    };
  }

  async getEntry(currentUser: any, employeeId: string, scoreDate: string) {
    if (!employeeId || !scoreDate) {
      throw new BadRequestException('Thiếu employeeId hoặc scoreDate');
    }
    const employee = await this.getEmployeeByScope(currentUser, employeeId);
    const normalizedDate = this.toDateKey(scoreDate);
    if (!normalizedDate) {
      throw new BadRequestException('scoreDate không hợp lệ');
    }
    const importedMetrics = await this.getImportedMetrics(employeeId, normalizedDate);

    const sheet = await this.sheetsRepository.findOne({
      where: {
        employeeId,
        scoreDate: normalizedDate,
      },
    });

    if (!sheet) {
      return {
        employee: {
          id: employee.id,
          fullName: employee.fullName,
          username: employee.username,
          employeeCode: employee.employeeCode || '',
          unitId: employee.unitId,
          unitName: employee.unit?.name || '',
        },
        sheet: null,
        importedMetrics: this.toImportedMetricsResponse(importedMetrics),
      };
    }

    const items = await this.itemsRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.criterion', 'criterion')
      .where('item.sheetId = :sheetId', { sheetId: sheet.id })
      .orderBy('criterion.sectionSortOrder', 'ASC')
      .addOrderBy('criterion.itemSortOrder', 'ASC')
      .getMany();

    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        username: employee.username,
        employeeCode: employee.employeeCode || '',
        unitId: employee.unitId,
        unitName: employee.unit?.name || '',
      },
      sheet: {
        id: sheet.id,
        scoreDate: sheet.scoreDate,
        managerId: sheet.managerId,
        status: sheet.status,
        totalScore: this.normalizeNumber(sheet.totalScore),
        items: items.map((item) => ({
          id: item.id,
          criteriaId: item.criteriaId,
          requirementNote: item.requirementNote,
          employeeNote: item.employeeNote,
          selfScore: this.normalizeNumber(item.selfScore),
          score: this.normalizeNumber(item.score),
        })),
      },
      importedMetrics: this.toImportedMetricsResponse(importedMetrics),
    };
  }

  async submitEntry(currentUser: any, dto: SubmitManagerDailyScoreDto) {
    const employee = await this.getEmployeeByScope(currentUser, dto.employeeId);
    const normalizedDate = this.toDateKey(dto.scoreDate);
    if (!normalizedDate) {
      throw new BadRequestException('scoreDate không hợp lệ');
    }

    validateActionTimeForDate(normalizedDate, 'Chấm điểm nhân viên', false, currentUser.role);

    const activeCriteria = await this.getActiveCriteria();
    if (!activeCriteria.length) {
      throw new BadRequestException('Chưa có cấu hình tiêu chí chấm điểm');
    }

    const criteriaMap = new Map(activeCriteria.map((item) => [item.id, item]));
    const payloadMap = new Map(dto.items.map((item) => [item.criteriaId, item]));

    if (payloadMap.size !== activeCriteria.length) {
      throw new BadRequestException('Vui lòng nhập đủ điểm cho toàn bộ tiêu chí');
    }

    for (const criterion of activeCriteria) {
      const payloadItem = payloadMap.get(criterion.id);
      if (!payloadItem) {
        throw new BadRequestException(`Thiếu điểm cho tiêu chí ${criterion.contentName}`);
      }
      const maxScore = this.normalizeNumber(criterion.maxScore);

      if (currentUser.role !== Role.EMPLOYEE) {
        if (!String(payloadItem.requirementNote || '').trim()) {
          throw new BadRequestException(
            `Ghi chú yêu cầu là bắt buộc tại tiêu chí ${criterion.contentName}`,
          );
        }
        if (payloadItem.score > maxScore) {
          throw new BadRequestException(
            `Điểm tiêu chí ${criterion.contentName} không được vượt quá ${maxScore}`,
          );
        }
      } else if (Number(payloadItem.selfScore || 0) > maxScore) {
        throw new BadRequestException(
          `Điểm tự đánh giá tiêu chí ${criterion.contentName} không được vượt quá ${maxScore}`,
        );
      }
    }

    const criterionByCode = new Map(activeCriteria.map((item) => [item.itemCode, item]));
    const customersContacted = criterionByCode.get(BEHAVIOR_CUSTOMERS_CONTACTED_CODE);
    const successfulCareCalls = criterionByCode.get(BEHAVIOR_SUCCESSFUL_CARE_CALLS_CODE);
    if (customersContacted && successfulCareCalls) {
      const customersContactedValue =
        currentUser.role === Role.EMPLOYEE
          ? Number(payloadMap.get(customersContacted.id)?.selfScore || 0)
          : Number(payloadMap.get(customersContacted.id)?.score || 0);
      const successfulCareCallsValue =
        currentUser.role === Role.EMPLOYEE
          ? Number(payloadMap.get(successfulCareCalls.id)?.selfScore || 0)
          : Number(payloadMap.get(successfulCareCalls.id)?.score || 0);
      if (customersContactedValue > 0 && successfulCareCallsValue > 0) {
        throw new BadRequestException(
          'Tiêu chí Số khách hàng tiếp cận và Số cuộc gọi CSKH thành công không được cùng lớn hơn 0',
        );
      }
    }

    const behaviorCriteriaIds = activeCriteria
      .filter((item) => item.sectionCode === BEHAVIOR_SECTION_CODE)
      .map((item) => item.id);
    const behaviorSectionScore = behaviorCriteriaIds.reduce(
      (sum, criteriaId) =>
        sum +
        Number(
          currentUser.role === Role.EMPLOYEE
            ? payloadMap.get(criteriaId)?.selfScore || 0
            : payloadMap.get(criteriaId)?.score || 0,
        ),
      0,
    );
    if (behaviorSectionScore > BEHAVIOR_SECTION_MAX_SCORE) {
      throw new BadRequestException(
        `Tổng điểm phần II. Thực hành hành vi không được vượt quá ${BEHAVIOR_SECTION_MAX_SCORE}`,
      );
    }

    let sheet = await this.sheetsRepository.findOne({
      where: {
        employeeId: employee.id,
        scoreDate: normalizedDate,
      },
    });

    let existingItems = [];
    if (sheet) {
      existingItems = await this.itemsRepository.find({ where: { sheetId: sheet.id } });
    }

    if (!sheet) {
      sheet = this.sheetsRepository.create({
        employeeId: employee.id,
        managerId: currentUser.role === Role.EMPLOYEE ? null : (currentUser.sub || currentUser.id),
        unitId: employee.unitId,
        scoreDate: normalizedDate,
        status: currentUser.role === Role.EMPLOYEE ? 'PENDING' : 'APPROVED',
      });
    } else {
      if (currentUser.role !== Role.EMPLOYEE) {
        sheet.managerId = currentUser.sub || currentUser.id;
        sheet.status = 'APPROVED';
      } else {
        sheet.status = 'PENDING';
      }
    }

    const itemsPayload = [...payloadMap.values()];
    const existingItemsMap = new Map(existingItems.map((item) => [item.criteriaId, item]));

    // Nếu là nhân viên, giữ nguyên điểm và ghi chú yêu cầu của quản lý nếu đã có, chỉ cập nhật điểm tự đánh giá và ghi chú nhân viên
    // Nếu là quản lý, giữ nguyên điểm tự đánh giá và ghi chú nhân viên nếu đã có, chỉ cập nhật điểm thẩm định và ghi chú yêu cầu
    const finalItemsToSave = itemsPayload.map((item) => {
      const existing = existingItemsMap.get(item.criteriaId);
      let requirementNote = existing?.requirementNote || '';
      let score = Number(existing?.score || 0);
      let employeeNote = existing?.employeeNote || '';
      let selfScore = Number(existing?.selfScore || 0);

      if (currentUser.role === Role.EMPLOYEE) {
        const criterion = criteriaMap.get(item.criteriaId);
        const employeeInputType = criterion?.employeeInputType || 'text';
        const rawEmployeeInput = String(item.employeeNote || '').trim();
        if (employeeInputType === 'number' && rawEmployeeInput) {
          const normalizedNumber = Number(rawEmployeeInput);
          if (Number.isNaN(normalizedNumber)) {
            throw new BadRequestException(
              `Nội dung tiêu chí ${criterion?.contentName || item.criteriaId} phải là số`,
            );
          }
          employeeNote = String(normalizedNumber);
        } else {
          employeeNote = rawEmployeeInput;
        }
        selfScore = Number(item.selfScore || 0);
      } else {
        requirementNote = String(item.requirementNote || '').trim();
        score = Number(item.score || 0);
      }

      return {
        criteriaId: item.criteriaId,
        requirementNote,
        employeeNote,
        selfScore,
        score,
      };
    });

    const totalScore = Number(
      finalItemsToSave.reduce((sum, item) => sum + item.score, 0).toFixed(2),
    );
    sheet.totalScore = String(totalScore);
    const savedSheet = await this.sheetsRepository.save(sheet);

    await this.itemsRepository.delete({ sheetId: savedSheet.id });

    const itemEntities = finalItemsToSave.map((item) =>
      this.itemsRepository.create({
        sheetId: savedSheet.id,
        criteriaId: item.criteriaId,
        requirementNote: item.requirementNote,
        employeeNote: item.employeeNote,
        selfScore: String(item.selfScore),
        score: String(item.score),
      }),
    );

    await this.itemsRepository.save(itemEntities);

    const detailedItems = itemEntities
      .map((item) => {
        const criterion = criteriaMap.get(item.criteriaId);
        return {
          criteriaId: item.criteriaId,
          itemCode: criterion?.itemCode || '',
          contentName: criterion?.contentName || '',
          selfScore: this.normalizeNumber(item.selfScore),
          score: this.normalizeNumber(item.score),
          maxScore: criterion ? this.normalizeNumber(criterion.maxScore) : 0,
          requirementNote: item.requirementNote,
        };
      })
      .sort((a, b) => a.itemCode.localeCompare(b.itemCode, 'vi'));

    return {
      id: savedSheet.id,
      scoreDate: savedSheet.scoreDate,
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        username: employee.username,
        unitId: employee.unitId,
      },
      totalScore,
      totalMaxScore: Number(
        this.groupCriteria(activeCriteria)
          .reduce((sum, section) => sum + section.maxScore, 0)
          .toFixed(2),
      ),
      items: detailedItems,
    };
  }

  async getStatistics(
    currentUser: any,
    filters: { fromDate?: string; toDate?: string; employeeId?: string; unitId?: string },
  ) {
    const criteria = await this.getActiveCriteria();
    const fromDate = this.toDateKey(filters.fromDate || '');
    const toDate = this.toDateKey(filters.toDate || '');
    let scopedEmployeeId = '';

    if (filters.employeeId) {
      const employee = await this.getEmployeeByScope(currentUser, filters.employeeId);
      scopedEmployeeId = employee.id;
    }

    const sheetsQuery = this.sheetsRepository
      .createQueryBuilder('sheet')
      .leftJoinAndSelect('sheet.items', 'item')
      .leftJoinAndSelect('item.criterion', 'criterion')
      .leftJoinAndSelect('sheet.employee', 'employee')
      .leftJoinAndSelect('employee.unit', 'employeeUnit')
      .leftJoinAndSelect('sheet.manager', 'manager')
      .where('sheet.status = :status', { status: 'APPROVED' })
      .andWhere('COALESCE("employeeUnit"."excludeFromStatistics", false) = false');

    if (fromDate) {
      sheetsQuery.andWhere('sheet.scoreDate >= :fromDate', { fromDate });
    }
    if (toDate) {
      sheetsQuery.andWhere('sheet.scoreDate <= :toDate', { toDate });
    }

    // PostgreSQL: Sunday=0, Saturday=6
    sheetsQuery.andWhere('EXTRACT(DOW FROM sheet.scoreDate) NOT IN (0, 6)');

    if (scopedEmployeeId) {
      sheetsQuery.andWhere('sheet.employeeId = :employeeId', { employeeId: scopedEmployeeId });
    } else if (currentUser.role === Role.MANAGER) {
      sheetsQuery.andWhere('sheet.unitId = :unitId', { unitId: currentUser.unitId });
    } else if (filters.unitId) {
      sheetsQuery.andWhere('sheet.unitId = :unitId', { unitId: filters.unitId });
    }

    sheetsQuery
      .orderBy('sheet.scoreDate', 'DESC')
      .addOrderBy('employee.fullName', 'ASC');

    const sheets = await sheetsQuery.getMany();

    const sections = this.groupCriteria(criteria);
    const sectionItemCodes = new Map(
      sections.map((section) => [section.sectionCode, section.items.map((item) => item.itemCode)]),
    );

    const rows = sheets.map((sheet) => {
      const scoresByItemCode: Record<string, number> = {};
      const selfScoresByItemCode: Record<string, number> = {};
      const notesByItemCode: Record<string, string> = {};

      (sheet.items || []).forEach((item) => {
        const itemCode = item.criterion?.itemCode;
        if (!itemCode) {
          return;
        }
        scoresByItemCode[itemCode] = this.normalizeNumber(item.score);
        selfScoresByItemCode[itemCode] = this.normalizeNumber(item.selfScore);
        notesByItemCode[itemCode] = item.requirementNote || '';
      });

      const sectionTotals: Record<string, number> = {};
      sections.forEach((section) => {
        const codes = sectionItemCodes.get(section.sectionCode) || [];
        const sum = codes.reduce((acc, code) => acc + Number(scoresByItemCode[code] || 0), 0);
        sectionTotals[section.sectionCode] = Number(sum.toFixed(2));
      });

      return {
        id: sheet.id,
        scoreDate: sheet.scoreDate,
        unitName: sheet.employee?.unit?.name || '',
        employee: {
          id: sheet.employee?.id || '',
          fullName: sheet.employee?.fullName || '',
          username: sheet.employee?.username || '',
          unitId: sheet.employee?.unitId || '',
        },
        manager: {
          id: sheet.manager?.id || '',
          fullName: sheet.manager?.fullName || '',
        },
        scoresByItemCode,
        selfScoresByItemCode,
        notesByItemCode,
        sectionTotals,
        totalScore: this.normalizeNumber(sheet.totalScore),
      };
    });

    const totalMaxScore = Number(
      sections.reduce((sum, section) => sum + section.maxScore, 0).toFixed(2),
    );

    const unitMap = new Map<
      string,
      {
        unitId: string;
        unitName: string;
        totalScore: number;
        employeeCount: number;
      }
    >();

    const unitCountsQuery = this.unitsRepository
      .createQueryBuilder('unit')
      .leftJoin('unit.users', 'user', 'user.role = :employeeRole', { employeeRole: Role.EMPLOYEE })
      .where('COALESCE(unit."excludeFromStatistics", false) = false');

    if (currentUser.role === Role.MANAGER) {
      unitCountsQuery.andWhere('unit.id = :unitId', { unitId: currentUser.unitId });
    } else if (filters.unitId) {
      unitCountsQuery.andWhere('unit.id = :unitId', { unitId: filters.unitId });
    }

    const allUnits = await unitCountsQuery
      .select('unit.id', 'unitId')
      .addSelect('unit.name', 'unitName')
      .addSelect('COUNT(user.id)', 'employeeCount')
      .groupBy('unit.id')
      .addGroupBy('unit.name')
      .orderBy('unit.name', 'ASC')
      .getRawMany<{ unitId: string; unitName: string; employeeCount: string }>();

    allUnits.forEach((unit) => {
      unitMap.set(unit.unitId, {
        unitId: unit.unitId,
        unitName: unit.unitName,
        totalScore: 0,
        employeeCount: Number(unit.employeeCount || 0),
      });
    });

    rows.forEach((row) => {
      const unitId = row.employee?.unitId || '';
      const unit = unitMap.get(unitId);
      if (unit) {
        unit.totalScore += Number(row.totalScore || 0);
      }
    });

    const unitRows = [...unitMap.values()].map((item) => {
      const employeeCount = item.employeeCount;
      const averageScore = employeeCount === 0 ? 0 : Number((item.totalScore / employeeCount).toFixed(2));
      return {
        unitId: item.unitId,
        unitName: item.unitName,
        employeeCount,
        totalScore: Number(item.totalScore.toFixed(2)),
        averageScore,
      };
    });

    return {
      filters: {
        fromDate: fromDate || null,
        toDate: toDate || null,
        employeeId: filters.employeeId || null,
        unitId: filters.unitId || null,
      },
      template: {
        sections,
        totalMaxScore,
      },
      rows,
      unitRows,
      totals: {
        totalRows: rows.length,
        averageScore:
          rows.length === 0
            ? 0
            : Number(
                (
                  rows.reduce((sum, row) => sum + Number(row.totalScore || 0), 0) / rows.length
                ).toFixed(2),
              ),
      },
    };
  }

  async getTncCompetition(
    currentUser: any,
    filters: { fromDate?: string; toDate?: string; unitId?: string; useApprovedScore?: string | boolean },
  ) {
    const fromDate = this.toDateKey(filters.fromDate || '');
    const toDate = this.toDateKey(filters.toDate || '');
    const useApprovedScore =
      filters.useApprovedScore === true ||
      String(filters.useApprovedScore || '').toLowerCase() === 'true';
    if (!fromDate || !toDate) {
      throw new BadRequestException('Vui lòng chọn từ ngày và đến ngày');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('Từ ngày không được lớn hơn đến ngày');
    }

    const holidayDates = await this.getConfiguredHolidayDates();
    const validDateKeys = this.getValidDateKeysInRange(fromDate, toDate, holidayDates);
    const validDateKeySet = new Set(validDateKeys);
    const validDayCount = validDateKeys.length;

    const includedUnits = (await this.unitsRepository.find({ order: { name: 'ASC' } })).filter((unit) => {
      if (unit.excludeFromStatistics) {
        return false;
      }
      if (currentUser.role === Role.MANAGER) {
        return unit.id === currentUser.unitId;
      }
      if (filters.unitId) {
        return unit.id === filters.unitId;
      }
      return true;
    });
    const includedUnitIds = includedUnits.map((unit) => unit.id);

    if (includedUnitIds.length === 0) {
      return {
        filters: {
          fromDate,
          toDate,
          unitId: filters.unitId || null,
          useApprovedScore,
        },
        validDayCount,
        holidayDates: validDateKeys.length > 0 ? validDateKeys.filter(() => false) : [],
        excludedHolidayDates: Array.from(holidayDates).filter((date) => date >= fromDate && date <= toDate),
        learningRows: [],
        behaviorRows: [],
        performanceRows: [],
        overallRows: [],
        collectiveRows: [],
      };
    }

    const employees = (await this.usersRepository.find({
      order: { fullName: 'ASC' },
    }))
      .filter((user) => user.role === Role.EMPLOYEE && includedUnitIds.includes(user.unitId))
      .sort((a, b) => {
        const unitCompare = String(a.unit?.name || '').localeCompare(String(b.unit?.name || ''), 'vi');
        if (unitCompare !== 0) {
          return unitCompare;
        }
        return String(a.fullName || '').localeCompare(String(b.fullName || ''), 'vi');
      });
    const employeeIds = employees.map((employee) => employee.id);

    if (employeeIds.length === 0) {
      return {
        filters: {
          fromDate,
          toDate,
          unitId: filters.unitId || null,
          useApprovedScore,
        },
        validDayCount,
        excludedHolidayDates: Array.from(holidayDates).filter((date) => date >= fromDate && date <= toDate),
        learningRows: [],
        behaviorRows: [],
        performanceRows: [],
        overallRows: [],
        collectiveRows: [],
      };
    }

    const sheets = (await this.sheetsRepository.find({
      relations: ['items'],
      order: { scoreDate: 'DESC' },
    })).filter(
      (sheet) =>
        includedUnitIds.includes(sheet.unitId) &&
        validDateKeySet.has(this.toDateKey(sheet.scoreDate || '')),
    );

    const importedMetrics = (await this.importsRepository.find({
      where: {
        employeeId: In(employeeIds),
        scoreDate: Between(fromDate, toDate),
      },
    })).filter((item) => validDateKeySet.has(this.toDateKey(item.scoreDate || '')));

    const importedMetricsMap = new Map(
      importedMetrics.map((item) => [
        this.buildEmployeeDateKey(item.employeeId, this.toDateKey(item.scoreDate || '')),
        item,
      ]),
    );

    const behaviorChecklistLogs = (await this.behaviorChecklistLogsRepository.find({
      where: {
        userId: In(employeeIds),
        logDate: Between(fromDate, toDate),
      },
    })).filter((item) => validDateKeySet.has(this.toDateKey(item.logDate || '')));
    const mindsetLogs = (await this.mindsetLogsRepository.find({
      where: {
        userId: In(employeeIds),
        logDate: Between(fromDate, toDate),
      },
    })).filter((item) => validDateKeySet.has(this.toDateKey(item.logDate || '')));
    const salesActivityLogs = (await this.salesActivityReportsRepository.find({
      where: {
        userId: In(employeeIds),
        logDate: Between(fromDate, toDate),
      },
    })).filter((item) => validDateKeySet.has(this.toDateKey(item.logDate || '')));
    const endOfDayLogs = (await this.endOfDayLogsRepository.find({
      where: {
        userId: In(employeeIds),
        logDate: Between(fromDate, toDate),
      },
    })).filter((item) => validDateKeySet.has(this.toDateKey(item.logDate || '')));

    const form2SubmittedKeys = new Set(
      behaviorChecklistLogs.map((item) =>
        this.buildEmployeeDateKey(item.userId, this.toDateKey(item.logDate || '')),
      ),
    );
    const form3SubmittedKeys = new Set(
      mindsetLogs.map((item) => this.buildEmployeeDateKey(item.userId, this.toDateKey(item.logDate || ''))),
    );
    const form4SubmittedKeys = new Set(
      salesActivityLogs.map((item) =>
        this.buildEmployeeDateKey(item.userId, this.toDateKey(item.logDate || '')),
      ),
    );
    const form5SubmittedKeys = new Set(
      endOfDayLogs.map((item) => this.buildEmployeeDateKey(item.userId, this.toDateKey(item.logDate || ''))),
    );

    const managerCoachingLogs = (await this.managerCoachingLogsRepository.find()).filter((item) => {
      const coachingDateKey = this.toDateKey(new Date(item.coachingTime).toISOString());
      return employeeIds.includes(item.coachedUserId) && validDateKeySet.has(coachingDateKey);
    });
    const directorEvaluatedKeys = new Set(
      managerCoachingLogs.map((item) =>
        this.buildEmployeeDateKey(item.coachedUserId, this.toDateKey(new Date(item.coachingTime).toISOString())),
      ),
    );

    const employeeStatsMap = new Map<
      string,
      {
        employeeId: string;
        employeeCode: string;
        fullName: string;
        username: string;
        unitId: string;
        unitName: string;
        learningTotal: number;
        behaviorTotal: number;
        performanceTotal: number;
        totalScore: number;
      }
    >();
    const unitStatsMap = new Map<
      string,
      {
        unitId: string;
        unitName: string;
        employeeCount: number;
        totalScore: number;
      }
    >();

    employees.forEach((employee) => {
      employeeStatsMap.set(employee.id, {
        employeeId: employee.id,
        employeeCode: employee.employeeCode || '',
        fullName: employee.fullName || '',
        username: employee.username || '',
        unitId: employee.unitId || '',
        unitName: employee.unit?.name || '',
        learningTotal: 0,
        behaviorTotal: 0,
        performanceTotal: 0,
        totalScore: 0,
      });
    });

    includedUnits.forEach((unit) => {
      const employeeCount = employees.filter((employee) => employee.unitId === unit.id).length;
      unitStatsMap.set(unit.id, {
        unitId: unit.id,
        unitName: unit.name || '',
        employeeCount,
        totalScore: 0,
      });
    });

    const sheetMap = new Map(
      sheets.map((sheet) => [
        this.buildEmployeeDateKey(sheet.employeeId, this.toDateKey(sheet.scoreDate || '')),
        sheet,
      ]),
    );

    employees.forEach((employee) => {
      const employeeStats = employeeStatsMap.get(employee.id);
      if (!employeeStats) {
        return;
      }

      validDateKeys.forEach((scoreDateKey) => {
        const employeeDateKey = this.buildEmployeeDateKey(employee.id, scoreDateKey);
        const sheet = sheetMap.get(employeeDateKey);
        const importedMetric = importedMetricsMap.get(employeeDateKey);
        const itemByCode = new Map(
          (sheet?.items || [])
            .filter((item) => !!item.criterion?.itemCode)
            .map((item) => [String(item.criterion?.itemCode || ''), item]),
        );

        const isApprovedSheet = sheet?.status === 'APPROVED';
        const getClampedItemScore = (itemCode: string, rawValue: string | number) => {
          const item = itemByCode.get(itemCode);
          const value = this.normalizeNumber(rawValue || 0);
          const maxScore = this.normalizeNumber(item?.criterion?.maxScore || 0);
          return maxScore > 0 ? Number(Math.min(value, maxScore).toFixed(2)) : value;
        };
        const getSelfScore = (itemCode: string) =>
          getClampedItemScore(itemCode, itemByCode.get(itemCode)?.selfScore || 0);
        const getApprovedScore = (itemCode: string) =>
          isApprovedSheet ? getClampedItemScore(itemCode, itemByCode.get(itemCode)?.score || 0) : 0;
        const getSelectedScore = (itemCode: string) =>
          useApprovedScore ? getApprovedScore(itemCode) : getSelfScore(itemCode);
        const getEmployeeInputNumber = (itemCode: string) =>
          this.safeNumericInput(itemByCode.get(itemCode)?.employeeNote || 0);

        const learningItemCodes = Array.from(
          new Set(
            (sheet?.items || [])
              .filter((item) => item.criterion?.sectionCode === 'LEARNING')
              .map((item) => String(item.criterion?.itemCode || ''))
              .filter(Boolean),
          ),
        );
        const learningSum = Number(
          learningItemCodes
            .reduce((sum, itemCode) => sum + getSelectedScore(itemCode), 0)
            .toFixed(2),
        );

        const successfulCareCallsRaw = this.normalizeImportedMetric(
          importedMetric?.successfulCareCalls,
        );
        const successfulServicesRaw = this.normalizeImportedMetric(
          importedMetric?.successfulServices,
        );
        const highPtmPackagesRaw = this.normalizeImportedMetric(
          importedMetric?.highPtmPackages,
        );
        const personalRevenueThousandRaw = this.normalizeImportedMetric(
          importedMetric?.personalRevenueThousand,
        );
        const customersContactedRaw = getEmployeeInputNumber(BEHAVIOR_CUSTOMERS_CONTACTED_CODE);
        const isCustomerCareEmployee = this.isCustomerCareUnit(employee.unit);
        const submittedJournalCount = [
          form2SubmittedKeys,
          form3SubmittedKeys,
          form4SubmittedKeys,
          form5SubmittedKeys,
        ].reduce((count, submittedKeys) => count + (submittedKeys.has(employeeDateKey) ? 1 : 0), 0);

        const behaviorSum = Number(
          (
            getSelectedScore(BEHAVIOR_SALES_PLAN_CODE) +
            getSelectedScore(BEHAVIOR_PREPARE_CONSULT_CODE) +
            getSelectedScore(BEHAVIOR_CUSTOMERS_CONTACTED_CODE) +
            getSelectedScore(BEHAVIOR_OLD_CUSTOMERS_CONSULTED_CODE) +
            (isCustomerCareEmployee
              ? this.calculateSuccessfulCareCallsScore(successfulCareCallsRaw)
              : 0) +
            this.calculateDailyChecklistScore(submittedJournalCount) +
            (directorEvaluatedKeys.has(employeeDateKey) ? 9 : 0)
          ).toFixed(2),
        );

        const closeRateDenominator = isCustomerCareEmployee
          ? successfulCareCallsRaw
          : customersContactedRaw;
        const closeRate =
          closeRateDenominator > 0 ? successfulServicesRaw / closeRateDenominator : 0;

        const performanceSum = Number(
          (
            this.calculateSuccessfulServicesScore(successfulServicesRaw) +
            this.calculateHighPtmPackagesScore(highPtmPackagesRaw) +
            this.calculateCloseRateScore(closeRate) +
            this.calculateRevenueScore(personalRevenueThousandRaw) +
            getSelectedScore(PERFORMANCE_RETURNING_REFERRED_CODE)
          ).toFixed(2),
        );
        const dailyTotalScore = Number((learningSum + behaviorSum + performanceSum).toFixed(2));

        employeeStats.learningTotal += learningSum;
        employeeStats.behaviorTotal += behaviorSum;
        employeeStats.performanceTotal += performanceSum;
        employeeStats.totalScore += dailyTotalScore;

        const unitStats = unitStatsMap.get(employeeStats.unitId);
        if (unitStats) {
          unitStats.totalScore += dailyTotalScore;
        }
      });
    });

    const toCompetitionRow = (
      item: {
        employeeId: string;
        employeeCode: string;
        fullName: string;
        username: string;
        unitId: string;
        unitName: string;
      },
      totalScore: number,
    ) => ({
      employeeId: item.employeeId,
      employeeCode: item.employeeCode,
      fullName: item.fullName,
      username: item.username,
      unitId: item.unitId,
      unitName: item.unitName,
      totalScore: Number(totalScore.toFixed(2)),
      averageScore:
        validDayCount > 0 ? Number((totalScore / validDayCount).toFixed(2)) : 0,
    });

    const employeeStats = [...employeeStatsMap.values()];
    const learningRows = employeeStats
      .map((item) => {
        const row = toCompetitionRow(item, item.learningTotal);
        return {
          ...row,
          assessmentLabel: this.getLearningAssessmentLabel(Number(row.averageScore || 0)),
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore || a.fullName.localeCompare(b.fullName, 'vi'));
    const behaviorRows = employeeStats
      .map((item) => {
        const row = toCompetitionRow(item, item.behaviorTotal);
        return {
          ...row,
          assessmentLabel: this.getBehaviorAssessmentLabel(Number(row.averageScore || 0)),
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore || a.fullName.localeCompare(b.fullName, 'vi'));
    const performanceRows = employeeStats
      .map((item) => toCompetitionRow(item, item.performanceTotal))
      .sort((a, b) => b.averageScore - a.averageScore || a.fullName.localeCompare(b.fullName, 'vi'));
    const overallRows = employeeStats
      .map((item) => {
        const row = toCompetitionRow(item, item.totalScore);
        return {
          ...row,
          competitionRankLabel: this.getOverallCompetitionRankLabel(Number(row.averageScore || 0)),
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore || a.fullName.localeCompare(b.fullName, 'vi'));

    const collectiveRows = [...unitStatsMap.values()]
      .map((item) => ({
        unitId: item.unitId,
        unitName: item.unitName,
        employeeCount: item.employeeCount,
        totalScore: Number(item.totalScore.toFixed(2)),
        averageScore:
          item.employeeCount > 0 && validDayCount > 0
            ? Number((item.totalScore / item.employeeCount / validDayCount).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.averageScore - a.averageScore || a.unitName.localeCompare(b.unitName, 'vi'));

    return {
      filters: {
        fromDate,
        toDate,
        unitId: filters.unitId || null,
        useApprovedScore,
      },
      validDayCount,
      excludedHolidayDates: Array.from(holidayDates).filter((date) => date >= fromDate && date <= toDate),
      learningRows,
      behaviorRows,
      performanceRows,
      overallRows,
      collectiveRows,
    };
  }

  async exportTncCompetitionFile(
    currentUser: any,
    filters: { fromDate?: string; toDate?: string; unitId?: string; useApprovedScore?: string | boolean },
  ) {
    const data = await this.getTncCompetition(currentUser, filters);
    const workbook = XLSX.utils.book_new();

    const metaRows = [
      ['Từ ngày', data.filters.fromDate || ''],
      ['Đến ngày', data.filters.toDate || ''],
      ['Nguồn điểm tự chấm', data.filters.useApprovedScore ? 'Diem quan ly duyet' : 'Diem nhan vien tu cham'],
      ['Số ngày hợp lệ', Number(data.validDayCount || 0)],
      ['Ngày nghỉ bị loại', (data.excludedHolidayDates || []).join(', ') || ''],
      [],
    ];

    const createEmployeeSheet = (
      sheetName: string,
      rows: any[],
      extraColumnHeader?: string,
      extraColumnValueGetter?: (row: any) => string,
    ) => {
      const aoa = [
        ...metaRows,
        [
          'Hạng',
          'Đơn vị',
          'Mã nhân viên',
          'Họ và tên',
          'Tài khoản',
          'Tổng điểm',
          'BQ điểm/ngày',
          ...(extraColumnHeader ? [extraColumnHeader] : []),
        ],
        ...(rows || []).map((row, index) => [
          index + 1,
          row.unitName || '',
          row.employeeCode || '',
          row.fullName || '',
          row.username || '',
          Number(row.totalScore || 0),
          Number(row.averageScore || 0),
          ...(extraColumnHeader ? [String(extraColumnValueGetter?.(row) || '')] : []),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 28 },
        { wch: 18 },
        { wch: 28 },
        { wch: 20 },
        { wch: 14 },
        { wch: 14 },
        ...(extraColumnHeader ? [{ wch: 28 }] : []),
      ];
      XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    };

    createEmployeeSheet(
      'Thi dua hoc tap',
      data.learningRows || [],
      'Xep hang hoc tap',
      (row) => row.assessmentLabel || '',
    );
    createEmployeeSheet(
      'Thi dua thuc hanh',
      data.behaviorRows || [],
      'Xep hang thuc hanh',
      (row) => row.assessmentLabel || '',
    );
    createEmployeeSheet('Thi dua hieu qua', data.performanceRows || []);
    createEmployeeSheet(
      'Tong hop I-II-III',
      data.overallRows || [],
      'Xep hang thi dua',
      (row) => row.competitionRankLabel || '',
    );

    const collectiveAoa = [
      ...metaRows,
      ['Hạng', 'Đơn vị', 'Số nhân viên', 'Tổng điểm', 'Điểm tập thể BQ/ngày'],
      ...((data.collectiveRows || []).map((row, index) => [
        index + 1,
        row.unitName || '',
        Number(row.employeeCount || 0),
        Number(row.totalScore || 0),
        Number(row.averageScore || 0),
      ])),
    ];
    const collectiveSheet = XLSX.utils.aoa_to_sheet(collectiveAoa);
    collectiveSheet['!cols'] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(workbook, collectiveSheet, 'Tong diem tap the');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fromDate = String(data.filters.fromDate || '').trim();
    const toDate = String(data.filters.toDate || '').trim();
    const fileName = `thi-dua-tnc-${fromDate || 'all'}-${toDate || 'all'}.xlsx`;
    return { buffer, fileName };
  }

  async exportStatisticsFile(
    currentUser: any,
    filters: { fromDate?: string; toDate?: string; employeeId?: string; unitId?: string },
  ) {
    const stats = await this.getStatistics(currentUser, filters);
    const criteria = (stats?.template?.sections || []).flatMap((section) => section.items || []);
    const sections = stats?.template?.sections || [];
    const header = [
      'Đơn vị',
      'Họ và tên',
      'Tài khoản',
      'Ngày',
      ...criteria.map((item) => item.contentName),
      ...sections.map((section) => `Tổng ${section.sectionName}`),
      'Tổng cộng',
    ];
    const rows = (stats?.rows || []).map((row) => [
      row.unitName || '',
      row.employee?.fullName || '',
      row.employee?.username || '',
      row.scoreDate || '',
      ...criteria.map((criterion) => 
        Number(row.scoresByItemCode?.[criterion.itemCode] || 0)
      ),
      ...sections.map((section) => Number(row.sectionTotals?.[section.sectionCode] || 0)),
      Number(row.totalScore || 0),
    ]);
    const aoa = [header, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ThongKeChamDiem');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fromDate = String(stats?.filters?.fromDate || '').trim();
    const toDate = String(stats?.filters?.toDate || '').trim();
    const fileName = `thong-ke-cham-diem-${fromDate || 'all'}-${toDate || 'all'}.xlsx`;
    return { buffer, fileName };
  }

  async exportProvincialStatisticsFile(
    scoreDate: string,
    filters?: { unitId?: string },
  ) {
    const normalizedDate = this.toDateKey(scoreDate || '');
    if (!normalizedDate) {
      throw new BadRequestException('scoreDate không hợp lệ');
    }

    const cutoffConfig = await this.systemConfigsRepository.findOne({
      where: { key: 'CUTOFF_HOUR_MANAGER' },
    });
    const cutoffHour = Number(cutoffConfig?.value ?? 7);
    const appliedCutoffHour = Number.isFinite(cutoffHour) ? cutoffHour : 7;

    const criteriaPairs: Array<{ itemCode: string; scoreAlias: string; noteAlias: string }> = [
      {
        itemCode: 'LEARNING_TRAINING_PARTICIPATION',
        scoreAlias: 'learningTrainingParticipationScore',
        noteAlias: 'learningTrainingParticipationNote',
      },
      {
        itemCode: 'LEARNING_WORKBOOK_EXERCISE',
        scoreAlias: 'learningWorkbookExerciseScore',
        noteAlias: 'learningWorkbookExerciseNote',
      },
      {
        itemCode: 'LEARNING_MULTIPLE_CHOICE',
        scoreAlias: 'learningMultipleChoiceScore',
        noteAlias: 'learningMultipleChoiceNote',
      },
      {
        itemCode: 'LEARNING_STAGE_EXERCISE',
        scoreAlias: 'learningStageExerciseScore',
        noteAlias: 'learningStageExerciseNote',
      },
      {
        itemCode: 'BEHAVIOR_SALES_PLAN',
        scoreAlias: 'behaviorSalesPlanScore',
        noteAlias: 'behaviorSalesPlanNote',
      },
      {
        itemCode: 'BEHAVIOR_PREPARE_CONSULT',
        scoreAlias: 'behaviorPrepareConsultScore',
        noteAlias: 'behaviorPrepareConsultNote',
      },
      {
        itemCode: 'BEHAVIOR_CUSTOMERS_CONTACTED',
        scoreAlias: 'behaviorCustomersContactedScore',
        noteAlias: 'behaviorCustomersContactedNote',
      },
      {
        itemCode: 'BEHAVIOR_OLD_CUSTOMERS_CONSULTED',
        scoreAlias: 'behaviorOldCustomersConsultedScore',
        noteAlias: 'behaviorOldCustomersConsultedNote',
      },
      {
        itemCode: 'BEHAVIOR_SUCCESSFUL_CARE_CALLS',
        scoreAlias: 'behaviorSuccessfulCareCallsScore',
        noteAlias: 'behaviorSuccessfulCareCallsNote',
      },
      {
        itemCode: 'BEHAVIOR_DAILY_CHECKLIST',
        scoreAlias: 'behaviorDailyChecklistScore',
        noteAlias: 'behaviorDailyChecklistNote',
      },
      {
        itemCode: 'BEHAVIOR_DIRECTOR_EVALUATION',
        scoreAlias: 'behaviorDirectorEvaluationScore',
        noteAlias: 'behaviorDirectorEvaluationNote',
      },
      {
        itemCode: 'PERFORMANCE_RENEWAL_SERVICES',
        scoreAlias: 'performanceRenewalServicesScore',
        noteAlias: 'performanceRenewalServicesNote',
      },
      {
        itemCode: 'PERFORMANCE_NEW_PTM_PACKAGES',
        scoreAlias: 'performanceNewPtmPackagesScore',
        noteAlias: 'performanceNewPtmPackagesNote',
      },
      {
        itemCode: 'PERFORMANCE_CLOSE_RATE',
        scoreAlias: 'performanceCloseRateScore',
        noteAlias: 'performanceCloseRateNote',
      },
      {
        itemCode: 'PERFORMANCE_REVENUE',
        scoreAlias: 'performanceRevenueScore',
        noteAlias: 'performanceRevenueNote',
      },
      {
        itemCode: 'PERFORMANCE_RETURNING_REFERRED',
        scoreAlias: 'performanceReturningReferredScore',
        noteAlias: 'performanceReturningReferredNote',
      },
    ];

    const qb = this.sheetsRepository
      .createQueryBuilder('s')
      .innerJoin('users', 'e', 's.employee_id = e.id')
      .innerJoin('units', 'u', 's.unit_id = u.id')
      .innerJoin('manager_daily_score_items', 'i', 'i.sheet_id = s.id')
      .innerJoin('manager_daily_score_criteria', 'c', 'i.criteria_id = c.id')
      .select('u.name', 'unitName')
      .addSelect('e."fullName"', 'fullName')
      .addSelect('e."employeeCode"', 'employeeCode')
      .addSelect('s.score_date', 'scoreDate');

    criteriaPairs.forEach((pair) => {
      qb.addSelect(
        `MAX(CASE WHEN c.item_code = :${pair.itemCode}_itemCode THEN CASE WHEN s.status = 'APPROVED' THEN i.score ELSE i.self_score END ELSE 0 END)`,
        pair.scoreAlias,
      ).addSelect(
        `MAX(CASE WHEN c.item_code = :${pair.itemCode}_itemCode THEN i.employee_note ELSE NULL END)`,
        pair.noteAlias,
      );
      qb.setParameter(`${pair.itemCode}_itemCode`, pair.itemCode);
    });

    qb.addSelect(
      `SUM(CASE WHEN s.status = 'APPROVED' THEN i.score ELSE i.self_score END)`,
      'totalScore',
    )
      .addSelect(
        `CASE WHEN s.status = 'APPROVED' THEN 'Đã duyệt' ELSE 'Chưa duyệt' END`,
        'approvalStatus',
      )
      .where('s.score_date = :scoreDate', { scoreDate: normalizedDate })
      .andWhere(
        `s.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' >= (CAST(:scoreDate AS DATE) + make_interval(hours => CAST(:cutoffHour AS int)))`,
        { cutoffHour: appliedCutoffHour },
      )
      .andWhere(
        `s.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' < (CAST(:scoreDate AS DATE) + INTERVAL '1 day' + make_interval(hours => CAST(:cutoffHour AS int)))`,
        { cutoffHour: appliedCutoffHour },
      )
      .andWhere('COALESCE(u."excludeFromStatistics", false) = false');

    if (filters?.unitId) {
      qb.andWhere('u.id = :unitId', { unitId: filters.unitId });
    }

    qb.groupBy('u.name')
      .addGroupBy('e."fullName"')
      .addGroupBy('e."employeeCode"')
      .addGroupBy('s.score_date')
      .addGroupBy('s.status')
      .orderBy('u.name', 'ASC')
      .addOrderBy('e."fullName"', 'ASC');

    const rows = await qb.getRawMany();

    const exportRows = rows.map((row) => ({
      'Đơn vị': row.unitName || '',
      'Họ và tên': row.fullName || '',
      'Mã nhân viên': row.employeeCode || '',
      Ngày: row.scoreDate || '',
      'Điểm - Tham gia đào tạo, giao ban': Number(row.learningTrainingParticipationScore || 0),
      'Nội dung - Tham gia đào tạo, giao ban': row.learningTrainingParticipationNote || '',
      'Điểm - Làm bài tập Sổ tay': Number(row.learningWorkbookExerciseScore || 0),
      'Nội dung - Làm bài tập Sổ tay': row.learningWorkbookExerciseNote || '',
      'Điểm - Làm bài tập trắc nghiệm': Number(row.learningMultipleChoiceScore || 0),
      'Nội dung - Làm bài tập trắc nghiệm': row.learningMultipleChoiceNote || '',
      'Điểm - Bài tập theo giai đoạn': Number(row.learningStageExerciseScore || 0),
      'Nội dung - Bài tập theo giai đoạn': row.learningStageExerciseNote || '',
      'Điểm - Lập kế hoạch bán hàng': Number(row.behaviorSalesPlanScore || 0),
      'Nội dung - Lập kế hoạch bán hàng': row.behaviorSalesPlanNote || '',
      'Điểm - Chuẩn bị câu hỏi tư vấn': Number(row.behaviorPrepareConsultScore || 0),
      'Nội dung - Chuẩn bị câu hỏi tư vấn': row.behaviorPrepareConsultNote || '',
      'Điểm - Số khách hàng tiếp cận': Number(row.behaviorCustomersContactedScore || 0),
      'Nội dung - Số khách hàng tiếp cận': row.behaviorCustomersContactedNote || '',
      'Điểm - Số khách cũ tư vấn': Number(row.behaviorOldCustomersConsultedScore || 0),
      'Nội dung - Số khách cũ tư vấn': row.behaviorOldCustomersConsultedNote || '',
      'Điểm - Số cuộc gọi CSKH thành công': Number(row.behaviorSuccessfulCareCallsScore || 0),
      'Nội dung - Số cuộc gọi CSKH thành công': row.behaviorSuccessfulCareCallsNote || '',
      'Điểm - Ghi nhật ký, checklist': Number(row.behaviorDailyChecklistScore || 0),
      'Nội dung - Ghi nhật ký, checklist': row.behaviorDailyChecklistNote || '',
      'Điểm - Giám đốc đánh giá': Number(row.behaviorDirectorEvaluationScore || 0),
      'Nội dung - Giám đốc đánh giá': row.behaviorDirectorEvaluationNote || '',
      'Điểm - Số DV mới/gia hạn': Number(row.performanceRenewalServicesScore || 0),
      'Nội dung - Số DV mới/gia hạn': row.performanceRenewalServicesNote || '',
      'Điểm - Số gói ca PTM mới': Number(row.performanceNewPtmPackagesScore || 0),
      'Nội dung - Số gói ca PTM mới': row.performanceNewPtmPackagesNote || '',
      'Điểm - Tỷ lệ chốt dịch vụ': Number(row.performanceCloseRateScore || 0),
      'Nội dung - Tỷ lệ chốt dịch vụ': row.performanceCloseRateNote || '',
      'Điểm - Doanh thu cá nhân': Number(row.performanceRevenueScore || 0),
      'Nội dung - Doanh thu cá nhân': row.performanceRevenueNote || '',
      'Điểm - Số KH giới thiệu': Number(row.performanceReturningReferredScore || 0),
      'Nội dung - Số KH giới thiệu': row.performanceReturningReferredNote || '',
      'Tổng cộng': Number(row.totalScore || 0),
      'Trạng thái': row.approvalStatus || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ThongKeToanTinh');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      buffer,
      fileName: `bao-cao-thong-ke-toan-tinh-${normalizedDate}.xlsx`,
    };
  }

  async exportUnitStatisticsFile(
    currentUser: any,
    scoreDate: string,
    filters?: { unitId?: string },
  ) {
    const unitId =
      currentUser?.role === Role.MANAGER ? currentUser?.unitId : filters?.unitId;
    const file = await this.exportProvincialStatisticsFile(scoreDate, { unitId });
    return {
      buffer: file.buffer,
      fileName: String(file.fileName || '').replace(
        'bao-cao-thong-ke-toan-tinh-',
        'bao-cao-thong-ke-don-vi-',
      ),
    };
  }
}
