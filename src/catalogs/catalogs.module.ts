import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { CatalogItem } from './entities/catalog-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CatalogItem])],
  controllers: [CatalogsController],
  providers: [CatalogsService, RolesGuard],
  exports: [CatalogsService, TypeOrmModule],
})
export class CatalogsModule {}
