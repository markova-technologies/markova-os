FROM node:18-alpine AS builder
WORKDIR /app
COPY services/api-gateway/package*.json ./
RUN npm install
COPY services/api-gateway/ .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY services/api-gateway/package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
# Spec served at GET /openapi.yaml and /docs
COPY openapi.yaml /openapi.yaml
COPY openapi.yaml ./openapi.yaml
EXPOSE 8000
CMD ["node", "dist/main"]
