# ThreatIntel Frontend — Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install

# Build args → env vars for Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_LOCAL_NMAP_URL
ARG VITE_LOCAL_TOOLS_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_LOCAL_NMAP_URL=$VITE_LOCAL_NMAP_URL
ENV VITE_LOCAL_TOOLS_URL=$VITE_LOCAL_TOOLS_URL

# Copy source and build
COPY . .
RUN npm run build

# ---- Serve with Nginx ----
FROM nginx:alpine

COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
