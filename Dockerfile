# Frontend Dockerfile for local self-hosted deployment
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* bun.lock* ./
RUN npm install

COPY . .

# Vite bakes env vars at build time — these ARGs become VITE_ env vars
ARG VITE_BACKEND_MODE=local
ARG VITE_API_URL=http://localhost:3001
ENV VITE_BACKEND_MODE=$VITE_BACKEND_MODE
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Serve with a lightweight static server
FROM node:20-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
