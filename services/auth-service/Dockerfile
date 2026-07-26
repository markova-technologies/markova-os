FROM node:18-alpine
WORKDIR /app
COPY services/auth-service/package*.json ./
RUN npm install --production
COPY services/auth-service/ .
COPY kernel /kernel
COPY packages /packages
ENV NODE_PATH=/app/node_modules
EXPOSE 5001
CMD ["npm", "start"]
