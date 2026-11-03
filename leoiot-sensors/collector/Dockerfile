# Stage 1: compile TypeScript
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Stage 2: the compiled program and its runtime dependency only
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY devices.json healthcheck.mjs ./
# Do not run as root; the base image ships the user "node"
USER node
# Unhealthy when the program reports it so (broker lost for more than two
# minutes, database not writable for more than five) or stops reporting
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=2 \
  CMD ["node", "healthcheck.mjs"]
CMD ["node", "dist/main.js"]
