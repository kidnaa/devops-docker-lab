# Stage 1: install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
# Stage 2: runtime
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]