import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
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
  @IsString()
  @IsIn(['text', 'number'])
  employeeInputType?: 'text' | 'number';

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
