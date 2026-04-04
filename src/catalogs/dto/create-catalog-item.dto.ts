import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCatalogItemDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
