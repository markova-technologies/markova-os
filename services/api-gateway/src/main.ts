import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import * as jwt from 'jsonwebtoken';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Helmet for security headers
  const helmet = require('helmet');
  app.use(helmet());

  // Strict CORS configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  // Rate limiting middleware
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    })
  );

  // Note: JWT Auth and Tenant context injection is handled by AuthMiddleware (auth.middleware.ts)


  // Proxy WebSockets to the orchestrator service
  app.use(
    '/ws',
    createProxyMiddleware({
      target: process.env.ORCHESTRATOR_URL || 'http://orchestrator:6000',
      changeOrigin: true,
      ws: true,
    })
  );

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`📡 API Gateway listening on port ${port}`);
}
bootstrap();
