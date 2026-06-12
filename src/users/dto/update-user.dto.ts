import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @IsOptional()
  @IsBoolean()
  canManageCoaching?: boolean;
}
