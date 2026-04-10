import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum WeeklyJournalFormType {
  FORM_10 = 'FORM_10',
  FORM_11 = 'FORM_11',
}

export class SubmitWeeklyJournalDto {
  @IsUUID()
  weekId: string;

  @IsEnum(WeeklyJournalFormType)
  formType: WeeklyJournalFormType;

  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  @Type(() => Object)
  entries: Record<string, any>[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  note?: string;
}
