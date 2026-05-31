# Compiling Environment
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production Hosting Layer
FROM nginx:alpine

# Copy compiled distribution bundles
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard production distribution channel port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]