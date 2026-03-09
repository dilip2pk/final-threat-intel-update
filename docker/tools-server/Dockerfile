# ThreatIntel Local Tools Server
FROM node:20-alpine

# Install nmap (used by nmap plugin)
RUN apk add --no-cache nmap nmap-scripts

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

EXPOSE 3002
CMD ["node", "server.js"]
