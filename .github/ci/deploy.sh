#!/usr/bin/env bash
# Rolls a released commit out to the deploy host. Called by
# .github/workflows/deploy.yml on the self-hosted runner on vm23; runnable on a
# workstation with --dry-run. Rules: openspec/changes/platform-cicd-pipeline,
# design D4, D4a and D5.
#
#   deploy.sh [--dry-run] rollout   check out the commit and update the deploy
#                                   units and legacy services it affects
#   deploy.sh [--dry-run] smoke     request the routes of .github/ci/smoke-routes
#   deploy.sh [--dry-run] record    store the deployed commit in the marker file
#
# The workflow runs the three in this order and "record" only when "smoke"
# passed, so a failed deployment never advances the marker.
#
# Environment:
#   DEPLOY_REPO_DIR     checkout to deploy from (required)
#   DEPLOY_MARKER_FILE  file holding the last successfully deployed commit,
#                       outside the checkout (required)
#   DEPLOY_REF          rollout: commit, branch or tag to deploy (required)
#   DEPLOY_SCOPE        rollout: affected (default), all, or a unit name
#   DEPLOY_SHA          record: the commit that rollout deployed
#   DEPLOY_RELEASE_REF  rollout: ref a commit must be on (default origin/release)
#   SMOKE_BASE_URL      smoke: default https://vm23.htl-leonding.ac.at
#   SMOKE_INTERVAL      smoke: seconds between rounds (default 10)
#   SMOKE_TIMEOUT       smoke: seconds before giving up (default 300)
#
# --dry-run (or DEPLOY_DRY_RUN=1) prints every docker command, the git fetch,
# the git checkout, the smoke requests and the marker write instead of running
# them. The affected-set is computed from a temporary worktree of the commit, so
# the checkout in DEPLOY_REPO_DIR is not changed.
#
# The script never passes --profile and never reads or writes any .env file:
# Compose reads the .env of each unit's folder by itself.

set -euo pipefail

dry=0
if [[ ${DEPLOY_DRY_RUN:-0} == 1 ]]; then dry=1; fi

usage() {
  sed -n '2,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

err() {
  if [[ -n ${GITHUB_ACTIONS:-} ]]; then
    echo "::error::$*"
  else
    echo "deploy.sh: error: $*" >&2
  fi
  exit 1
}

warn() {
  if [[ -n ${GITHUB_ACTIONS:-} ]]; then
    echo "::warning::$*"
  else
    echo "deploy.sh: warning: $*" >&2
  fi
}

need() {
  local v
  for v in "$@"; do
    [[ -n ${!v:-} ]] || err "$v is not set"
  done
}

# summary: markdown for the job summary; on a workstation it goes to stdout.
summary() {
  if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
    printf '%s\n' "$@" >>"$GITHUB_STEP_SUMMARY"
  else
    printf '%s\n' "$@"
  fi
}

group() { [[ -n ${GITHUB_ACTIONS:-} ]] && echo "::group::$*" || echo "== $*"; return 0; }
endgroup() { [[ -n ${GITHUB_ACTIONS:-} ]] && echo "::endgroup::"; return 0; }

# run <command...>: echo the command, run it unless this is a dry run.
run() {
  echo "+ $*"
  ((dry)) || "$@"
}

rollout() {
  need DEPLOY_REPO_DIR DEPLOY_MARKER_FILE DEPLOY_REF
  local scope=${DEPLOY_SCOPE:-affected}
  local ref=$DEPLOY_REF
  local release_ref=${DEPLOY_RELEASE_REF:-origin/release}
  local repo=$DEPLOY_REPO_DIR marker=$DEPLOY_MARKER_FILE

  # Manual inputs reach this script as plain strings; accept only names.
  [[ $scope =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] ||
    err "invalid scope '$scope': use affected, all, or a unit name such as legacy or leoiot-pv"
  [[ $ref =~ ^[A-Za-z0-9][A-Za-z0-9._/@-]*$ ]] ||
    err "invalid ref '$ref': use a commit SHA, a branch or a tag"

  [[ -d $repo/.git || -f $repo/.git ]] || err "$repo is not a git checkout"
  cd "$repo"

  group "Fetch"
  run git fetch --prune origin
  endgroup

  local sha
  sha=$(git rev-parse --verify --quiet "${ref}^{commit}" 2>/dev/null) ||
    sha=$(git rev-parse --verify --quiet "origin/${ref}^{commit}" 2>/dev/null) ||
    err "cannot resolve '$ref' to a commit"

  # Only commits that went through the release branch are deployed.
  git merge-base --is-ancestor "$sha" "$release_ref" 2>/dev/null ||
    err "commit $sha is not on ${release_ref#origin/}; nothing on the host was changed"

  local tree=$repo tmp=""
  if ((dry)); then
    echo "+ git checkout --detach $sha"
    tmp=$(mktemp -d)
    # shellcheck disable=SC2064 # expand now: the paths are fixed
    trap "git -C '$repo' worktree remove --force '$tmp/tree' >/dev/null 2>&1 || true; rm -rf '$tmp'" EXIT
    git worktree add --detach --quiet "$tmp/tree" "$sha"
    tree=$tmp/tree
  else
    group "Check out $sha"
    local out
    echo "+ git checkout --detach $sha"
    if ! out=$(git checkout --detach "$sha" 2>&1); then
      printf '%s\n' "$out"
      local files fix
      files=$(printf '%s\n' "$out" | sed -n 's/^\t//p' | paste -sd' ' -)
      if grep -q 'untracked working tree files' <<<"$out"; then
        fix="move or delete the file(s) on the host: $files"
      else
        fix="restore the file(s) on the host with: git -C $repo checkout -- $files"
      fi
      err "git checkout of $sha stopped because of local changes on the host (${files:-see log}). Nothing was discarded. Fix: $fix. Then run the deployment again."
    fi
    endgroup
  fi

  local affected=$tree/.github/ci/affected.sh
  [[ -f $affected ]] ||
    err "commit $sha has no .github/ci/affected.sh; commits from before the CI layout cannot be deployed with this workflow"

  # The last good deployment. A missing or unknown commit means everything.
  local last="" m
  if [[ -f $marker ]]; then
    m=$(tr -d '[:space:]' <"$marker")
    if [[ $m =~ ^[0-9a-f]{40}$ ]] && git cat-file -e "${m}^{commit}" 2>/dev/null; then
      last=$m
    else
      echo "The marker $marker does not name a known commit; treating everything as changed."
    fi
  else
    echo "No marker at $marker; treating everything as changed."
  fi

  # What changed between the last deployment and this commit (both directions
  # give the same files, so a rollback works the same way).
  local range_out="" aff
  if [[ -n $last ]]; then
    range_out=$(bash "$affected" "$last" "$sha") || err "affected.sh $last $sha failed"
  fi
  case $scope in
    affected)
      if [[ -n $last ]]; then
        aff=$range_out
      else
        aff=$(bash "$affected" --all) || err "affected.sh --all failed"
      fi
      ;;
    all) aff=$(bash "$affected" --all) || err "affected.sh --all failed" ;;
    *) aff=$(bash "$affected" --unit "$scope") || err "scope '$scope' is not a deploy unit of this commit" ;;
  esac

  local units=() services=() u
  while read -r kind value _; do
    case $kind in
      unit) units+=("$value") ;;
      service) services+=("$value") ;;
    esac
  done <<<"$aff"

  local nginx=0
  if [[ -z $last ]] || grep -q '^nginx-warning true' <<<"$range_out"; then nginx=1; fi
  if ((nginx)); then
    warn "An nginx file changed or there is no earlier deployment to compare with. The deployment does not apply nginx files: compare legacy/deploy/nginx.conf (and leoiot-platform/**/nginx*.conf) with /etc/nginx/sites-available/leoiot on vm23 and apply it by hand if needed."
  fi

  local subject prev="none, everything is treated as changed"
  subject=$(git log -1 --format=%s "$sha")
  [[ -z $last ]] || prev="\`$last\`"
  summary "## Deployment" "" \
    "- Commit: \`$sha\` ($subject)" \
    "- Scope: \`$scope\`" \
    "- Previous deployed commit: $prev" \
    "- Units: ${units[*]:-none}" \
    "- Legacy services recreated: ${services[*]:-none}" \
    "- nginx file changed or unknown: $( ((nginx)) && echo yes || echo no)" ""

  # Order: platform, legacy, other units alphabetically (affected.sh sorts them).
  # A unit that fails stops the rollout.
  for u in "${units[@]}"; do
    group "Unit $u"
    echo "+ cd $u"
    cd "$tree/$u"
    run docker compose config -q ||
      err "docker compose cannot resolve unit $u with the host's $u/.env (see the message above; a required variable is probably missing). Unit $u and the units after it were not changed."
    local force=()
    if [[ $u != legacy && ($scope == all || $scope == "$u") ]]; then
      force=(--force-recreate)
    fi
    run docker compose up -d --build --remove-orphans "${force[@]}" ||
      err "docker compose up failed in unit $u; the units after it were not updated"
    if [[ $u == legacy && ${#services[@]} -gt 0 ]]; then
      # The Node services bind-mount their folder, so neither image nor
      # definition changes and a plain "up" leaves them running old code.
      # --no-deps: the services are already running; without it Compose would
      # recreate influxdb and mosquitto too, which nearly every service needs.
      run docker compose up -d --build --force-recreate --no-deps "${services[@]}" ||
        err "recreating the legacy services failed; the units after legacy were not updated"
    fi
    cd "$repo"
    endgroup
  done
  ((${#units[@]})) || echo "No deploy unit needs an update."

  if [[ -n ${GITHUB_OUTPUT:-} ]]; then echo "sha=$sha" >>"$GITHUB_OUTPUT"; fi
  echo "Rollout of $sha finished."
}

smoke() {
  need DEPLOY_REPO_DIR
  local base=${SMOKE_BASE_URL:-https://vm23.htl-leonding.ac.at}
  local interval=${SMOKE_INTERVAL:-10} timeout=${SMOKE_TIMEOUT:-300}
  local file=$DEPLOY_REPO_DIR/.github/ci/smoke-routes
  [[ -f $file ]] || err "$file does not exist"

  local routes=() line
  while IFS= read -r line || [[ -n $line ]]; do
    line=${line%%#*}
    line=$(echo "$line" | tr -d '[:space:]')
    [[ -n $line ]] && routes+=("$line")
  done <"$file"
  ((${#routes[@]})) || err "$file lists no routes"

  if ((dry)); then
    for line in "${routes[@]}"; do
      echo "+ curl -sSL --max-redirs 10 --max-time 15 -o /dev/null -w '%{http_code}' $base$line"
    done
    return 0
  fi

  local deadline=$((SECONDS + timeout)) pending=("${routes[@]}") still r code
  declare -A status=()
  while :; do
    still=()
    for r in "${pending[@]}"; do
      code=$(curl -sS -L --max-redirs 10 --max-time 15 -o /dev/null -w '%{http_code}' "$base$r" 2>/dev/null) || true
      if [[ $code =~ ^2[0-9][0-9]$ ]]; then
        echo "ok    $r ($code)"
      else
        status[$r]=${code:-000}
        still+=("$r")
      fi
    done
    pending=("${still[@]}")
    ((${#pending[@]})) || break
    if ((SECONDS >= deadline)); then
      local failed=""
      for r in "${pending[@]}"; do failed+="${failed:+, }$r (${status[$r]})"; done
      summary "## Smoke test failed" "" "Routes without a 2xx answer after ${timeout}s: $failed" ""
      err "smoke test failed for: $failed"
    fi
    echo "waiting for: ${pending[*]}"
    sleep "$interval"
  done
  echo "All ${#routes[@]} routes answered."
  summary "Smoke test passed: ${#routes[@]} routes answered with 2xx."
}

record() {
  need DEPLOY_MARKER_FILE DEPLOY_SHA
  [[ $DEPLOY_SHA =~ ^[0-9a-f]{40}$ ]] || err "DEPLOY_SHA is not a full commit SHA"
  if ((dry)); then
    echo "+ echo $DEPLOY_SHA > $DEPLOY_MARKER_FILE"
    return 0
  fi
  local tmp
  tmp=$(mktemp "$DEPLOY_MARKER_FILE.XXXXXX")
  echo "$DEPLOY_SHA" >"$tmp"
  mv "$tmp" "$DEPLOY_MARKER_FILE" # atomic: the marker is never half written
  echo "Recorded $DEPLOY_SHA in $DEPLOY_MARKER_FILE."
}

cmd=""
for a in "$@"; do
  case $a in
    --dry-run) dry=1 ;;
    -h | --help) usage ;;
    rollout | smoke | record) cmd=$a ;;
    *) usage ;;
  esac
done
[[ -n $cmd ]] || usage
"$cmd"
