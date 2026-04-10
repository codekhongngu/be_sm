import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateWeeklyConfigDto {
  @IsString()
  @IsNotEmpty()
  weekName: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
