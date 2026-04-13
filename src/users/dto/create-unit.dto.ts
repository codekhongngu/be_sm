import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  telegramGroupChatId?: string;

  @IsOptional()
  @IsUUID()
  parentUnitId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  excludeFromStatistics?: boolean;
}
