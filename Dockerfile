# Stage 1: Builder — compila dependências nativas (better-sqlite3)
FROM node:18-bullseye-slim AS builder

RUN apt-get update && apt-get install -y build-essential python3

WORKDIR /app

COPY package*.json ./

RUN npm ci --production

# Stage 2: Runtime — imagem leve sem ferramentas de compilação
FROM node:18-bullseye-slim

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY . .

RUN mkdir -p /app/data /app/public/uploads && chown -R node:node /app/data /app/public/uploads

USER node

EXPOSE 3000

CMD ["node", "server.js"]
