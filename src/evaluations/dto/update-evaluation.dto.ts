import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateEvaluationDto {
  @IsOptional()
  @IsBoolean()
  awarenessReviewed?: boolean;

  @IsOptional()
  @IsString()
  awarenessManagerNote?: string;

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
  @IsBoolean()
  deepInquiryStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  fullProposalStatus?: boolean;

  @IsOptional()
  @IsBoolean()
  persistenceStatus?: boolean;

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
  @IsString()
  standardsManagerNote?: string;
}
