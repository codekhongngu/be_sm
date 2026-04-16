import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class SaveWeeklyReportDto {
  @IsUUID()
  weekId: string;

  @IsUUID()
  userId: string;

  @IsNumber()
  @IsOptional()
  customerMetCount?: number;

  @IsNumber()
  @IsOptional()
  deepInquiryRate?: number;

  @IsNumber()
  @IsOptional()
  fullConsultationRate?: number;

  @IsNumber()
  @IsOptional()
  followedThroughRate?: number;

  @IsString()
  @IsOptional()
  managerFeedback?: string;
}
