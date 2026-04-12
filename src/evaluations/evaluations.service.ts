import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/common/enums/role.enum';
import { JournalsService } from 'src/journals/journals.service';
import { TelegramService } from 'src/telegram/telegram.service';
import { UsersService } from 'src/users/users.service';
import { Repository } from 'typeorm';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { Evaluation } from './entities/evaluation.entity';
import { validateActionTimeForDate } from 'src/common/utils/time-validator.util';

@Injectable()
export class EvaluationsService {
  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationsRepository: Repository<Evaluation>,
    private readonly journalsService: JournalsService,
    private readonly usersService: UsersService,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  private validateManagerNote(payload: {
    deepInquiryStatus?: boolean;
    fullProposalStatus?: boolean;
    persistenceStatus?: boolean;
    deepInquiryNote?: string;
    fullProposalNote?: string;
    persistenceNote?: string;
    standardsReviewed?: boolean;
    standardsManagerNote?: string;
  }) {
    if (payload.standardsReviewed === false) {
      return;
    }
    if (payload.deepInquiryStatus === false && !String(payload.deepInquiryNote || '').trim()) {
      throw new BadRequestException('Bắt buộc nhập ghi chú cho tiêu chí Hỏi sâu hơn');
    }
    if (
      payload.fullProposalStatus === false &&
      !String(payload.fullProposalNote || '').trim()
    ) {
      throw new BadRequestException('Bắt buộc nhập ghi chú cho tiêu chí Đề xuất đầy đủ');
    }
    if (
      payload.persistenceStatus === false &&
      !String(payload.persistenceNote || '').trim()
    ) {
      throw new BadRequestException('Bắt buộc nhập ghi chú cho tiêu chí Theo đến quyết');
    }
    const hasAnyFalse =
      payload.deepInquiryStatus === false ||
      payload.fullProposalStatus === false ||
      payload.persistenceStatus === false;
    if (hasAnyFalse && !String(payload.standardsManagerNote || '').trim()) {
      throw new BadRequestException(
        'Bắt buộc nhập ghi chú phần Giữ chuẩn khi có tiêu chí Chưa thực hiện',
      );
    }
  }

  private validateAwarenessCriteria(payload: {
    awarenessDeepInquiryStatus?: boolean;
    awarenessFullProposalStatus?: boolean;
    awarenessPersistenceStatus?: boolean;
    awarenessDeepInquiryNote?: string;
    awarenessFullProposalNote?: string;
    awarenessPersistenceNote?: string;
    awarenessReviewed?: boolean;
  }) {
    if (payload.awarenessReviewed === false) {
      return;
    }
    if (
      payload.awarenessDeepInquiryStatus === false &&
      !String(payload.awarenessDeepInquiryNote || '').trim()
    ) {
      throw new BadRequestException(
        'Bắt buộc nhập ghi chú tiêu chí Hỏi sâu hơn cho phần Nhận diện',
      );
    }
    if (
      payload.awarenessFullProposalStatus === false &&
      !String(payload.awarenessFullProposalNote || '').trim()
    ) {
      throw new BadRequestException(
        'Bắt buộc nhập ghi chú tiêu chí Đề xuất đầy đủ cho phần Nhận diện',
      );
    }
    if (
      payload.awarenessPersistenceStatus === false &&
      !String(payload.awarenessPersistenceNote || '').trim()
    ) {
      throw new BadRequestException(
        'Bắt buộc nhập ghi chú tiêu chí Theo đến quyết cho phần Nhận diện',
      );
    }
  }

  private buildResultLabel(evaluation: Evaluation) {
    const awarenessPass =
      !evaluation.awarenessReviewed ||
      (evaluation.awarenessDeepInquiryStatus &&
        evaluation.awarenessFullProposalStatus &&
        evaluation.awarenessPersistenceStatus);
    const standardsPass =
      !evaluation.standardsReviewed ||
      (evaluation.deepInquiryStatus &&
        evaluation.fullProposalStatus &&
        evaluation.persistenceStatus);
    return awarenessPass && standardsPass
      ? 'Đạt'
      : 'Chưa đạt';
  }

  private async resolveManagerAndJournal(journalId: string, user: any) {
    const journal = await this.journalsService.findById(journalId);
    if (!journal) {
      throw new NotFoundException('Không tìm thấy nhật ký');
    }
    if (user.role === Role.MANAGER && journal.user.unitId !== user.unitId) {
      throw new ForbiddenException('Chỉ đánh giá nhật ký thuộc cùng đơn vị');
    }
    const manager =
      user.role === Role.ADMIN
        ? await this.usersService.findManagerByUnitId(journal.user.unitId)
        : await this.usersService.findById(user.id);
    if (!manager) {
      throw new BadRequestException('Không xác định được quản lý đánh giá');
    }
    return { journal, manager };
  }

  private async notifyEmployeeResult(journal: any, evaluation: Evaluation) {
    const baseUrl =
      this.configService.get<string>('APP_BASE_URL') || 'http://localhost:3000';
    const dateLabel = new Date(journal.reportDate || journal.createdAt)
      .toISOString()
      .slice(0, 10);
    const result = this.buildResultLabel(evaluation);
    const message =
      `Kết quả chấm nhật ký ngày ${dateLabel}: ${result}\n` +
      `=== E-form Nhận diện ===\n` +
      `- Hỏi sâu hơn: ${evaluation.awarenessDeepInquiryStatus ? 'Đã thực hiện' : 'Chưa thực hiện'}\n` +
      `  Ghi chú: ${evaluation.awarenessDeepInquiryNote || 'Không có'}\n` +
      `- Đề xuất đầy đủ: ${evaluation.awarenessFullProposalStatus ? 'Đã thực hiện' : 'Chưa thực hiện'}\n` +
      `  Ghi chú: ${evaluation.awarenessFullProposalNote || 'Không có'}\n` +
      `- Theo đến quyết: ${evaluation.awarenessPersistenceStatus ? 'Đã thực hiện' : 'Chưa thực hiện'}\n` +
      `  Ghi chú: ${evaluation.awarenessPersistenceNote || 'Không có'}\n` +
      `- Tổng kết: ${evaluation.awarenessManagerNote || 'Không có'}\n` +
      `=== E-form Giữ chuẩn ===\n` +
      `- Hỏi sâu hơn: ${evaluation.deepInquiryStatus ? 'Đã thực hiện' : 'Chưa thực hiện'}\n` +
      `  Ghi chú: ${evaluation.deepInquiryNote || 'Không có'}\n` +
      `- Đề xuất đầy đủ: ${evaluation.fullProposalStatus ? 'Đã thực hiện' : 'Chưa thực hiện'}\n` +
      `  Ghi chú: ${evaluation.fullProposalNote || 'Không có'}\n` +
      `- Theo đến quyết: ${evaluation.persistenceStatus ? 'Đã thực hiện' : 'Chưa thực hiện'}\n` +
      `  Ghi chú: ${evaluation.persistenceNote || 'Không có'}\n` +
      `- Tổng kết: ${evaluation.standardsManagerNote || 'Không có'}\n` +
      `Xem phản hồi: ${baseUrl}/journals/${journal.id}`;
    if (journal.user.telegramChatId) {
      await this.telegramService.sendMessage(journal.user.telegramChatId, message);
    }
  }

  async create(createEvaluationDto: CreateEvaluationDto, user: any) {
    if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ quản lý/admin được đánh giá nhật ký');
    }

    this.validateAwarenessCriteria(createEvaluationDto);
    this.validateManagerNote(createEvaluationDto);
    const { journal, manager } = await this.resolveManagerAndJournal(
      createEvaluationDto.journalId,
      user,
    );

    const existingEvaluation = await this.evaluationsRepository.findOne({
      journalId: createEvaluationDto.journalId,
    });
    if (existingEvaluation) {
      throw new BadRequestException('Nhật ký này đã được đánh giá');
    }

    const evaluation = this.evaluationsRepository.create({
      ...createEvaluationDto,
      managerId: manager.id,
    });
    const savedEvaluation = await this.evaluationsRepository.save(evaluation);
    await this.notifyEmployeeResult(journal, savedEvaluation);

    return savedEvaluation;
  }

  async updateByJournalId(
    journalId: string,
    dto: UpdateEvaluationDto,
    user: any,
  ) {
    if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ quản lý/admin được cập nhật đánh giá');
    }
    const { journal, manager } = await this.resolveManagerAndJournal(journalId, user);
    validateActionTimeForDate(journal.reportDate || journal.createdAt, 'Đánh giá/chấm điểm');
    let evaluation = await this.evaluationsRepository.findOne({ journalId });
    if (!evaluation) {
      const required = [
        dto.deepInquiryStatus,
        dto.fullProposalStatus,
        dto.persistenceStatus,
      ];
      if (required.some((item) => item === undefined)) {
        throw new BadRequestException(
          'Chưa có đánh giá, vui lòng gửi đủ 3 tiêu chí để tạo mới',
        );
      }
      this.validateManagerNote(dto);
      evaluation = this.evaluationsRepository.create({
        journalId,
        managerId: manager.id,
        awarenessReviewed: dto.awarenessReviewed ?? false,
        awarenessDeepInquiryStatus: dto.awarenessDeepInquiryStatus ?? false,
        awarenessFullProposalStatus: dto.awarenessFullProposalStatus ?? false,
        awarenessPersistenceStatus: dto.awarenessPersistenceStatus ?? false,
        awarenessDeepInquiryNote: dto.awarenessDeepInquiryNote,
        awarenessFullProposalNote: dto.awarenessFullProposalNote,
        awarenessPersistenceNote: dto.awarenessPersistenceNote,
        standardsReviewed: dto.standardsReviewed ?? true,
        deepInquiryStatus: dto.deepInquiryStatus!,
        fullProposalStatus: dto.fullProposalStatus!,
        persistenceStatus: dto.persistenceStatus!,
        deepInquiryNote: dto.deepInquiryNote,
        fullProposalNote: dto.fullProposalNote,
        persistenceNote: dto.persistenceNote,
        awarenessManagerNote: dto.awarenessManagerNote,
        standardsManagerNote: dto.standardsManagerNote,
      });
    } else {
      if (dto.awarenessReviewed !== undefined) {
        evaluation.awarenessReviewed = dto.awarenessReviewed;
      }
      if (dto.awarenessManagerNote !== undefined) {
        evaluation.awarenessManagerNote = dto.awarenessManagerNote;
      }
      if (dto.awarenessDeepInquiryStatus !== undefined) {
        evaluation.awarenessDeepInquiryStatus = dto.awarenessDeepInquiryStatus;
      }
      if (dto.awarenessFullProposalStatus !== undefined) {
        evaluation.awarenessFullProposalStatus = dto.awarenessFullProposalStatus;
      }
      if (dto.awarenessPersistenceStatus !== undefined) {
        evaluation.awarenessPersistenceStatus = dto.awarenessPersistenceStatus;
      }
      if (dto.awarenessDeepInquiryNote !== undefined) {
        evaluation.awarenessDeepInquiryNote = dto.awarenessDeepInquiryNote;
      }
      if (dto.awarenessFullProposalNote !== undefined) {
        evaluation.awarenessFullProposalNote = dto.awarenessFullProposalNote;
      }
      if (dto.awarenessPersistenceNote !== undefined) {
        evaluation.awarenessPersistenceNote = dto.awarenessPersistenceNote;
      }
      if (dto.standardsReviewed !== undefined) {
        evaluation.standardsReviewed = dto.standardsReviewed;
      }
      if (dto.deepInquiryStatus !== undefined) {
        evaluation.deepInquiryStatus = dto.deepInquiryStatus;
      }
      if (dto.fullProposalStatus !== undefined) {
        evaluation.fullProposalStatus = dto.fullProposalStatus;
      }
      if (dto.persistenceStatus !== undefined) {
        evaluation.persistenceStatus = dto.persistenceStatus;
      }
      if (dto.deepInquiryNote !== undefined) {
        evaluation.deepInquiryNote = dto.deepInquiryNote;
      }
      if (dto.fullProposalNote !== undefined) {
        evaluation.fullProposalNote = dto.fullProposalNote;
      }
      if (dto.persistenceNote !== undefined) {
        evaluation.persistenceNote = dto.persistenceNote;
      }
      if (dto.standardsManagerNote !== undefined) {
        evaluation.standardsManagerNote = dto.standardsManagerNote;
      }
      this.validateAwarenessCriteria(evaluation);
      this.validateManagerNote(evaluation);
    }
    const saved = await this.evaluationsRepository.save(evaluation);
    await this.notifyEmployeeResult(journal, saved);
    return saved;
  }

  async updateAwarenessByJournalId(
    journalId: string,
    dto: UpdateEvaluationDto,
    user: any,
  ) {
    if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ quản lý/admin được cập nhật đánh giá');
    }
    const { journal, manager } = await this.resolveManagerAndJournal(journalId, user);
    validateActionTimeForDate(journal.reportDate || journal.createdAt, 'Đánh giá/chấm điểm');
    let evaluation = await this.evaluationsRepository.findOne({ journalId });
    if (!evaluation) {
      evaluation = this.evaluationsRepository.create({
        journalId,
        managerId: manager.id,
      });
    }
    if (dto.awarenessReviewed !== undefined) {
      evaluation.awarenessReviewed = dto.awarenessReviewed;
    }
    const required = [
      dto.awarenessDeepInquiryStatus,
      dto.awarenessFullProposalStatus,
      dto.awarenessPersistenceStatus,
    ];
    if (dto.awarenessReviewed === true && required.some((item) => item === undefined)) {
      throw new BadRequestException(
        'Vui lòng gửi đủ 3 tiêu chí cho phần chấm E-form Nhận diện',
      );
    }
    if (dto.awarenessDeepInquiryStatus !== undefined) {
      evaluation.awarenessDeepInquiryStatus = dto.awarenessDeepInquiryStatus;
    }
    if (dto.awarenessFullProposalStatus !== undefined) {
      evaluation.awarenessFullProposalStatus = dto.awarenessFullProposalStatus;
    }
    if (dto.awarenessPersistenceStatus !== undefined) {
      evaluation.awarenessPersistenceStatus = dto.awarenessPersistenceStatus;
    }
    if (dto.awarenessDeepInquiryNote !== undefined) {
      evaluation.awarenessDeepInquiryNote = dto.awarenessDeepInquiryNote;
    }
    if (dto.awarenessFullProposalNote !== undefined) {
      evaluation.awarenessFullProposalNote = dto.awarenessFullProposalNote;
    }
    if (dto.awarenessPersistenceNote !== undefined) {
      evaluation.awarenessPersistenceNote = dto.awarenessPersistenceNote;
    }
    if (dto.awarenessManagerNote !== undefined) {
      evaluation.awarenessManagerNote = dto.awarenessManagerNote;
    }
    this.validateAwarenessCriteria(evaluation);
    const saved = await this.evaluationsRepository.save(evaluation);
    await this.notifyEmployeeResult(journal, saved);
    return saved;
  }

  async updateStandardsByJournalId(
    journalId: string,
    dto: UpdateEvaluationDto,
    user: any,
  ) {
    if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ quản lý/admin được cập nhật đánh giá');
    }
    const { journal, manager } = await this.resolveManagerAndJournal(journalId, user);
    validateActionTimeForDate(journal.reportDate || journal.createdAt, 'Đánh giá/chấm điểm');
    let evaluation = await this.evaluationsRepository.findOne({ journalId });
    if (!evaluation) {
      const required = [
        dto.deepInquiryStatus,
        dto.fullProposalStatus,
        dto.persistenceStatus,
      ];
      if (required.some((item) => item === undefined)) {
        throw new BadRequestException(
          'Chưa có đánh giá, vui lòng gửi đủ 3 tiêu chí phần Giữ chuẩn',
        );
      }
      evaluation = this.evaluationsRepository.create({
        journalId,
        managerId: manager.id,
      });
    }
    if (dto.standardsReviewed !== undefined) {
      evaluation.standardsReviewed = dto.standardsReviewed;
    }
    if (dto.deepInquiryStatus !== undefined) {
      evaluation.deepInquiryStatus = dto.deepInquiryStatus;
    }
    if (dto.fullProposalStatus !== undefined) {
      evaluation.fullProposalStatus = dto.fullProposalStatus;
    }
    if (dto.persistenceStatus !== undefined) {
      evaluation.persistenceStatus = dto.persistenceStatus;
    }
    if (dto.deepInquiryNote !== undefined) {
      evaluation.deepInquiryNote = dto.deepInquiryNote;
    }
    if (dto.fullProposalNote !== undefined) {
      evaluation.fullProposalNote = dto.fullProposalNote;
    }
    if (dto.persistenceNote !== undefined) {
      evaluation.persistenceNote = dto.persistenceNote;
    }
    if (dto.standardsManagerNote !== undefined) {
      evaluation.standardsManagerNote = dto.standardsManagerNote;
    }
    this.validateManagerNote(evaluation);
    const saved = await this.evaluationsRepository.save(evaluation);
    await this.notifyEmployeeResult(journal, saved);
    return saved;
  }

  async getPendingForManager(user: any) {
    if (
      user.role !== Role.MANAGER &&
      user.role !== Role.ADMIN &&
      user.role !== Role.PROVINCIAL_VIEWER
    ) {
      throw new ForbiddenException('Chỉ quản lý/admin được xem danh sách chờ');
    }
    const journals = await this.journalsService.getList(user);
    return journals.filter(
      (journal: any) => {
        const evalData = journal.evaluation;
        const needAwarenessReview =
          !!journal.awarenessSubmittedAt && !evalData?.awarenessReviewed;
        const needStandardsReview =
          !!journal.standardsSubmittedAt && !evalData?.standardsReviewed;
        return needAwarenessReview || needStandardsReview;
      },
    );
  }

  async getWeeklyAnalytics(user: any) {
    if (
      user.role !== Role.MANAGER &&
      user.role !== Role.ADMIN &&
      user.role !== Role.PROVINCIAL_VIEWER
    ) {
      throw new ForbiddenException('Chỉ quản lý/admin được xem analytics');
    }
    const qb = this.evaluationsRepository
      .createQueryBuilder('evaluation')
      .leftJoinAndSelect('evaluation.journal', 'journal');
    if (user.role === Role.MANAGER) {
      qb.leftJoin('journal.user', 'user').andWhere('user.unitId = :unitId', {
        unitId: user.unitId,
      });
    }
    const rows = await qb.getMany();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const currentWeek = rows.filter(
      (row) => new Date(row.journal?.reportDate || row.createdAt) >= weekStart,
    );
    const total = currentWeek.length || 1;
    const deepInquiryRate =
      (currentWeek.filter((row) => row.deepInquiryStatus).length / total) * 100;
    const fullProposalRate =
      (currentWeek.filter((row) => row.fullProposalStatus).length / total) * 100;
    const persistenceRate =
      (currentWeek.filter((row) => row.persistenceStatus).length / total) * 100;
    return {
      totalEvaluations: currentWeek.length,
      deepInquiryRate: Number(deepInquiryRate.toFixed(2)),
      fullProposalRate: Number(fullProposalRate.toFixed(2)),
      persistenceRate: Number(persistenceRate.toFixed(2)),
    };
  }
}
