import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const allowedOrigins =
    process.env.FE_ORIGIN?.split(',')
      .map((item) => item.trim().replace(/\/+$/g, ''))
      .filter(Boolean) || ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'];
  const strictCors = process.env.CORS_STRICT === 'true';
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalizedOrigin = origin.replace(/\/+$/g, '');
      if (!strictCors || allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
    optionsSuccessStatus: 204,
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
