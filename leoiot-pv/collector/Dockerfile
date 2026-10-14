# Stufe 1: TypeScript übersetzen
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Stufe 2: nur das übersetzte Programm und die Laufzeitabhängigkeit
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY healthcheck.mjs ./
# Nicht als root laufen; der Benutzer "node" bringt das Basis-Image mit
USER node
# Ungesund, wenn die letzte Lieferung älter als 5 Minuten ist oder die Datei
# nach der Startphase noch fehlt
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=2 \
  CMD ["node", "healthcheck.mjs"]
CMD ["node", "dist/main.js"]
