FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
RUN mkdir -p /tmp/connector-uploads
EXPOSE 5005
CMD ["node", "server.js"]
