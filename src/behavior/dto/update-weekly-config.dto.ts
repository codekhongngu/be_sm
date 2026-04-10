import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateWeeklyConfigDto {
  @IsOptional()
  @IsString()
  weekName?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
