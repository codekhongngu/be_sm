import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateManagerCoachingLogDto {
  @IsUUID()
  coachedUserId: string;

  @IsDateString()
  coachingTime: string;

  @IsString()
  @IsNotEmpty()
  coachingContent: string;

  @IsString()
  @IsNotEmpty()
  contentToImprove: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  keepTnc: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  evaluationResult: number;
}
