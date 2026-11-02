# TEMPORARY: see README.md
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY index.mjs readings.mjs ./
USER node
CMD ["node", "index.mjs"]
