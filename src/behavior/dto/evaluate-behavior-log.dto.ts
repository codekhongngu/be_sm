import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class EvaluateBehaviorLogDto {
  @IsBoolean()
  mgrEvalDeepQ: boolean;

  @IsBoolean()
  mgrEvalFullCons: boolean;

  @IsBoolean()
  mgrEvalFollow: boolean;

  @IsOptional()
  @IsString()
  managerFeedback?: string;
}
