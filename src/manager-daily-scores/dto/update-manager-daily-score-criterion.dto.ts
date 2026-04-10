import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateManagerDailyScoreCriterionDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  sectionCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sectionName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sectionSortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  itemSortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sttLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  contentName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxScore?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
