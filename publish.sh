#!/usr/bin/env bash
# Veraltet: Veroeffentlichung erfolgt ueber .github/workflows/docs.yaml (Push auf main
# oder manuell per workflow_dispatch). Dieses Skript baut nur noch lokal, es pusht nichts.
set -euo pipefail
cd "$(dirname "$0")"
./local-convert.sh
echo "Nicht gepusht: Deployment laeuft ueber den Workflow 'Pages' auf GitHub."
