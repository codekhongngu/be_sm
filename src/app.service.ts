import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class AppService {
  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async checkDatabase() {
    await this.connection.query('SELECT 1');
    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
