import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { CatalogItem } from './entities/catalog-item.entity';
import * as XLSX from 'xlsx';

@Injectable()
export class CatalogsService {
  constructor(
    @InjectRepository(CatalogItem)
    private readonly catalogsRepository: Repository<CatalogItem>,
  ) {}

  getList(category?: string) {
    const normalizedCategory = String(category || '').trim().toUpperCase();
    if (normalizedCategory) {
      return this.catalogsRepository.find({
        where: { category: normalizedCategory },
        order: { createdAt: 'DESC' },
      });
    }
    return this.catalogsRepository.find({ order: { createdAt: 'DESC' } });
  }

  private normalizeWardCode(code: string, name: string) {
    const raw = String(code || '').trim();
    if (raw) {
      return raw.toUpperCase();
    }
    const base = `${name}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .toUpperCase();
    return `WARD-${base || 'UNKNOWN'}`;
  }

  private parseActiveValue(value: any) {
    const normalized = String(value ?? '1').trim().toLowerCase();
    if (!normalized) return true;
    return !['0', 'false', 'no', 'n', 'khong', 'inactive'].includes(normalized);
  }

  async create(createDto: CreateCatalogItemDto) {
    const category = String(createDto.category || 'GENERAL').trim().toUpperCase();
    const code = String(createDto.code || '').trim().toUpperCase();
    const exists = await this.catalogsRepository.findOne({ where: { code } });
    if (exists) {
      throw new BadRequestException('Mã catalog đã tồn tại');
    }
    const catalogItem = this.catalogsRepository.create({
      ...createDto,
      code,
      name: String(createDto.name || '').trim(),
      description: createDto.description ? String(createDto.description).trim() : '',
      category,
    });
    return this.catalogsRepository.save(catalogItem);
  }

  async importWardsFromExcel(file: any) {
    if (!file?.buffer) {
      throw new BadRequestException('Vui lòng tải lên file Excel');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('File Excel không có dữ liệu');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('File Excel trống');
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const code = String(
        row['Mã phường/xã'] || row['Ma phuong/xa'] || row['Mã'] || row['Ma'] || '',
      ).trim();
      const name = String(
        row['Tên phường/xã'] || row['Ten phuong/xa'] || row['Tên'] || row['Ten'] || '',
      ).trim();
      const note = String(row['Ghi chú'] || row['Ghi chu'] || '').trim();

      if (!name) {
        skipped += 1;
        continue;
      }

      const normalizedCode = this.normalizeWardCode(code, name);
      const description = note;
      const isActive = this.parseActiveValue(row['Kích hoạt'] || row['Kich hoat']);

      const existing = await this.catalogsRepository.findOne({ where: { code: normalizedCode } });
      if (existing) {
        existing.name = name;
        existing.description = description;
        existing.price = 0;
        existing.category = 'WARD';
        existing.isActive = isActive;
        await this.catalogsRepository.save(existing);
        updated += 1;
      } else {
        await this.catalogsRepository.save(
          this.catalogsRepository.create({
            code: normalizedCode,
            name,
            description,
            price: 0,
            category: 'WARD',
            isActive,
          }),
        );
        created += 1;
      }
    }

    return {
      total: rows.length,
      created,
      updated,
      skipped,
      message: 'Import danh mục phường/xã thành công',
    };
  }

  getWardImportTemplateFile() {
    const templateRows = [
      {
        'Mã phường/xã': 'WARD-P1',
        'Tên phường/xã': 'Phường 1',
        'Ghi chú': 'Khu vực trung tâm',
        'Kích hoạt': 1,
      },
    ];

    const guideRows = [
      {
        'Cột': 'Mã phường/xã',
        'Mô tả': 'Tùy chọn. Để trống hệ thống tự sinh mã.',
      },
      {
        'Cột': 'Tên phường/xã',
        'Mô tả': 'Bắt buộc.',
      },
      {
        'Cột': 'Ghi chú',
        'Mô tả': 'Tùy chọn.',
      },
      {
        'Cột': 'Kích hoạt',
        'Mô tả': '1 hoặc 0. Để trống mặc định là 1.',
      },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(templateRows), 'WardTemplate');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(guideRows), 'HuongDan');

    return {
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
      fileName: 'mau-import-danh-muc-phuong-xa.xlsx',
    };
  }

  async update(id: string, updateDto: UpdateCatalogItemDto) {
    const existing = await this.catalogsRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy catalog');
    }

    const nextCode = updateDto.code ? String(updateDto.code).trim().toUpperCase() : undefined;
    if (nextCode && nextCode !== existing.code) {
      const duplicate = await this.catalogsRepository.findOne({ where: { code: nextCode } });
      if (duplicate) {
        throw new BadRequestException('Mã catalog đã tồn tại');
      }
    }

    Object.assign(existing, updateDto);
    if (nextCode) {
      existing.code = nextCode;
    }
    if (updateDto.category !== undefined) {
      existing.category = String(updateDto.category || 'GENERAL').trim().toUpperCase();
    }
    return this.catalogsRepository.save(existing);
  }

  async deactivate(id: string) {
    const existing = await this.catalogsRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy catalog');
    }
    existing.isActive = false;
    return this.catalogsRepository.save(existing);
  }
}
