import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/common/enums/role.enum';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserUnitDto } from './dto/update-user-unit.dto';
import { UsersService } from './users.service';
import * as XLSX from 'xlsx';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.MANAGER, Role.ADMIN)
  async getList(@Req() req: any) {
    const users = await this.usersService.getList();
    if (req.user.role === Role.ADMIN) {
      return users;
    }
    return users.filter((user) => user.unitId === req.user.unitId);
  }

  @Post()
  @Roles(Role.ADMIN)
  async createUser(@Body() dto: CreateUserDto) {
    const existing = await this.usersService.findByUsername(dto.username.trim());
    if (existing) {
      throw new BadRequestException('Username đã tồn tại');
    }
    const unit = await this.usersService.findUnitById(dto.unitId);
    if (!unit) {
      throw new BadRequestException('Không tìm thấy đơn vị');
    }
    if (!unit.isActive) {
      throw new BadRequestException('Đơn vị đang ngừng hoạt động');
    }
    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      username: dto.username.trim(),
      password,
      fullName: dto.fullName.trim(),
      unitId: dto.unitId,
      role: dto.role,
      telegramChatId: dto.telegramChatId?.trim() || undefined,
    });
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      unitId: user.unitId,
    };
  }

  @Patch(':id')
  @Roles(Role.MANAGER, Role.ADMIN)
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    const targetUser = await this.usersService.findById(id);
    if (!targetUser) {
      throw new BadRequestException('Không tìm thấy nhân viên');
    }

    if (req.user.role === Role.MANAGER) {
      if (targetUser.unitId !== req.user.unitId) {
        throw new ForbiddenException('Chỉ cấu hình nhân viên trong cùng đơn vị');
      }
      if (dto.role === Role.ADMIN) {
        throw new ForbiddenException('Quản lý không được gán quyền ADMIN');
      }
      if (dto.unitId && dto.unitId !== req.user.unitId) {
        throw new ForbiddenException('Manager không được chuyển nhân viên sang đơn vị khác');
      }
    }

    if (dto.username && dto.username.trim() !== targetUser.username) {
      const existing = await this.usersService.findByUsername(dto.username.trim());
      if (existing) {
        throw new BadRequestException('Username đã tồn tại');
      }
      targetUser.username = dto.username.trim();
    }

    if (dto.unitId) {
      const unit = await this.usersService.findUnitById(dto.unitId);
      if (!unit) {
        throw new BadRequestException('Không tìm thấy đơn vị');
      }
      if (!unit.isActive) {
        throw new BadRequestException('Đơn vị đang ngừng hoạt động');
      }
      targetUser.unitId = dto.unitId;
    }

    if (dto.fullName) {
      targetUser.fullName = dto.fullName.trim();
    }
    if (dto.role) {
      targetUser.role = dto.role;
    }
    if (dto.telegramChatId !== undefined) {
      targetUser.telegramChatId = dto.telegramChatId?.trim() || undefined;
    }

    const updated = await this.usersService.save(targetUser);
    return {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role,
      unitId: updated.unitId,
      telegramChatId: updated.telegramChatId,
    };
  }

  @Put(':id')
  @Roles(Role.MANAGER, Role.ADMIN)
  async replaceUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.updateUser(id, dto, req);
  }

  @Patch(':id/reset-password')
  @Roles(Role.MANAGER, Role.ADMIN)
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
    @Req() req: any,
  ) {
    const targetUser = await this.usersService.findById(id);
    if (!targetUser) {
      throw new BadRequestException('Không tìm thấy nhân viên');
    }
    if (req.user.role === Role.MANAGER && targetUser.unitId !== req.user.unitId) {
      throw new ForbiddenException('Chỉ reset mật khẩu nhân viên trong cùng đơn vị');
    }
    const password = await bcrypt.hash(dto.newPassword, 10);
    targetUser.password = password;
    await this.usersService.save(targetUser);
    return { success: true };
  }

  @Patch('me/change-password')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  async changeMyPassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const user = await this.usersService.findById(req.user.sub || req.user.id);
    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản');
    }
    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    const sameAsCurrent = await bcrypt.compare(dto.newPassword, user.password);
    if (sameAsCurrent) {
      throw new BadRequestException('Mật khẩu mới không được trùng mật khẩu hiện tại');
    }
    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.save(user);
    return { success: true };
  }

  @Get('units')
  @Roles(Role.MANAGER, Role.ADMIN)
  async getUnits(@Req() req: any) {
    const units = await this.usersService.getUnits();
    if (req.user.role === Role.ADMIN) {
      return units;
    }
    return units.filter((unit) => unit.id === req.user.unitId);
  }

  @Post('units')
  @Roles(Role.ADMIN)
  async createUnit(@Body() dto: CreateUnitDto) {
    const existed = await this.usersService.findUnitByCode(dto.code);
    if (existed) {
      throw new BadRequestException('Mã đơn vị đã tồn tại');
    }
    if (dto.parentUnitId) {
      const parentUnit = await this.usersService.findUnitById(dto.parentUnitId);
      if (!parentUnit) {
        throw new BadRequestException('Không tìm thấy đơn vị cha');
      }
    }
    return this.usersService.createUnit(dto);
  }

  @Patch('units/:id')
  @Roles(Role.ADMIN)
  async updateUnit(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    const targetUnit = await this.usersService.findUnitById(id);
    if (!targetUnit) {
      throw new BadRequestException('Không tìm thấy đơn vị');
    }
    if (dto.code && dto.code !== targetUnit.code) {
      const duplicate = await this.usersService.findUnitByCode(dto.code);
      if (duplicate) {
        throw new BadRequestException('Mã đơn vị đã tồn tại');
      }
    }
    if (dto.parentUnitId) {
      if (dto.parentUnitId === id) {
        throw new BadRequestException('Đơn vị cha không được trùng chính nó');
      }
      const parentUnit = await this.usersService.findUnitById(dto.parentUnitId);
      if (!parentUnit) {
        throw new BadRequestException('Không tìm thấy đơn vị cha');
      }
    }
    Object.assign(targetUnit, dto);
    return this.usersService.saveUnit(targetUnit);
  }

  @Delete('units/:id')
  @Roles(Role.ADMIN)
  async deleteUnit(@Param('id') id: string) {
    const targetUnit = await this.usersService.findUnitById(id);
    if (!targetUnit) {
      throw new BadRequestException('Không tìm thấy đơn vị');
    }
    const childCount = await this.usersService.countChildUnits(id);
    if (childCount > 0) {
      throw new BadRequestException('Đơn vị đang có đơn vị con, không thể xóa');
    }
    const userCount = await this.usersService.countUsersByUnitId(id);
    if (userCount > 0) {
      throw new BadRequestException('Đơn vị đang có nhân viên, không thể xóa');
    }
    await this.usersService.removeUnit(targetUnit);
    return { success: true };
  }

  @Patch(':id/role')
  @Roles(Role.MANAGER, Role.ADMIN)
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: any,
  ) {
    const targetUser = await this.usersService.findById(id);
    if (!targetUser) {
      throw new BadRequestException('Không tìm thấy nhân viên');
    }

    if (req.user.role === Role.MANAGER) {
      if (targetUser.unitId !== req.user.unitId) {
        throw new ForbiddenException('Chỉ cấu hình quyền trong cùng đơn vị');
      }
      if (dto.role === Role.ADMIN) {
        throw new ForbiddenException('Quản lý không được gán quyền ADMIN');
      }
    }

    targetUser.role = dto.role;
    return this.usersService.save(targetUser);
  }

  @Patch(':id/unit')
  @Roles(Role.MANAGER, Role.ADMIN)
  async updateUnitForUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserUnitDto,
    @Req() req: any,
  ) {
    const targetUser = await this.usersService.findById(id);
    if (!targetUser) {
      throw new BadRequestException('Không tìm thấy nhân viên');
    }

    const nextUnit = await this.usersService.findUnitById(dto.unitId);
    if (!nextUnit) {
      throw new BadRequestException('Không tìm thấy đơn vị');
    }
    if (!nextUnit.isActive) {
      throw new BadRequestException('Đơn vị đang ngừng hoạt động');
    }

    if (req.user.role === Role.MANAGER) {
      if (targetUser.unitId !== req.user.unitId) {
        throw new ForbiddenException('Chỉ cấu hình nhân viên trong cùng đơn vị');
      }
      if (dto.unitId !== req.user.unitId) {
        throw new ForbiddenException('Manager không được chuyển nhân viên sang đơn vị khác');
      }
    }

    targetUser.unitId = dto.unitId;
    return this.usersService.save(targetUser);
  }

  @Post('import-excel')
  @Roles(Role.MANAGER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Thiếu file Excel');
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) as any[];

    if (!rows.length) {
      throw new BadRequestException('File Excel không có dữ liệu');
    }

    const created = [];
    const skipped = [];

    for (const row of rows) {
      const username = String(row.username || '').trim();
      const passwordRaw = String(row.password || '').trim();
      const fullName = String(row.fullName || '').trim();
      const unitCode = String(row.unitCode || '').trim();
      const roleRaw = String(row.role || '').trim().toUpperCase();
      const telegramChatId = String(row.telegramChatId || '').trim();

      if (!username || !passwordRaw || !fullName) {
        skipped.push({ username, reason: 'Thiếu dữ liệu bắt buộc' });
        continue;
      }

      const existing = await this.usersService.findByUsername(username);
      if (existing) {
        skipped.push({ username, reason: 'Username đã tồn tại' });
        continue;
      }

      const unit =
        req.user.role === Role.ADMIN
          ? await this.usersService.findUnitByCode(unitCode)
          : await this.usersService.findUnitById(req.user.unitId);

      if (!unit) {
        skipped.push({ username, reason: 'Không tìm thấy đơn vị' });
        continue;
      }

      const selectedRole = (roleRaw || Role.EMPLOYEE) as Role;
      if (!Object.values(Role).includes(selectedRole)) {
        skipped.push({ username, reason: 'Role không hợp lệ' });
        continue;
      }

      if (req.user.role === Role.MANAGER && selectedRole === Role.ADMIN) {
        skipped.push({ username, reason: 'Manager không được import ADMIN' });
        continue;
      }

      const password = await bcrypt.hash(passwordRaw, 10);
      const user = await this.usersService.create({
        username,
        password,
        fullName,
        unitId: unit.id,
        role: selectedRole,
        telegramChatId: telegramChatId || undefined,
      });
      created.push({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
      });
    }

    return {
      totalRows: rows.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    };
  }
}
