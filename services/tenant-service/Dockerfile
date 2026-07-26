FROM node:18-alpine
WORKDIR /app
COPY services/tenant-service/package*.json ./
RUN npm install --production
COPY services/tenant-service/ .
COPY kernel /kernel
COPY packages /packages
ENV NODE_PATH=/app/node_modules
EXPOSE 5002
CMD ["npm", "start"]
