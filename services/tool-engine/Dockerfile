FROM node:18-alpine
WORKDIR /app
COPY services/tool-engine/package*.json ./
RUN npm install --production
COPY services/tool-engine/ .
COPY kernel /kernel
COPY packages /packages
ENV NODE_PATH=/app/node_modules
EXPOSE 5004
CMD ["npm", "start"]
