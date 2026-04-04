import { IsOptional, IsString, IsDateString } from 'class-validator';

export class SubmitAwarenessDto {
  @IsString()
  avoidance: string;

  @IsString()
  selfLimit: string;

  @IsString()
  earlyStop: string;

  @IsString()
  blaming: string;

  @IsOptional()
  @IsDateString()
  reportDate?: string;
}
