# DEMO, not a permanent part of the system: see README.md. Delete it with the demo.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY index.mjs rooms.mjs model.mjs messages.mjs influx.mjs ./
USER node
CMD ["node", "index.mjs"]
