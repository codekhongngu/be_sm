import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/common/enums/role.enum';
import { User } from 'src/users/entities/user.entity';
import { Unit } from 'src/users/entities/unit.entity';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { CreateManagerDailyScoreCriterionDto } from './dto/create-manager-daily-score-criterion.dto';
import { SubmitManagerDailyScoreDto } from './dto/submit-manager-daily-score.dto';
import { UpdateManagerDailyScoreCriterionDto } from './dto/update-manager-daily-score-criterion.dto';
import { ManagerDailyScoreCriterion } from './entities/manager-daily-score-criterion.entity';
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
const BEHAVIOR_SUCCESSFUL_CARE_CALLS_CODE = 'BEHAVIOR_SUCCESSFUL_CARE_CALLS';

@Injectable()
export class ManagerDailyScoresService {
  constructor(
    @InjectRepository(ManagerDailyScoreCriterion)
    private readonly criteriaRepository: Repository<ManagerDailyScoreCriterion>,
    @InjectRepository(ManagerDailyScoreSheet)
    private readonly sheetsRepository: Repository<ManagerDailyScoreSheet>,
    @InjectRepository(ManagerDailyScoreItem)
    private readonly itemsRepository: Repository<ManagerDailyScoreItem>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Unit)
    private readonly unitsRepository: Repository<Unit>,
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
      unitId: user.unitId,
      unitName: user.unit?.name || '',
    }));
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
          unitId: employee.unitId,
          unitName: employee.unit?.name || '',
        },
        sheet: null,
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
      
      if (currentUser.role !== Role.EMPLOYEE) {
        if (!String(payloadItem.requirementNote || '').trim()) {
          throw new BadRequestException(
            `Ghi chú yêu cầu là bắt buộc tại tiêu chí ${criterion.contentName}`,
          );
        }
        const maxScore = this.normalizeNumber(criterion.maxScore);
        if (payloadItem.score > maxScore) {
          throw new BadRequestException(
            `Điểm tiêu chí ${criterion.contentName} không được vượt quá ${maxScore}`,
          );
        }
      }
    }

    const criterionByCode = new Map(activeCriteria.map((item) => [item.itemCode, item]));
    if (currentUser.role !== Role.EMPLOYEE) {
      const customersContacted = criterionByCode.get(BEHAVIOR_CUSTOMERS_CONTACTED_CODE);
      const successfulCareCalls = criterionByCode.get(BEHAVIOR_SUCCESSFUL_CARE_CALLS_CODE);
      if (customersContacted && successfulCareCalls) {
        const customersContactedScore = Number(
          payloadMap.get(customersContacted.id)?.score || 0,
        );
        const successfulCareCallsScore = Number(
          payloadMap.get(successfulCareCalls.id)?.score || 0,
        );
        if (customersContactedScore > 0 && successfulCareCallsScore > 0) {
          throw new BadRequestException(
            'Tiêu chí Số khách hàng tiếp cận và Số cuộc gọi CSKH thành công không được cùng lớn hơn 0',
          );
        }
      }

      const behaviorCriteriaIds = activeCriteria
        .filter((item) => item.sectionCode === BEHAVIOR_SECTION_CODE)
        .map((item) => item.id);
      const behaviorSectionScore = behaviorCriteriaIds.reduce(
        (sum, criteriaId) => sum + Number(payloadMap.get(criteriaId)?.score || 0),
        0,
      );
      if (behaviorSectionScore > BEHAVIOR_SECTION_MAX_SCORE) {
        throw new BadRequestException(
          `Tổng điểm phần II. Thực hành hành vi không được vượt quá ${BEHAVIOR_SECTION_MAX_SCORE}`,
        );
      }
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
        employeeNote = String(item.employeeNote || '').trim();
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

    const qb = this.sheetsRepository
      .createQueryBuilder('sheet')
      .leftJoinAndSelect('sheet.employee', 'employee')
      .leftJoinAndSelect('employee.unit', 'employeeunit')
      .leftJoinAndSelect('sheet.manager', 'manager')
      .leftJoinAndSelect('sheet.items', 'items')
      .leftJoinAndSelect('items.criterion', 'criterion');

    const fromDate = this.toDateKey(filters.fromDate || '');
    const toDate = this.toDateKey(filters.toDate || '');

    if (fromDate) {
      qb.andWhere('sheet.score_date >= :fromDate', { fromDate });
    }
    if (toDate) {
      qb.andWhere('sheet.score_date <= :toDate', { toDate });
    }

    // Không tính trong thống kê 2 ngày cuối tuần thứ 7 và chủ nhật
    qb.andWhere('EXTRACT(ISODOW FROM sheet.score_date) NOT IN (6, 7)');

    if (filters.employeeId) {
      const employee = await this.getEmployeeByScope(currentUser, filters.employeeId);
      qb.andWhere('sheet.employeeId = :employeeId', { employeeId: employee.id });
    } else if (currentUser.role === Role.MANAGER) {
      qb.andWhere('sheet.unitId = :unitId', { unitId: currentUser.unitId });
    } else if (filters.unitId) {
      qb.andWhere('sheet.unitId = :unitId', { unitId: filters.unitId });
    }

    qb.andWhere('sheet.status = :status', { status: 'APPROVED' });
    qb.andWhere('(employeeunit."excludeFromStatistics" IS NULL OR employeeunit."excludeFromStatistics" = false)');

    console.log("--- QUERY THỐNG KÊ TOÀN TỈNH ---");
    console.log(qb.getQuery());
    console.log(qb.getParameters());

    const sheets = await qb
      .orderBy('sheet.score_date', 'DESC')
      .addOrderBy('employee."fullName"', 'ASC')
      .getMany();

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

    const allUnitsQb = this.unitsRepository.createQueryBuilder('unit')
      .where('(unit."excludeFromStatistics" IS NULL OR unit."excludeFromStatistics" = false)');
    if (currentUser.role === Role.MANAGER) {
      allUnitsQb.andWhere('unit.id = :unitId', { unitId: currentUser.unitId });
    } else if (filters.unitId) {
      allUnitsQb.andWhere('unit.id = :unitId', { unitId: filters.unitId });
    }
    const allUnits = await allUnitsQb.getMany();

    for (const unit of allUnits) {
      const employeeCount = await this.usersRepository.count({
        where: { unitId: unit.id, role: Role.EMPLOYEE }
      });
      unitMap.set(unit.name, {
        unitId: unit.id,
        unitName: unit.name,
        totalScore: 0,
        employeeCount: employeeCount
      });
    }

    rows.forEach((row) => {
      const unitName = row.unitName || 'Chưa rõ đơn vị';
      const unit = unitMap.get(unitName);
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
}
