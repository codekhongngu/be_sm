import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SaveDailyCoachingCustomerDto {
  @IsOptional()
  @IsString()
  coachingForm?: string;

  @IsOptional()
  @IsDateString()
  logDate?: string;

  @IsInt()
  @Min(0)
  @Max(1)
  salesPlan: number;

  @IsString()
  customerName: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  customerAddress?: string;

  @IsInt()
  @Min(0)
  @Max(1)
  oldReferral: number;

  @IsInt()
  @Min(0)
  @Max(1)
  customerFollowUp: number;

  @IsInt()
  @Min(0)
  @Max(1)
  noEarlyQuote: number;

  @IsInt()
  @Min(0)
  @Max(1)
  consultStandard: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  consultEnoughLayers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  consultSolutionMatchingNeed?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  consultClearBenefit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  consultMentionLossAvoidance?: number;

  @IsInt()
  @Min(0)
  @Max(1)
  closedService: number;

  @IsOptional()
  @IsString()
  personalRevenue?: string;

  @IsInt()
  @Min(0)
  @Max(1)
  nextFollowRequired: number;

  @IsOptional()
  @IsString()
  nextFollowStep?: string;

  @IsOptional()
  @IsDateString()
  nextFollowSchedule?: string;
}
