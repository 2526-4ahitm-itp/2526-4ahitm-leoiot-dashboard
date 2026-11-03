# Gebaut mit leoiot-pv/ als Kontext (siehe build-context), damit das gemeinsame Paket shared/ mitkommt.
# Ausschlüsse: Dockerfile.dockerignore.

# Stufe 1: Film bauen
FROM node:22-alpine AS build
WORKDIR /app
COPY shared/ ./shared/
COPY kiosk2/package.json kiosk2/package-lock.json ./kiosk2/
WORKDIR /app/kiosk2
RUN npm ci
COPY kiosk2/ ./
RUN npm run build

# Stufe 2: gebaute Dateien ausliefern, Abfragen und Live-Kanal weiterreichen
FROM nginx:stable-alpine
# Nur KIOSK2_-Variablen werden in die Vorlage eingesetzt
ENV NGINX_ENVSUBST_FILTER="^KIOSK2_"
RUN rm /etc/nginx/conf.d/default.conf
# Leerer Standardwert für den Token, damit die Vorlage auch ohne ihn gültig bleibt
COPY kiosk2/nginx/05-kiosk2-env.envsh /docker-entrypoint.d/05-kiosk2-env.envsh
COPY kiosk2/nginx/kiosk2.conf.template /etc/nginx/templates/kiosk2.conf.template
COPY --from=build /app/kiosk2/dist /usr/share/nginx/html/kiosk2
EXPOSE 8093
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8093/healthz || exit 1
