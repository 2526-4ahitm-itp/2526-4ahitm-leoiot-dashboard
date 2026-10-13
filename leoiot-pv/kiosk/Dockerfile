# Stufe 1: Kiosk bauen
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stufe 2: gebaute Dateien ausliefern, Abfragen und Live-Kanal weiterreichen
FROM nginx:stable-alpine
# Nur KIOSK_-Variablen werden in die Vorlage eingesetzt
ENV NGINX_ENVSUBST_FILTER="^KIOSK_"
RUN rm /etc/nginx/conf.d/default.conf
# Leerer Standardwert für den Token, damit die Vorlage auch ohne ihn gültig bleibt
COPY nginx/05-kiosk-env.envsh /docker-entrypoint.d/05-kiosk-env.envsh
COPY nginx/kiosk.conf.template /etc/nginx/templates/kiosk.conf.template
COPY --from=build /app/dist /usr/share/nginx/html/kiosk
EXPOSE 8088
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8088/healthz || exit 1
