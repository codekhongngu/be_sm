import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CatalogsService } from './catalogs.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';

@Controller(['catalogs', 'api/catalogs'])
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  getList(@Query('category') category?: string) {
    return this.catalogsService.getList(category);
  }

  @Get('wards/import-template')
  @Roles(Role.ADMIN)
  getWardImportTemplate(@Res() res: Response) {
    const file = this.catalogsService.getWardImportTemplateFile();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return res.send(file.buffer);
  }

  @Post('wards/import-excel')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  importWardsExcel(@UploadedFile() file: any) {
    return this.catalogsService.importWardsFromExcel(file);
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
