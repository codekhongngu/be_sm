import { IsDateString, IsOptional, IsString } from 'class-validator';

export class SubmitStandardsDto {
  @IsString()
  standardsKeptText: string;

  @IsString()
  backslideSigns: string;

  @IsString()
  solution: string;

  @IsOptional()
  @IsDateString()
  reportDate?: string;
}
