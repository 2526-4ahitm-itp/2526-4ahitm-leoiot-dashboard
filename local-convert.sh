#!/usr/bin/env bash
# Baut die Astro-Seite lokal nach dist/ (wie der Workflow docs.yaml).
# Vorschau danach: npm run preview  (oder npm run dev fuer den Dev-Server)
set -euo pipefail
cd "$(dirname "$0")"

[ -d node_modules ] || npm ci
npm run build
echo "Fertig: dist/ (Vorschau mit 'npm run preview')"
