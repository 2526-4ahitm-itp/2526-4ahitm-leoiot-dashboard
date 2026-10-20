# Gebaut mit leoiot-pv/ als Kontext (siehe build-context), damit das gemeinsame Paket shared/ mitkommt.
# Ausschlüsse: Dockerfile.dockerignore.

# Stufe 1: Dashboard bauen
FROM node:22-alpine AS build
WORKDIR /app
COPY shared/ ./shared/
COPY dashboard/package.json dashboard/package-lock.json ./dashboard/
WORKDIR /app/dashboard
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# Stufe 2: gebaute Dateien ausliefern, Abfragen und Live-Kanal weiterreichen
FROM nginx:stable-alpine
# Nur DASHBOARD_-Variablen werden in die Vorlage eingesetzt
ENV NGINX_ENVSUBST_FILTER="^DASHBOARD_"
RUN rm /etc/nginx/conf.d/default.conf
# Leerer Standardwert für den Token, damit die Vorlage auch ohne ihn gültig bleibt
COPY dashboard/nginx/05-dashboard-env.envsh /docker-entrypoint.d/05-dashboard-env.envsh
COPY dashboard/nginx/dashboard.conf.template /etc/nginx/templates/dashboard.conf.template
COPY --from=build /app/dashboard/dist /usr/share/nginx/html/pv
EXPOSE 8089
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8089/healthz || exit 1
