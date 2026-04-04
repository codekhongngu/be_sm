import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from 'src/common/enums/role.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: {
    sub: string;
    username: string;
    role: Role;
    unitId: string;
    unitName?: string;
    fullName: string;
  }) {
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      unitId: payload.unitId,
      unitName: payload.unitName,
      fullName: payload.fullName,
    };
  }
}
