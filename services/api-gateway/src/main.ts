import './tracing'; // Must be the absolute first import for OpenTelemetry
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
const { createProxyMiddleware } = require('http-proxy-middleware');
import rateLimit from 'express-rate-limit';
import * as jwt from 'jsonwebtoken';

async function bootstrap() {
  // Proxy gateway: do not parse bodies here — multipart uploads and raw streams
  // must reach upstream services intact (express-http-proxy streams them).
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Helmet for security headers
  const helmet = require('helmet');
  app.use(helmet());

  // Trust reverse proxy (Render, Cloudflare) for accurate client IP identification
  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp && typeof expressApp.set === 'function') {
    expressApp.set('trust proxy', 1);
  }

  // CORS configuration: whitelist dashboard and production domains with ALLOWED_ORIGINS env
  const defaultOrigins = [
    'https://app.markova.tech',
    'https://markova.tech',
    'https://admin.markova.tech',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8000',
  ];
  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : defaultOrigins;

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        envOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1')))
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-company-id', 'x-tenant-id', 'x-markova-env', 'Accept', 'Origin', 'Idempotency-Key', 'x-api-key'],
    exposedHeaders: ['x-request-id', 'Idempotency-Key'],
  });
  
  // Rate limiting middleware
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      validate: { xForwardedForHeader: false },
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
