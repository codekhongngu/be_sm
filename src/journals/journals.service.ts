import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/common/enums/role.enum';
import { TelegramService } from 'src/telegram/telegram.service';
import { UsersService } from 'src/users/users.service';
import { Repository } from 'typeorm';
import { CreateJournalDto } from './dto/create-journal.dto';
import { SubmitAwarenessDto } from './dto/submit-awareness.dto';
import { SubmitStandardsDto } from './dto/submit-standards.dto';
import { Journal } from './entities/journal.entity';

@Injectable()
export class JournalsService {
  constructor(
    @InjectRepository(Journal)
    private readonly journalsRepository: Repository<Journal>,
    private readonly usersService: UsersService,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  private normalizeReportDate(reportDate?: string) {
    return reportDate ? reportDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  }

  private parseStandardsFromText(text: string) {
    const normalized = (text || '').toLowerCase();
    return {
      deepInquiry:
        normalized.includes('hỏi sâu') ||
        normalized.includes('hoi sau') ||
        normalized.includes('đào sâu') ||
        normalized.includes('dao sau'),
      fullConsult:
        normalized.includes('tư vấn đủ') ||
        normalized.includes('tu van du') ||
        normalized.includes('tv đủ') ||
        normalized.includes('tv du'),
      persistence:
        normalized.includes('theo đến cùng') ||
        normalized.includes('theo den cung') ||
        normalized.includes('bám khách') ||
        normalized.includes('bam khach'),
    };
  }

  private async getOrCreateDailyJournal(user: any, reportDate: string) {
    const existing = await this.journalsRepository.findOne({
      userId: user.id,
      reportDate,
    });
    if (existing) {
      return existing;
    }
    const journal = this.journalsRepository.create({
      userId: user.id,
      reportDate,
    });
    return this.journalsRepository.save(journal);
  }

  private trimText(value: string, max = 220) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    if (text.length <= max) {
      return text;
    }
    return `${text.slice(0, max)}...`;
  }

  private async notifyEformUpdate(params: {
    user: any;
    journalId: string;
    reportDate: string;
    eformName: string;
    action: 'nộp' | 'cập nhật';
    details: string[];
  }) {
    const unit = await this.usersService.findUnitById(params.user.unitId);
    const feBaseUrl =
      this.configService.get<string>('FE_ORIGIN') ||
      this.configService.get<string>('APP_BASE_URL') ||
      'http://localhost:3000';
    const normalizedFeBaseUrl = feBaseUrl.replace(/\/+$/g, '');
    const detailsText = params.details
      .filter((item) => !!item)
      .map((item) => `- ${item}`)
      .join('\n');
    const message =
      `Nhân viên ${params.user.fullName} vừa ${params.action} ${params.eformName}\n` +
      `Ngày: ${params.reportDate}\n` +
      `${detailsText}\n` +
      `Link đánh giá: ${normalizedFeBaseUrl}/discipline/manager-review/${params.journalId}`;
    if (unit?.telegramGroupChatId) {
      await this.telegramService.sendMessage(unit.telegramGroupChatId, message);
    }
  }

  async create(createJournalDto: CreateJournalDto, user: any) {
    if (user.role !== Role.EMPLOYEE) {
      throw new ForbiddenException('Chỉ nhân viên được nộp nhật ký');
    }
    const awareness = {
      avoidance: createJournalDto.avoidance,
      selfLimit: createJournalDto.selfLimit,
      earlyStop: createJournalDto.earlyStop,
      blaming: createJournalDto.blaming,
      reportDate: createJournalDto.reportDate,
    };
    const standards = {
      standardsKeptText: createJournalDto.standardsKeptText,
      backslideSigns: createJournalDto.backslideSigns,
      solution: createJournalDto.solution,
      reportDate: createJournalDto.reportDate,
    };
    await this.submitAwareness(awareness, user);
    return this.submitStandards(standards, user);
  }

  async submitAwareness(dto: SubmitAwarenessDto, user: any) {
    if (user.role !== Role.EMPLOYEE) {
      throw new ForbiddenException('Chỉ nhân viên được nộp nhật ký');
    }
    const reportDate = this.normalizeReportDate(dto.reportDate);
    const journal = await this.getOrCreateDailyJournal(user, reportDate);
    if (journal.awarenessSubmittedAt && journal.awarenessUpdateCount >= 1) {
      throw new BadRequestException(
        'E-form Nhận diện chỉ được cập nhật tối đa 1 lần trong ngày',
      );
    }
    journal.avoidance = dto.avoidance;
    journal.selfLimit = dto.selfLimit;
    journal.earlyStop = dto.earlyStop;
    journal.blaming = dto.blaming;
    const isFirstSubmit = !journal.awarenessSubmittedAt;
    journal.awarenessSubmittedAt = new Date();
    if (!isFirstSubmit) {
      journal.awarenessUpdateCount += 1;
    }
    const saved = await this.journalsRepository.save(journal);
    await this.notifyEformUpdate({
      user,
      journalId: saved.id,
      reportDate,
      eformName: 'Nhật ký nhận diện hằng ngày',
      action: isFirstSubmit ? 'nộp' : 'cập nhật',
      details: [
        `Hôm nay tôi đã né điều gì: ${this.trimText(dto.avoidance)}`,
        `Tôi có tự loại gói nào không: ${this.trimText(dto.selfLimit)}`,
        `Tôi đã dừng tư vấn sớm ở điểm nào: ${this.trimText(dto.earlyStop)}`,
        `Khi không bán được dịch vụ anh chị thường đỗ lỗi cho vấn đề gì: ${this.trimText(dto.blaming)}`,
      ],
    });
    return saved;
  }

  async submitStandards(dto: SubmitStandardsDto, user: any) {
    if (user.role !== Role.EMPLOYEE) {
      throw new ForbiddenException('Chỉ nhân viên được nộp nhật ký');
    }
    const reportDate = this.normalizeReportDate(dto.reportDate);
    const journal = await this.getOrCreateDailyJournal(user, reportDate);
    if (journal.standardsSubmittedAt && journal.standardsUpdateCount >= 1) {
      throw new BadRequestException(
        'E-form Giữ chuẩn chỉ được cập nhật tối đa 1 lần trong ngày',
      );
    }
    journal.standardsKeptText = dto.standardsKeptText;
    journal.standardsKept = this.parseStandardsFromText(dto.standardsKeptText);
    journal.backslideSigns = dto.backslideSigns;
    journal.solution = dto.solution;
    const isFirstSubmit = !journal.standardsSubmittedAt;
    journal.standardsSubmittedAt = new Date();
    if (!isFirstSubmit) {
      journal.standardsUpdateCount += 1;
    }
    const saved = await this.journalsRepository.save(journal);
    await this.notifyEformUpdate({
      user,
      journalId: saved.id,
      reportDate,
      eformName: 'Nhật ký giữ chuẩn thu nhập cao',
      action: isFirstSubmit ? 'nộp' : 'cập nhật',
      details: [
        `Hôm nay tôi giữ được chuẩn nào: ${this.trimText(dto.standardsKeptText)}`,
        `Dấu hiệu tụt chuẩn nào xuất hiện: ${this.trimText(dto.backslideSigns)}`,
        `Tôi đã xử lý nó ra sao: ${this.trimText(dto.solution)}`,
      ],
    });
    return saved;
  }

  getList(
    user: any,
    filters?: { fromDate?: string; toDate?: string; status?: string },
  ) {
    const qb = this.journalsRepository
      .createQueryBuilder('journal')
      .leftJoinAndSelect('journal.user', 'user')
      .leftJoinAndSelect('journal.evaluation', 'evaluation')
      .leftJoinAndSelect('evaluation.manager', 'manager')
      .orderBy('journal.reportDate', 'DESC')
      .addOrderBy('journal.createdAt', 'DESC');

    if (user.role === Role.EMPLOYEE) {
      qb.andWhere('journal.userId = :userId', { userId: user.id });
    } else if (user.role === Role.MANAGER) {
      qb.andWhere('user.unitId = :unitId', { unitId: user.unitId });
    }

    if (filters?.fromDate) {
      qb.andWhere('journal.reportDate >= :fromDate', { fromDate: filters.fromDate });
    }
    if (filters?.toDate) {
      qb.andWhere('journal.reportDate <= :toDate', { toDate: filters.toDate });
    }
    if (filters?.status === 'graded') {
      qb.andWhere('evaluation.id IS NOT NULL');
    } else if (filters?.status === 'pending') {
      qb.andWhere('evaluation.id IS NULL');
    }

    return qb.getMany();
  }

  async findById(id: string) {
    return this.journalsRepository.findOne(id, {
      relations: ['user', 'evaluation', 'evaluation.manager'],
    });
  }
}
