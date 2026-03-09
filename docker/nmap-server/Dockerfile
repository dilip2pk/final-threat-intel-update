# ThreatIntel Nmap Server
FROM node:20-alpine

# Install nmap
RUN apk add --no-cache nmap nmap-scripts

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

EXPOSE 3001
CMD ["node", "server.js"]
