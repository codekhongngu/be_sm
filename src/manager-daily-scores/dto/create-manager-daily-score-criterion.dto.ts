import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateManagerDailyScoreCriterionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  sectionCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sectionName: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sectionSortOrder: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  itemCode: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  itemSortOrder: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  sttLabel: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  contentName: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'number'])
  employeeInputType?: 'text' | 'number';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxScore: number;

  @Type(() => Boolean)
  @IsBoolean()
  isActive: boolean;
}
