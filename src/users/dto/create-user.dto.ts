import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsUUID()
  unitId: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @IsOptional()
  @IsBoolean()
  canManageCoaching?: boolean;
}
