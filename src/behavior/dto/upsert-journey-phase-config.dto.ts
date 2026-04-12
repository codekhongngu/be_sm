import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpsertJourneyPhaseConfigDto {
  @IsString()
  @IsNotEmpty()
  phaseCode: string;

  @IsString()
  @IsNotEmpty()
  phaseName: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  sortOrder: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedForms?: string[];
}
