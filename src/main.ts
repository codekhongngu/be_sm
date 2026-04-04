import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: process.env.FE_ORIGIN?.split(',').map((item) => item.trim()) || [
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const staticPaths = [
    join(process.cwd(), 'public'),
    join(__dirname, 'public'),
    join(__dirname, '..', 'public'),
  ];
  staticPaths.forEach((path) => {
    if (existsSync(path)) {
      app.useStaticAssets(path);
    }
  });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
}
bootstrap();
