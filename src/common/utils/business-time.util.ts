import * as moment from 'moment-timezone';

export class BusinessTimeUtil {
  static CUTOFF_HOUR = 7;

  /**
   * Tính toán Ngày Nghiệp Vụ dựa trên mốc Cut-off 07:00 AM (Vietnam Time)
   */
  static getEffectiveBusinessDate(systemTime: Date | string | number = new Date()): { format: (fmt: string) => string, day: () => number, toDate: () => Date } {
    const isDateOnlyString = typeof systemTime === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(systemTime);

    let m = moment.tz(systemTime, 'Asia/Ho_Chi_Minh');

    if (!isDateOnlyString && m.hour() < this.CUTOFF_HOUR) {
      m = m.subtract(1, 'day');
    }
    
    // Đặt thời gian về 00:00:00 của ngày business
    m = m.startOf('day');

    return {
      format: (fmt: string) => {
        if (fmt === 'YYYY-MM-DD') return m.format('YYYY-MM-DD');
        return m.toISOString();
      },
      day: () => m.day(),
      toDate: () => m.toDate()
    };
  }

  /**
   * Kiểm tra xem Ngày Nghiệp Vụ có rơi vào Cuối tuần (Thứ 7, Chủ Nhật) hay không
   */
  static isWeekendLocked(systemTime: Date | string | number = new Date()): boolean {
    const businessDate = this.getEffectiveBusinessDate(systemTime);
    const dayOfWeek = businessDate.day(); 
    // 0: Chủ Nhật, 6: Thứ Bảy
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  /**
   * Kiểm tra xem có phải là Thứ Hai - Ngày được phép cộng dồn dữ liệu cuối tuần không
   */
  static isAccumulationDay(systemTime: Date | string | number = new Date()): boolean {
    const businessDate = this.getEffectiveBusinessDate(systemTime);
    return businessDate.day() === 1; // 1: Thứ Hai
  }
}
