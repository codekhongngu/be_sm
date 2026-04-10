import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { TelegramService } from './telegram.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { BehaviorFormType } from 'src/behavior/dto/submit-log.dto';
import { Journal } from 'src/journals/entities/journal.entity';
import { BehaviorChecklistLog } from 'src/behavior/entities/behavior-checklist-log.entity';
import { MindsetLog } from 'src/behavior/entities/mindset-log.entity';
import { SalesActivityReport } from 'src/behavior/entities/sales-activity-report.entity';
import { EndOfDayLog } from 'src/behavior/entities/end-of-day-log.entity';
import { BeliefTransformationLog } from 'src/behavior/entities/belief-transformation-log.entity';

@Controller('telegram')
@UseGuards(JwtAuthGuard)
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Journal) private readonly journalsRepository: Repository<Journal>,
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
  ) {}

  private toDateKey(value?: string) {
    return String(value || '').slice(0, 10);
  }

  private formatText(value?: string | null) {
    const normalized = String(value || '').trim();
    return normalized || '(trống)';
  }

  private formatBoolean(value?: boolean | null) {
    return value ? 'Có' : 'Không';
  }

  private async buildFormMessage(
    user: User,
    formType: BehaviorFormType,
    logDate: string,
    formPart?: 'awareness' | 'standards',
  ) {
    const baseHeader = `THÔNG BÁO NỘP BIỂU MẪU 90 NGÀY\n\nI. THÔNG TIN CHUNG\n1. Nhân viên: ${user.fullName}\n2. Ngày ghi nhận: ${logDate}\n`;
    if (formType === BehaviorFormType.FORM_1) {
      const journal = await this.journalsRepository.findOne({
        where: { userId: user.id, reportDate: logDate },
      });
      if (!journal) {
        throw new BadRequestException('Chưa có dữ liệu Mẫu 1 để gửi Telegram');
      }
      if (formPart === 'standards') {
        return `${baseHeader}\nII. BIỂU MẪU\n1. Tên mẫu: Mẫu 1 - Giữ chuẩn\n\nIII. NỘI DUNG ĐÃ KHAI BÁO\n1. Chuẩn đã giữ: ${this.formatText(
          journal.standardsKeptText,
        )}\n2. Dấu hiệu tụt chuẩn: ${this.formatText(
          journal.backslideSigns,
        )}\n3. Cách xử lý: ${this.formatText(journal.solution)}`;
      }
      return `${baseHeader}\nII. BIỂU MẪU\n1. Tên mẫu: Mẫu 1 - Nhận diện\n\nIII. NỘI DUNG ĐÃ KHAI BÁO\n1. Hôm nay đã né điều gì: ${this.formatText(
        journal.avoidance,
      )}\n2. Tự loại gói nào: ${this.formatText(
        journal.selfLimit,
      )}\n3. Dừng tư vấn sớm ở điểm nào: ${this.formatText(
        journal.earlyStop,
      )}\n4. Lý do không bán được dịch vụ: ${this.formatText(journal.blaming)}`;
    }

    if (formType === BehaviorFormType.FORM_2) {
      const data = await this.behaviorChecklistLogsRepository.findOne({
        where: { userId: user.id, logDate },
      });
      if (!data) {
        throw new BadRequestException('Chưa có dữ liệu Mẫu 2 để gửi Telegram');
      }
      return `${baseHeader}\nII. BIỂU MẪU\n1. Tên mẫu: Mẫu 2 - Hành vi\n\nIII. NỘI DUNG ĐÃ KHAI BÁO\n1. Số khách hàng tiếp cận: ${data.customerMetCount}\n2. Hỏi sâu: ${this.formatBoolean(data.askedDeepQuestion)}\n3. Tư vấn đầy đủ: ${this.formatBoolean(data.fullConsultation)}\n4. Theo đến quyết: ${this.formatBoolean(data.followedThrough)}\n5. Ghi chú nhân viên: ${this.formatText(data.employeeNotes)}`;
    }

    if (formType === BehaviorFormType.FORM_3) {
      const data = await this.mindsetLogsRepository.findOne({
        where: { userId: user.id, logDate },
      });
      if (!data) {
        throw new BadRequestException('Chưa có dữ liệu Mẫu 3 để gửi Telegram');
      }
      return `${baseHeader}\nII. BIỂU MẪU\n1. Tên mẫu: Mẫu 3 - Thay đổi Tư duy\n\nIII. NỘI DUNG ĐÃ KHAI BÁO\n1. Suy nghĩ cũ: ${this.formatText(data.negativeThought)}\n2. Tư duy mới: ${this.formatText(data.newMindset)}\n3. Hành vi thay đổi: ${this.formatText(data.behaviorChange)}`;
    }

    if (formType === BehaviorFormType.FORM_4) {
      const rows = await this.salesActivityReportsRepository.find({
        where: { userId: user.id, logDate },
        order: { createdAt: 'ASC' },
      });
      if (!rows.length) {
        throw new BadRequestException('Chưa có dữ liệu Mẫu 4 để gửi Telegram');
      }
      const details = rows
        .map(
          (row, index) =>
            `Mục ${index + 1}\n1. Khách hàng: ${this.formatText(row.customerName)}\n2. Vấn đề khách hàng: ${this.formatText(row.customerIssue)}\n3. Hậu quả: ${this.formatText(row.consequence)}\n4. Giải pháp đề xuất: ${this.formatText(row.solutionOffered)}\n5. Giá trị/định giá: ${this.formatText(row.valueBasedPricing)}\n6. Kết quả: ${this.formatText(row.result)}`,
        )
        .join('\n\n');
      return `${baseHeader}\nII. BIỂU MẪU\n1. Tên mẫu: Mẫu 4 - Báo cáo Bán hàng\n2. Số dòng khai báo: ${rows.length}\n\nIII. NỘI DUNG ĐÃ KHAI BÁO\n${details}`;
    }

    if (formType === BehaviorFormType.FORM_5) {
      const data = await this.endOfDayLogsRepository.findOne({
        where: { userId: user.id, logDate },
      });
      if (!data) {
        throw new BadRequestException('Chưa có dữ liệu Mẫu 5 để gửi Telegram');
      }
      return `${baseHeader}\nII. BIỂU MẪU\n1. Tên mẫu: Mẫu 5 - Ghi chép cuối ngày\n\nIII. NỘI DUNG ĐÃ KHAI BÁO\n1. Việc sẽ làm khác đi: ${this.formatText(data.differentAction)}\n2. Tác động đến khách hàng: ${this.formatText(data.customerImpact)}\n3. Bài học cho ngày mai: ${this.formatText(data.tomorrowLesson)}`;
    }

    if (formType === BehaviorFormType.FORM_8) {
      const rows = await this.beliefTransformationLogsRepository.find({
        where: { userId: user.id, logDate },
        order: { createdAt: 'ASC' },
      });
      if (!rows.length) {
        throw new BadRequestException('Chưa có dữ liệu Mẫu 8 để gửi Telegram');
      }
      const details = rows
        .map(
          (row, index) =>
            `Mục ${index + 1}\n1. Tình huống: ${this.formatText(row.situation)}\n2. Niềm tin cũ: ${this.formatText(row.oldBelief)}\n3. Niềm tin chọn mới: ${this.formatText(row.newChosenBelief)}\n4. Hành vi mới: ${this.formatText(row.newBehavior)}\n5. Kết quả: ${this.formatText(row.result)}`,
        )
        .join('\n\n');
      return `${baseHeader}\nII. BIỂU MẪU\n1. Tên mẫu: Mẫu 8 - Củng cố niềm tin\n2. Số dòng khai báo: ${rows.length}\n\nIII. NỘI DUNG ĐÃ KHAI BÁO\n${details}`;
    }

    throw new BadRequestException('Form không hỗ trợ gửi Telegram');
  }

  @Post('share')
  async shareUrl(
    @Body()
    body: {
      formType: BehaviorFormType;
      formPart?: 'awareness' | 'standards';
      logDate?: string;
      detailUrl?: string;
    },
    @Req() req: any,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: req.user.id },
      relations: ['unit'],
    });

    if (!user || !user.unit || !user.unit.telegramGroupChatId) {
      return { success: false, message: 'Chưa cấu hình Telegram Bot cho đơn vị' };
    }

    if (!body.formType) {
      throw new BadRequestException('Thiếu formType');
    }

    const logDate = this.toDateKey(body.logDate) || this.toDateKey(new Date().toISOString());
    const journal = await this.journalsRepository.findOne({
      where: { userId: user.id, reportDate: logDate },
      order: { createdAt: 'DESC' },
    });
    const detailUrl =
      body.detailUrl ||
      `${process.env.FE_ORIGIN?.split(',')[0]?.trim()?.replace(/\/+$/g, '') || ''}/discipline/manager-review/${journal?.id || ''}`;
    const detailSuffix = detailUrl
      ? `\n\nQuản lý vui lòng xem và đánh giá tại:\n${detailUrl}`
      : '';
    const message = `${await this.buildFormMessage(
      user,
      body.formType,
      logDate,
      body.formPart,
    )}${detailSuffix}`;

    await this.telegramService.sendMessage(user.unit.telegramGroupChatId, message);
    return { success: true };
  }
}
