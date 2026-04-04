import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CatalogsService } from './catalogs.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';

@Controller('catalogs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @Roles(Role.MANAGER, Role.ADMIN)
  getList() {
    return this.catalogsService.getList();
  }

  @Post()
  @Roles(Role.MANAGER, Role.ADMIN)
  create(@Body() createDto: CreateCatalogItemDto) {
    return this.catalogsService.create(createDto);
  }

  @Patch(':id')
  @Roles(Role.MANAGER, Role.ADMIN)
  update(@Param('id') id: string, @Body() updateDto: UpdateCatalogItemDto) {
    return this.catalogsService.update(id, updateDto);
  }

  @Patch(':id/deactivate')
  @Roles(Role.MANAGER, Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.catalogsService.deactivate(id);
  }
}
