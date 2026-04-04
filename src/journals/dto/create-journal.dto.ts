import {
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateJournalDto {
  @IsString()
  avoidance: string;

  @IsString()
  selfLimit: string;

  @IsString()
  earlyStop: string;

  @IsString()
  blaming: string;

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
