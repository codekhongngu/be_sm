import { BadRequestException } from '@nestjs/common';
import { BusinessTimeUtil } from './business-time.util';

export function validateActionTimeForDate(targetDateStr: string | Date, actionName: string = 'Thao tác', bypassWeekendLock: boolean = false) {
  const now = new Date();
  
  if (!bypassWeekendLock && BusinessTimeUtil.isWeekendLocked(now)) {
    throw new BadRequestException(
      'Hệ thống đã khóa thao tác cuối tuần. Vui lòng cộng dồn dữ liệu phát sinh vào tờ khai của ngày Thứ Hai kế tiếp.'
    );
  }

  const effectiveBusinessDate = BusinessTimeUtil.getEffectiveBusinessDate(now).format('YYYY-MM-DD');
  const targetBusinessDate = BusinessTimeUtil.getEffectiveBusinessDate(targetDateStr).format('YYYY-MM-DD');

  if (effectiveBusinessDate !== targetBusinessDate) {
    throw new BadRequestException(
      `${actionName} chỉ được thực hiện cho ngày hiện tại (mốc cắt ngày là ${String(BusinessTimeUtil.CUTOFF_HOUR).padStart(2, '0')}:00).`
    );
  }
}
