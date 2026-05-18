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
  Res,
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
import { Response } from 'express';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('login-logs')
  @Roles(Role.ADMIN)
  async getLoginLogs() {
    return this.usersService.getLoginLogs(500); // Lấy 500 logs gần nhất
  }

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
      employeeCode: dto.employeeCode?.trim() || undefined,
      unitId: dto.unitId,
      role: dto.role,
      telegramChatId: dto.telegramChatId?.trim() || undefined,
    });
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      employeeCode: user.employeeCode,
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
    if (dto.employeeCode !== undefined) {
      targetUser.employeeCode = dto.employeeCode?.trim() || undefined;
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
      employeeCode: updated.employeeCode,
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
  @Roles(Role.MANAGER, Role.ADMIN, Role.PROVINCIAL_VIEWER)
  async getUnits(@Req() req: any) {
    const units = await this.usersService.getUnits();
    if (req.user.role === Role.ADMIN || req.user.role === Role.PROVINCIAL_VIEWER) {
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
      const username = String(row.username ?? row.userName ?? row.taiKhoan ?? '').trim();
      const passwordRaw = String(row.password ?? row.matKhau ?? '').trim();
      const fullName = String(row.fullName ?? row.hoTen ?? row.name ?? '').trim();
      const unitCode = String(row.unitCode ?? row.maDonVi ?? row.unit ?? '').trim();
      const unitName = String(row.unitName ?? row.tenDonVi ?? '').trim();
      const unitId = String(row.unitId ?? row.donViId ?? '').trim();
      const roleRaw = String(row.role ?? row.vaiTro ?? '').trim().toUpperCase();
      const telegramChatId = String(row.telegramChatId ?? row.telegram ?? '').trim();
      const employeeCode = String(row.employeeCode ?? row.maNhanVien ?? row.maNV ?? '').trim();

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
          ? await (async () => {
              if (unitId) {
                const byId = await this.usersService.findUnitById(unitId);
                if (byId) {
                  return byId;
                }
              }
              if (unitCode) {
                const byCode =
                  (await this.usersService.findUnitByCode(unitCode)) ||
                  (await this.usersService.findUnitByCodeIgnoreCase(unitCode));
                if (byCode) {
                  return byCode;
                }
              }
              if (unitName) {
                const byName = await this.usersService.findUnitByNameIgnoreCase(unitName);
                if (byName) {
                  return byName;
                }
              }
              return null;
            })()
          : await this.usersService.findUnitById(req.user.unitId);

      if (!unit) {
        skipped.push({
          username,
          reason: `Không tìm thấy đơn vị (unitCode: ${unitCode || '-'}, unitName: ${unitName || '-'})`,
        });
        continue;
      }
      if (!unit.isActive) {
        skipped.push({ username, reason: `Đơn vị ${unit.code} đang ngừng hoạt động` });
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
        employeeCode: employeeCode || undefined,
        unitId: unit.id,
        role: selectedRole,
        telegramChatId: telegramChatId || undefined,
      });
      created.push({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        employeeCode: user.employeeCode,
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

  @Post('import-employee-codes')
  @Roles(Role.MANAGER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async importEmployeeCodes(@UploadedFile() file: any, @Req() req: any) {
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

    const updated = [];
    const skipped = [];

    for (const row of rows) {
      const username = String(row.username ?? row.userName ?? row.taiKhoan ?? '').trim();
      const fullName = String(row.fullName ?? row.hoTen ?? row.name ?? '').trim();
      const unitCode = String(row.unitCode ?? row.maDonVi ?? row.unit ?? '').trim();
      const unitName = String(row.unitName ?? row.tenDonVi ?? '').trim();
      const employeeCode = String(row.employeeCode ?? row.maNhanVien ?? row.maNV ?? '').trim();

      if (!employeeCode) {
        skipped.push({ username, fullName, reason: 'Thiếu mã nhân viên' });
        continue;
      }

      let targetUser = username
        ? await this.usersService.findByUsername(username)
        : null;

      if (!targetUser && username) {
        targetUser = await this.usersService.findByUsernameIgnoreCase(username);
      }

      if (!targetUser && fullName) {
        const unit =
          req.user.role === Role.ADMIN
            ? await (async () => {
                if (unitCode) {
                  const byCode =
                    (await this.usersService.findUnitByCode(unitCode)) ||
                    (await this.usersService.findUnitByCodeIgnoreCase(unitCode));
                  if (byCode) {
                    return byCode;
                  }
                }
                if (unitName) {
                  return this.usersService.findUnitByNameIgnoreCase(unitName);
                }
                return null;
              })()
            : await this.usersService.findUnitById(req.user.unitId);

        if (!unit) {
          skipped.push({
            username,
            fullName,
            employeeCode,
            reason: 'Không tìm thấy đơn vị để đối chiếu',
          });
          continue;
        }

        const matchedUsers = await this.usersService.findByFullNameAndUnitId(fullName, unit.id);
        if (matchedUsers.length === 1) {
          targetUser = matchedUsers[0];
        } else if (matchedUsers.length > 1) {
          skipped.push({
            username,
            fullName,
            employeeCode,
            reason: 'Trùng nhiều tài khoản theo họ tên và đơn vị',
          });
          continue;
        }
      }

      if (!targetUser) {
        skipped.push({
          username,
          fullName,
          employeeCode,
          reason: 'Không tìm thấy tài khoản để ánh xạ',
        });
        continue;
      }

      if (req.user.role === Role.MANAGER && targetUser.unitId !== req.user.unitId) {
        skipped.push({
          username,
          fullName,
          employeeCode,
          reason: 'Không thuộc đơn vị quản lý hiện tại',
        });
        continue;
      }

      targetUser.employeeCode = employeeCode;
      await this.usersService.save(targetUser);
      updated.push({
        id: targetUser.id,
        username: targetUser.username,
        fullName: targetUser.fullName,
        employeeCode: targetUser.employeeCode,
      });
    }

    return {
      totalRows: rows.length,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      updated,
      skipped,
      mappingRule:
        'Ưu tiên khớp username; nếu không có thì khớp fullName + đơn vị khi duy nhất',
    };
  }

  @Get('import-excel-template')
  @Roles(Role.MANAGER, Role.ADMIN)
  async downloadImportTemplate(@Req() req: any, @Res() res: Response) {
    const units = await this.usersService.getUnits();
    const availableUnits =
      req.user.role === Role.ADMIN
        ? units.filter((unit) => unit.isActive)
        : units.filter((unit) => unit.id === req.user.unitId && unit.isActive);

    const sampleUnit = availableUnits[0];
    const sampleUnitCode = sampleUnit?.code || '';
    const sampleUnitName = sampleUnit?.name || '';

    const templateRows = [
      {
        username: 'nv001',
        password: '123456',
        fullName: 'Nguyễn Văn A',
        employeeCode: 'NV001',
        unitCode: sampleUnitCode,
        unitName: sampleUnitName,
        role: 'EMPLOYEE',
        telegramChatId: '',
      },
      {
        username: 'nv002',
        password: '123456',
        fullName: 'Trần Thị B',
        employeeCode: 'NV002',
        unitCode: sampleUnitCode,
        unitName: sampleUnitName,
        role: 'EMPLOYEE',
        telegramChatId: '',
      },
      {
        username: 'ql001',
        password: '123456',
        fullName: 'Lê Văn C',
        employeeCode: 'QL001',
        unitCode: sampleUnitCode,
        unitName: sampleUnitName,
        role: req.user.role === Role.MANAGER ? 'EMPLOYEE' : 'MANAGER',
        telegramChatId: '',
      },
    ];

    const unitRows = availableUnits.map((unit) => ({
      unitId: unit.id,
      unitCode: unit.code,
      unitName: unit.name,
      isActive: unit.isActive ? 'TRUE' : 'FALSE',
    }));

    const guideRows = [
      {
        field: 'username',
        required: 'YES',
        description: 'Tên đăng nhập duy nhất',
      },
      {
        field: 'password',
        required: 'YES',
        description: 'Mật khẩu ban đầu',
      },
      {
        field: 'fullName',
        required: 'YES',
        description: 'Họ tên người dùng',
      },
      {
        field: 'employeeCode',
        required: 'OPTIONAL',
        description: 'Mã nhân viên để ánh xạ với danh sách ngoài hệ thống',
      },
      {
        field: 'unitCode',
        required: req.user.role === Role.ADMIN ? 'YES' : 'OPTIONAL',
        description: 'Mã đơn vị. ADMIN import theo đơn vị trong file',
      },
      {
        field: 'unitName',
        required: 'OPTIONAL',
        description: 'Tên đơn vị để fallback khi thiếu unitCode',
      },
      {
        field: 'role',
        required: 'OPTIONAL',
        description: 'EMPLOYEE | MANAGER | ADMIN',
      },
      {
        field: 'telegramChatId',
        required: 'OPTIONAL',
        description: 'Chat ID Telegram của user',
      },
    ];

    const workbook = XLSX.utils.book_new();
    const templateSheet = XLSX.utils.json_to_sheet(templateRows);
    const unitSheet = XLSX.utils.json_to_sheet(unitRows);
    const guideSheet = XLSX.utils.json_to_sheet(guideRows);
    const employeeCodeMappingRows = [
      {
        username: 'nv001',
        fullName: 'Nguyễn Văn A',
        employeeCode: 'NV001',
        unitCode: sampleUnitCode,
        unitName: sampleUnitName,
      },
      {
        username: 'nv002',
        fullName: 'Trần Thị B',
        employeeCode: 'NV002',
        unitCode: sampleUnitCode,
        unitName: sampleUnitName,
      },
    ];
    const employeeCodeGuideRows = [
      {
        field: 'username',
        required: 'RECOMMENDED',
        description: 'Khóa ánh xạ tốt nhất với tài khoản hiện có',
      },
      {
        field: 'fullName',
        required: 'OPTIONAL',
        description: 'Fallback khi thiếu username, cần kết hợp với đơn vị',
      },
      {
        field: 'employeeCode',
        required: 'YES',
        description: 'Mã nhân viên cần cập nhật vào tài khoản hiện có',
      },
      {
        field: 'unitCode',
        required: 'OPTIONAL',
        description: 'Dùng hỗ trợ fallback fullName + đơn vị',
      },
      {
        field: 'unitName',
        required: 'OPTIONAL',
        description: 'Fallback khi thiếu unitCode',
      },
    ];
    const employeeCodeTemplateSheet = XLSX.utils.json_to_sheet(employeeCodeMappingRows);
    const employeeCodeGuideSheet = XLSX.utils.json_to_sheet(employeeCodeGuideRows);

    XLSX.utils.book_append_sheet(workbook, templateSheet, 'template');
    XLSX.utils.book_append_sheet(workbook, unitSheet, 'units');
    XLSX.utils.book_append_sheet(workbook, guideSheet, 'guide');
    XLSX.utils.book_append_sheet(workbook, employeeCodeTemplateSheet, 'employee-code-mapping');
    XLSX.utils.book_append_sheet(workbook, employeeCodeGuideSheet, 'employee-code-guide');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="user-import-template.xlsx"');
    return res.send(buffer);
  }

  @Get('import-employee-codes-template')
  @Roles(Role.MANAGER, Role.ADMIN)
  async downloadEmployeeCodeTemplate(@Res() res: Response) {
    const templateRows = [
      { username: 'nv001', employeeCode: 'NV001' },
      { username: 'nv002', employeeCode: 'NV002' },
      { username: 'ql001', employeeCode: 'QL001' },
    ];

    const guideRows = [
      {
        field: 'username',
        required: 'YES',
        description: 'Tài khoản hiện có trong hệ thống',
      },
      {
        field: 'employeeCode',
        required: 'YES',
        description: 'Mã nhân viên cần cập nhật cho tài khoản',
      },
    ];

    const workbook = XLSX.utils.book_new();
    const templateSheet = XLSX.utils.json_to_sheet(templateRows);
    const guideSheet = XLSX.utils.json_to_sheet(guideRows);

    XLSX.utils.book_append_sheet(workbook, templateSheet, 'template');
    XLSX.utils.book_append_sheet(workbook, guideSheet, 'guide');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="user-employee-code-template.xlsx"',
    );
    return res.send(buffer);
  }
}
