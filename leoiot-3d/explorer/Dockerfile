# Stage 1: build the explorer
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build
# Pre-compressed copies of the models, served by gzip_static (design D4)
RUN find dist/assets -name '*.gltf' -exec gzip -k -9 {} \;

# Stage 2: serve the built files
FROM nginx:stable-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/explorer.conf /etc/nginx/conf.d/explorer.conf
COPY --from=build /app/dist /usr/share/nginx/html/3d
EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8091/healthz || exit 1
