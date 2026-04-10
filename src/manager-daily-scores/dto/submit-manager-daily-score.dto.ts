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
} from 'class-validator';

export class SubmitManagerDailyScoreItemDto {
  @IsUUID()
  criteriaId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  requirementNote: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score: number;
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
