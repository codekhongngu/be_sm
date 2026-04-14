export class BusinessTimeUtil {
  static CUTOFF_HOUR = 7;

  /**
   * Tính toán Ngày Nghiệp Vụ dựa trên mốc Cut-off 07:00 AM
   */
  static getEffectiveBusinessDate(systemTime: Date | string | number = new Date()): { format: (fmt: string) => string, day: () => number, toDate: () => Date } {
    const time = new Date(systemTime);
    
    // Nếu tham số truyền vào là dạng YYYY-MM-DD (VD: '2026-04-14'), ta coi như đó chính là business date cần xử lý,
    // Không áp dụng time-shifting vì string này thường chỉ có YYYY-MM-DD mà không có giờ cụ thể.
    const isDateOnlyString = typeof systemTime === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(systemTime);

    if (!isDateOnlyString && time.getHours() < this.CUTOFF_HOUR) {
      time.setDate(time.getDate() - 1);
    }
    time.setHours(0, 0, 0, 0);
    
    return {
      format: (fmt: string) => {
        // Simple YYYY-MM-DD formatter
        const y = time.getFullYear();
        const m = String(time.getMonth() + 1).padStart(2, '0');
        const d = String(time.getDate()).padStart(2, '0');
        if (fmt === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
        return time.toISOString();
      },
      day: () => time.getDay(),
      toDate: () => time
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
