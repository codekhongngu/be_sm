import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpdateManagerCoachingLogDto {
  @IsOptional()
  @IsUUID()
  coachedUserId?: string;

  @IsOptional()
  @IsDateString()
  coachingTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  coachingContent?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contentToImprove?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  keepTnc?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  evaluationResult?: number;
}
