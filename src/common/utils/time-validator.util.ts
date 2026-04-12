import { BadRequestException } from '@nestjs/common';

export function validateActionTimeForDate(targetDateStr: string | Date, actionName: string = 'Thao tác') {
  const now = new Date();
  
  const targetDate = new Date(targetDateStr);
  targetDate.setHours(0, 0, 0, 0);

  const startAllowed = new Date(targetDate);
  
  const endAllowed = new Date(targetDate);
  endAllowed.setDate(endAllowed.getDate() + 1);
  endAllowed.setHours(7, 0, 0, 0);

  if (now.getTime() < startAllowed.getTime() || now.getTime() > endAllowed.getTime()) {
    throw new BadRequestException(
      `${actionName} chỉ được thực hiện cho ngày hiện tại. Hạn chót là 07:00 AM ngày hôm sau.`
    );
  }
}
