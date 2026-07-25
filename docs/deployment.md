# MARKOVA 2.0 - Deployment Guide

## Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development outside of Docker)
- PostgreSQL 15+
- Redis 7+

## Environment Variables
Before deploying, ensure you have a `.env` file at the root directory based on `.env.example`. Key variables include:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `VITE_API_BASE_URL` (For frontend builds)

## Local Development (With Docker)
The easiest way to run the entire stack locally is using Docker Compose.

```bash
# Build and start all services in detached mode
docker-compose up --build -d

# View logs for a specific service
docker-compose logs -f api-gateway
```

## Local Development (Without Docker)
If you prefer running services directly via Node:

1. Ensure PostgreSQL and Redis are running locally.
2. Install root dependencies:
   ```bash
   npm install
   ```
3. Start frontend applications:
   ```bash
   npm run dev:client
   npm run dev:admin
   ```
4. Start individual backend services (you will need multiple terminal windows):
   ```bash
   npm start --workspace=services/api-gateway
   npm start --workspace=services/auth-service
   # ... repeat for other services
   ```

## Production Deployment
For production, it is recommended to use a managed Kubernetes cluster (EKS, GKE, AKS) or a PaaS like Render / Heroku.

1. **Database:** Use a managed PostgreSQL instance (e.g., AWS RDS) and a managed Redis instance (e.g., AWS ElastiCache).
2. **Frontend:** The Vite applications (`apps/client-dashboard` and `apps/admin-dashboard`) should be built statically (`npm run build:client`) and hosted on a CDN (Vercel, Netlify, or AWS S3 + CloudFront).
3. **Backend Services:** Build the Docker images for each service in `services/*` and deploy them to your container orchestration platform. Ensure they are isolated in a private subnet, with only the `api-gateway` exposed to the public internet via a Load Balancer.

## Health Checks
Each service exposes a `/health` endpoint to verify its status. The `docker-compose.yml` is configured to use these endpoints to ensure proper startup sequencing (using `depends_on: condition: service_healthy`).
