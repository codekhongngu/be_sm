import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class Form4RowDto {
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerIssue?: string;
  @IsOptional() @IsString() consequence?: string;
  @IsOptional() @IsString() solutionOffered?: string;
  @IsOptional() @IsString() valueBasedPricing?: string;
  @IsOptional() @IsString() result?: string;
}

class Form8RowDto {
  @IsOptional() @IsString() situation?: string;
  @IsOptional() @IsString() oldBelief?: string;
  @IsOptional() @IsString() newChosenBelief?: string;
  @IsOptional() @IsString() newBehavior?: string;
  @IsOptional() @IsString() result?: string;
}

class StatusMapDto {
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) form1Awareness?: string;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) form1Standards?: string;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) form3?: string;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) form4?: string;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) form5?: string;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) form7?: string;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) form8?: string;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) form9?: string;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) form12?: string;
}

export class ReviewDailyFormsDto {
  @IsUUID()
  journalId: string;

  @IsOptional() @IsString() avoidance?: string;
  @IsOptional() @IsString() selfLimit?: string;
  @IsOptional() @IsString() earlyStop?: string;
  @IsOptional() @IsString() blaming?: string;
  @IsOptional() @IsString() standardsKeptText?: string;
  @IsOptional() @IsString() backslideSigns?: string;
  @IsOptional() @IsString() solution?: string;

  @IsOptional() @IsString() form3NegativeThought?: string;
  @IsOptional() @IsString() form3NewMindset?: string;
  @IsOptional() @IsString() form3BehaviorChange?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => Form4RowDto) form4Rows?: Form4RowDto[];
  @IsOptional() @IsString() form5TomorrowLesson?: string;
  @IsOptional() @IsString() form5DifferentAction?: string;
  @IsOptional() @IsString() form7KeptStandard?: string;
  @IsOptional() @IsString() form7BackslideSign?: string;
  @IsOptional() @IsString() form7Solution?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => Form8RowDto) form8Rows?: Form8RowDto[];
  @IsOptional() @IsString() form9SelfLimitArea?: string;
  @IsOptional() @IsString() form9ProofBehavior?: string;
  @IsOptional() @IsString() form9RaiseStandard?: string;
  @IsOptional() @IsString() form9ActionPlan?: string;
  @IsOptional() @IsString() form12DeclarationText?: string;
  @IsOptional() @IsString() form12CommitmentSignature?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StatusMapDto)
  statuses?: StatusMapDto;
}
