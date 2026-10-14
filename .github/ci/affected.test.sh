#!/usr/bin/env bash
# Test for .github/ci/affected.sh and .github/ci/legacy-services.map.
# Part 1 feeds fixed lists of changed files to affected.sh and compares the
# result; part 2 checks that the legacy service map matches
# legacy/docker-compose.yaml and the legacy/* directories (design D11).
# Run from anywhere: .github/ci/affected.test.sh
# Needs git and "docker compose config" (no Docker daemon).

set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(git -C "$script_dir" rev-parse --show-toplevel)
cd "$repo"
affected="$script_dir/affected.sh"
map="$script_dir/legacy-services.map"

failures=0
checks=0

fail() {
  echo "FAIL: $*" >&2
  failures=$((failures + 1))
}

# run <files> [affected.sh options]: output of affected.sh for a list of files
run() {
  local files=$1
  shift
  printf '%s\n' "$files" | "$affected" --files "$@"
}

# expect_exact <name> <files> <expected output>
expect_exact() {
  local name=$1 files=$2 expected=$3 actual
  checks=$((checks + 1))
  actual=$(run "$files")
  if [[ $actual != "$expected" ]]; then
    fail "$name"
    diff <(echo "$expected") <(echo "$actual") | sed 's/^/    /' >&2 || true
  fi
}

# expect_has <name> <files> <line>...: every line is in the output
expect_has() {
  local name=$1 files=$2 actual line
  shift 2
  checks=$((checks + 1))
  actual=$(run "$files")
  for line in "$@"; do
    grep -qxF -- "$line" <<<"$actual" || fail "$name: missing '$line'"
  done
}

# expect_lacks <name> <files> <regex>...: no output line matches
expect_lacks() {
  local name=$1 files=$2 actual re
  shift 2
  checks=$((checks + 1))
  actual=$(run "$files")
  for re in "$@"; do
    ! grep -qE -- "$re" <<<"$actual" || fail "$name: unexpected '$re'"
  done
}

# ---- part 1: fixed file lists -----------------------------------------------

expect_exact "leoiot-pv/kiosk only" \
  "leoiot-pv/kiosk/src/app.js" \
  "node leoiot-pv/kiosk
image leoiot-pv/kiosk
unit leoiot-pv"

expect_exact "leoiot-pv/collector only" \
  "leoiot-pv/collector/lib/solax.mjs" \
  "node leoiot-pv/collector
image leoiot-pv/collector
unit leoiot-pv"

expect_exact "legacy/frontend only" \
  "legacy/frontend/src/main.ts" \
  "node legacy/frontend
unit legacy
service frontend"

expect_exact "legacy/backend only" \
  "legacy/backend/sensor-data-generator/src/main/java/App.java" \
  "maven legacy/backend/sensor-data-generator
unit legacy
service quarkus-app"

expect_exact "legacy file no component owns" \
  "legacy/config/mosquitto.conf" \
  "compose legacy/docker-compose.yaml
unit legacy
service mosquitto"

expect_exact "legacy/telegraf.conf" \
  "legacy/telegraf.conf" \
  "compose legacy/docker-compose.yaml
unit legacy
service telegraf"

expect_exact "pv unit file no component owns" \
  "leoiot-pv/README.md" \
  "compose leoiot-pv/compose.yaml
unit leoiot-pv"

expect_exact "docs only" \
  "src/content/docs/docs/operations.md
public/logo.svg
asciidocs/index.adoc
astro.config.mjs
package.json
package-lock.json
docs/functional-specification.md" \
  "docs true"

expect_exact "openspec only" \
  "openspec/changes/platform-cicd-pipeline/tasks.md
openspec/specs/README.md" \
  ""

expect_exact "root markdown, license, gitignore" \
  "README.md
AGENTS.md
LICENSE
.gitignore" \
  ""

expect_exact "sub-project folder without anything to verify" \
  "leoiot-sensors/README.md" \
  ""

expect_exact "compose file of legacy" \
  "legacy/docker-compose.yaml" \
  "ci-scripts true
compose legacy/docker-compose.yaml
unit legacy"

expect_exact "compose file of a new unit" \
  "leoiot-pv/compose.yaml" \
  "compose leoiot-pv/compose.yaml
unit leoiot-pv"

expect_exact "nginx file of legacy" \
  "legacy/deploy/nginx.conf" \
  "compose legacy/docker-compose.yaml
unit legacy
nginx-warning true"

expect_exact "nginx file of the platform" \
  "leoiot-platform/proxy/nginx.conf" \
  "nginx-warning true"

expect_exact "new legacy app is checked against the map" \
  "legacy/newapp/package.json" \
  "ci-scripts true
compose legacy/docker-compose.yaml
unit legacy"

# Over-running changes: everything in CI, nothing forced for the deployment.
everything_ci=(
  "docs true"
  "ci-scripts true"
  "node legacy/frontend"
  "node legacy/kiosk4"
  "node leoiot-pv/kiosk"
  "node leoiot-pv/collector"
  "maven legacy/backend/sensor-data-generator"
  "compose legacy/docker-compose.yaml"
  "compose leoiot-pv/compose.yaml"
  "image leoiot-pv/kiosk"
  "image leoiot-pv/collector"
)
for fixture in ".github/workflows/ci.yml" ".github/ci/affected.sh" "unknown-file.txt"; do
  expect_has "everything for $fixture" "$fixture" "${everything_ci[@]}"
  expect_lacks "nothing forced for $fixture" "$fixture" '^unit ' '^service ' '^nginx-warning'
done

# A component that is no longer in the tree is not reported as a component.
expect_exact "deleted component" \
  "legacy/long-gone/index.js" \
  "compose legacy/docker-compose.yaml
unit legacy"

# ---- part 1b: other modes ---------------------------------------------------

checks=$((checks + 1))
all=$("$affected" --all)
for line in "${everything_ci[@]}" "unit legacy" "unit leoiot-pv" "service frontend" \
  "service influxdb" "service quarkus-app" "nginx-warning true"; do
  grep -qxF -- "$line" <<<"$all" || fail "--all: missing '$line'"
done

checks=$((checks + 1))
units=$("$affected" --all | grep '^unit ' | tr '\n' ' ')
case $units in
  "unit legacy unit leoiot-pv ") ;;
  *) fail "--all: units not in deployment order: $units" ;;
esac

checks=$((checks + 1))
[[ $("$affected" --unit leoiot-pv) == "unit leoiot-pv" ]] || fail "--unit leoiot-pv"

checks=$((checks + 1))
legacy_unit=$("$affected" --unit legacy)
[[ $(grep -c '^service ' <<<"$legacy_unit") -eq $(grep -cvE '^[[:space:]]*(#|$)' "$map") ]] ||
  fail "--unit legacy: not every service of the map"

checks=$((checks + 1))
if "$affected" --unit no-such-unit >/dev/null 2>&1; then
  fail "--unit with an unknown unit succeeded"
fi

checks=$((checks + 1))
json=$(printf 'leoiot-pv/kiosk/a.js\n' | "$affected" --files --json)
expected_json='docs=false
ci_scripts=false
node=["leoiot-pv/kiosk"]
maven=[]
compose=[]
image=["leoiot-pv/kiosk"]'
[[ $json == "$expected_json" ]] || fail "--json output: $json"

checks=$((checks + 1))
if "$affected" HEAD "no-such-ref-$$" >/dev/null 2>&1; then
  fail "a range with an unknown commit succeeded"
fi

checks=$((checks + 1))
real=$("$affected" HEAD HEAD)
[[ -z $real ]] || fail "empty range printed: $real"

# ---- part 2: the legacy service map is complete ------------------------------

# check_map <map file>: prints one line per problem, nothing when complete
check_map() {
  local mapfile=$1 s d p covered
  local -a compose_services=() map_services=() prefixes=()
  mapfile -t compose_services < <(docker compose -f legacy/docker-compose.yaml config --services)
  ((${#compose_services[@]})) || {
    echo "no services found in legacy/docker-compose.yaml"
    return 0
  }
  while read -r p s _; do
    [[ -z $p || $p == \#* ]] && continue
    prefixes+=("$p")
    map_services+=("$s")
  done <"$mapfile"

  for s in "${compose_services[@]}"; do
    printf '%s\n' "${map_services[@]}" | grep -qxF -- "$s" ||
      echo "service '$s' of legacy/docker-compose.yaml is not in the map"
  done
  for s in "${map_services[@]}"; do
    printf '%s\n' "${compose_services[@]}" | grep -qxF -- "$s" ||
      echo "the map names '$s', which is not a service of legacy/docker-compose.yaml"
  done
  # every legacy/* directory with a package.json needs a line
  while IFS= read -r d; do
    covered=0
    for p in "${prefixes[@]}"; do
      [[ $p == */ && $d/ == "$p"* ]] && covered=1
    done
    ((covered)) || echo "directory '$d' has a package.json but no line in the map"
  done < <(git ls-files 'legacy/*/package.json' | awk -F/ 'NF == 3 { print $1 "/" $2 }')
}

checks=$((checks + 1))
problems=$(check_map "$map")
if [[ -n $problems ]]; then
  fail "legacy service map is incomplete"
  printf '%s\n' "$problems" | sed 's/^/    /' >&2
fi

# The check must catch each kind of mistake.
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

expect_problem() { # expect_problem <name> <map file> <text the report must contain>
  local name=$1 file=$2 text=$3 report
  checks=$((checks + 1))
  report=$(check_map "$file")
  if [[ -z $report ]]; then
    fail "completeness check passes with $name"
  elif ! grep -qF -- "$text" <<<"$report"; then
    fail "completeness check for $name does not mention '$text': $report"
  fi
}

grep -v ' grafana$' "$map" >"$scratch/no-grafana.map"
expect_problem "a service line deleted" "$scratch/no-grafana.map" "'grafana'"

sed 's#^legacy/kiosk4/ #-                  #' "$map" >"$scratch/no-kiosk4.map"
expect_problem "a directory line deleted" "$scratch/no-kiosk4.map" "legacy/kiosk4"

{
  cat "$map"
  echo "legacy/ghost/                              ghost-service"
} >"$scratch/ghost.map"
expect_problem "a service that does not exist" "$scratch/ghost.map" "'ghost-service'"

# ---- result ---------------------------------------------------------------

if ((failures)); then
  echo "$failures of $checks checks failed" >&2
  exit 1
fi
echo "affected.test.sh: all $checks checks passed"
