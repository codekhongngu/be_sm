import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Role } from 'src/common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  fullName: string;

  @IsUUID()
  unitId: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  telegramChatId?: string;
}
