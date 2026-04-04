import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { CatalogItem } from './entities/catalog-item.entity';

@Injectable()
export class CatalogsService {
  constructor(
    @InjectRepository(CatalogItem)
    private readonly catalogsRepository: Repository<CatalogItem>,
  ) {}

  getList() {
    return this.catalogsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async create(createDto: CreateCatalogItemDto) {
    const exists = await this.catalogsRepository.findOne({ code: createDto.code });
    if (exists) {
      throw new BadRequestException('Mã catalog đã tồn tại');
    }
    const catalogItem = this.catalogsRepository.create(createDto);
    return this.catalogsRepository.save(catalogItem);
  }

  async update(id: string, updateDto: UpdateCatalogItemDto) {
    const existing = await this.catalogsRepository.findOne(id);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy catalog');
    }

    if (updateDto.code && updateDto.code !== existing.code) {
      const duplicate = await this.catalogsRepository.findOne({ code: updateDto.code });
      if (duplicate) {
        throw new BadRequestException('Mã catalog đã tồn tại');
      }
    }

    Object.assign(existing, updateDto);
    return this.catalogsRepository.save(existing);
  }

  async deactivate(id: string) {
    const existing = await this.catalogsRepository.findOne(id);
    if (!existing) {
      throw new NotFoundException('Không tìm thấy catalog');
    }
    existing.isActive = false;
    return this.catalogsRepository.save(existing);
  }
}
