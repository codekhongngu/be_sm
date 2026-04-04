import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateEvaluationDto {
  @IsUUID()
  journalId: string;

  @IsBoolean()
  deepInquiryStatus: boolean;

  @IsBoolean()
  fullProposalStatus: boolean;

  @IsBoolean()
  persistenceStatus: boolean;

  @IsOptional()
  @IsString()
  deepInquiryNote?: string;

  @IsOptional()
  @IsString()
  fullProposalNote?: string;

  @IsOptional()
  @IsString()
  persistenceNote?: string;

  @IsOptional()
  @IsBoolean()
  awarenessReviewed?: boolean;

  @IsOptional()
  @IsBoolean()
  awarenessDeepInquiryStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  awarenessFullProposalStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  awarenessPersistenceStatus?: boolean;

  @IsOptional()
  @IsString()
  awarenessDeepInquiryNote?: string;

  @IsOptional()
  @IsString()
  awarenessFullProposalNote?: string;

  @IsOptional()
  @IsString()
  awarenessPersistenceNote?: string;

  @IsOptional()
  @IsBoolean()
  standardsReviewed?: boolean;

  @IsOptional()
  @IsString()
  awarenessManagerNote?: string;

  @IsOptional()
  @IsString()
  standardsManagerNote?: string;
}
