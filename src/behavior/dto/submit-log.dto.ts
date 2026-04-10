import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BehaviorFormType {
  FORM_1 = 'FORM_1',
  FORM_2 = 'FORM_2',
  FORM_3 = 'FORM_3',
  FORM_4 = 'FORM_4',
  FORM_5 = 'FORM_5',
  FORM_8 = 'FORM_8',
}

export class SalesActivityItemDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerIssue?: string;

  @IsOptional()
  @IsString()
  consequence?: string;

  @IsOptional()
  @IsString()
  solutionOffered?: string;

  @IsOptional()
  @IsString()
  valueBasedPricing?: string;

  @IsOptional()
  @IsString()
  result?: string;
}

export class BeliefTransformationItemDto {
  @IsOptional()
  @IsString()
  situation?: string;

  @IsOptional()
  @IsString()
  oldBelief?: string;

  @IsOptional()
  @IsString()
  newChosenBelief?: string;

  @IsOptional()
  @IsString()
  newBehavior?: string;

  @IsOptional()
  @IsString()
  result?: string;
}

export class SubmitLogDto {
  @IsEnum(BehaviorFormType)
  formType: BehaviorFormType;

  @IsOptional()
  @IsDateString()
  logDate?: string;

  @IsOptional()
  @IsString()
  avoidance?: string;

  @IsOptional()
  @IsString()
  selfLimit?: string;

  @IsOptional()
  @IsString()
  earlyStop?: string;

  @IsOptional()
  @IsString()
  blaming?: string;

  @IsOptional()
  @IsBoolean()
  askedDeepQuestion?: boolean;

  @IsOptional()
  @IsBoolean()
  fullConsultation?: boolean;

  @IsOptional()
  @IsBoolean()
  followedThrough?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  customerMetCount?: number;

  @IsOptional()
  @IsString()
  employeeNotes?: string;

  @IsOptional()
  @IsString()
  negativeThought?: string;

  @IsOptional()
  @IsString()
  newMindset?: string;

  @IsOptional()
  @IsString()
  behaviorChange?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerIssue?: string;

  @IsOptional()
  @IsString()
  consequence?: string;

  @IsOptional()
  @IsString()
  solutionOffered?: string;

  @IsOptional()
  @IsString()
  valueBasedPricing?: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesActivityItemDto)
  salesActivities?: SalesActivityItemDto[];

  @IsOptional()
  @IsString()
  differentAction?: string;

  @IsOptional()
  @IsString()
  customerImpact?: string;

  @IsOptional()
  @IsString()
  tomorrowLesson?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeliefTransformationItemDto)
  beliefTransformations?: BeliefTransformationItemDto[];

  @IsOptional()
  @IsString()
  situation?: string;

  @IsOptional()
  @IsString()
  oldBelief?: string;

  @IsOptional()
  @IsString()
  newChosenBelief?: string;

  @IsOptional()
  @IsString()
  newBehavior?: string;

  @IsOptional()
  @IsString()
  transformationResult?: string;
}
