# Stage 1: build the dashboard
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
RUN npm run build

# Stage 2: serve the build, forward queries with the token added by nginx
FROM nginx:stable-alpine
# Only SENSORS_DASHBOARD_ variables are put into the template
ENV NGINX_ENVSUBST_FILTER="^SENSORS_DASHBOARD_"
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/05-dashboard-env.envsh /docker-entrypoint.d/05-dashboard-env.envsh
COPY nginx/dashboard.conf.template /etc/nginx/templates/dashboard.conf.template
COPY --from=build /app/dist /usr/share/nginx/html/sensors
EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8091/healthz || exit 1
