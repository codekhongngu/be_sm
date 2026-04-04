import { IsString, MinLength } from 'class-validator';

export class HighIncomeEformDto {
  @IsString()
  @MinLength(1)
  keptStandardsAnswer: string;

  @IsString()
  @MinLength(1)
  declineSignsAnswer: string;

  @IsString()
  @MinLength(1)
  handlingPlanAnswer: string;
}
