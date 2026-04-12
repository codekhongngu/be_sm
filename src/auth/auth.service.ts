import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/common/enums/role.enum';
import { UsersService } from 'src/users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByUsername(
      registerDto.username,
    );
    if (existingUser) {
      throw new BadRequestException('Username đã tồn tại');
    }

    const unit = await this.usersService.findUnitById(registerDto.unitId);
    if (!unit) {
      throw new BadRequestException('Đơn vị không tồn tại');
    }

    const password = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      ...registerDto,
      password,
      role: registerDto.role || Role.EMPLOYEE,
    });

    return this.buildAuthResponse(user);
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.usersService.findByUsername(loginDto.username);
    if (!user) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    }

    // Ghi log đăng nhập
    try {
      await this.usersService.logLogin(user.id, user.username, ipAddress || '', userAgent || '');
    } catch (e) {
      console.error('Failed to log login', e);
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: {
    id: string;
    username: string;
    role: Role;
    unitId: string;
    unit?: { name?: string };
    fullName: string;
  }) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      unitId: user.unitId,
      unitName: user.unit?.name,
      fullName: user.fullName,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: payload,
    };
  }
}
