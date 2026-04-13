import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
  IsOptional,
} from 'class-validator';

export class SubmitManagerDailyScoreItemDto {
  @IsUUID()
  criteriaId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  requirementNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  employeeNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  selfScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score?: number;
}

export class SubmitManagerDailyScoreDto {
  @IsUUID()
  employeeId: string;

  @IsDateString()
  scoreDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitManagerDailyScoreItemDto)
  items: SubmitManagerDailyScoreItemDto[];
}
