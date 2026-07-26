FROM node:18-alpine
WORKDIR /app
COPY services/agent-builder/package*.json ./
RUN npm install --production
COPY services/agent-builder/ .
COPY kernel /kernel
COPY packages /packages
ENV NODE_PATH=/app/node_modules
EXPOSE 5003
CMD ["npm", "start"]
