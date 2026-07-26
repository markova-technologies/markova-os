FROM node:20-alpine
WORKDIR /app
COPY services/connector-hub/package.json .
RUN npm install --production
COPY services/connector-hub/ .
COPY kernel /kernel
COPY packages /packages
ENV NODE_PATH=/app/node_modules
RUN mkdir -p /tmp/connector-uploads
EXPOSE 5005
CMD ["node", "server.js"]
