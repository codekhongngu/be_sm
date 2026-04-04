import { IsUUID } from 'class-validator';

export class UpdateUserUnitDto {
  @IsUUID()
  unitId: string;
}
