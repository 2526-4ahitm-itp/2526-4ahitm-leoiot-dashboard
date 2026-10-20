#!/usr/bin/env bash
# Works out what a set of changed files affects: CI components, deploy units and
# legacy Compose services. One implementation for CI (.github/workflows/ci.yml)
# and for the deployment job, so both give the same answer.
# Rules: openspec/changes/platform-cicd-pipeline/design.md, decision D11.
#
#   affected.sh <base> <head>   files changed between two commits (git diff, not
#                               limited to the merge base, so a rollback gives
#                               the same files as the forward range)
#   affected.sh --files         changed files, one per line, on standard input
#   affected.sh --all           everything: push to main, manual scope "all"
#   affected.sh --unit <unit>   manual scope: one deploy unit, and for "legacy"
#                               every legacy service
#
#   --json                      print "key=value" lines for $GITHUB_OUTPUT
#                               instead of "kind value" lines (CI keys only)
#
# Components are discovered in the checked-out tree (tracked files only).
# Output, one "kind value" line per result, sorted by kind:
#   docs true            the documentation site needs its check
#   ci-scripts true      .github/ci/affected.test.sh needs to run
#   node <dir>           Node component to check
#   maven <dir>          Maven component to check
#   compose <file>       Compose file to validate
#   image <dir>          leoiot-* Dockerfile directory to build (its build
#                        context: .github/ci/image-build.sh)
#   unit <folder>        deploy unit to update, in deployment order
#   service <name>       legacy Compose service to recreate, in map order
#   nginx-warning true   an nginx file changed that CI does not apply
# A leoiot-* Node component that names another one of the same sub-project as
# a local "file:" dependency in its package.json is checked, and its image
# built, whenever that dependency is affected (openspec/changes/
# platform-ci-build-context, design D2). Needs no Node.js (the deployment runs
# this script on vm23).
# Exits non-zero when the change set cannot be determined.

# The r_* result arrays are read through namerefs (in sorted_keys), which the
# linter cannot follow.
# shellcheck disable=SC2034
set -euo pipefail

die() {
  echo "affected.sh: $*" >&2
  exit 2
}

usage() {
  sed -n '2,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(git -C "$script_dir" rev-parse --show-toplevel)
cd "$repo"
map="$script_dir/legacy-services.map"

json=0
mode=""
unit_arg=""
positional=()
while (($#)); do
  case $1 in
    --json) json=1 ;;
    --files) mode=files ;;
    --all) mode=all ;;
    --unit)
      mode=unit
      shift
      (($#)) || die "--unit needs a unit name"
      unit_arg=$1
      ;;
    -h | --help) usage ;;
    -*) die "unknown option $1" ;;
    *) positional+=("$1") ;;
  esac
  shift
done
if [[ -z $mode ]]; then
  ((${#positional[@]} == 2)) || usage
  mode=range
elif ((${#positional[@]} > 0)); then
  usage
fi

# ---- the tree ---------------------------------------------------------------

declare -A pkg=() pom=() dockerdir=() composefile=() unit=()

while IFS= read -r f; do
  case $f in
    node_modules/* | */node_modules/*) continue ;;
  esac
  dir=""
  [[ $f == */* ]] && dir=${f%/*}
  name=${f##*/}
  case $name in
    package.json) [[ -n $dir ]] && pkg[$dir]=1 ;;
    pom.xml) [[ -n $dir ]] && pom[$dir]=1 ;;
    Dockerfile) [[ -n $dir && ${dir%%/*} == leoiot-* ]] && dockerdir[$dir]=1 ;;
    compose.yaml | compose.yml | docker-compose.yaml | docker-compose.yml)
      composefile[$f]=1
      if [[ -n $dir && $dir != */* && ($dir == legacy || $dir == leoiot-*) ]]; then
        unit[$dir]=1
      fi
      ;;
  esac
done < <(git -c core.quotePath=false ls-files)

# Local dependencies: dependents[<dir>] holds the leoiot-* Node components of
# the same sub-project that depend on <dir> through "file:", space-separated.
declare -A dependents=()
# Read with grep and realpath only: the deployment runs this script on vm23,
# which has no Node.js. A "file:" value appears only as a dependency version.
for d in "${!pkg[@]}"; do
  [[ ${d%%/*} == leoiot-* ]] || continue
  while IFS= read -r spec; do
    dep=$(realpath -m --relative-to=. "$d/${spec#file:}")
    [[ -n ${pkg[$dep]:-} && ${dep%%/*} == "${d%%/*}" ]] || continue
    dependents[$dep]+="$d "
  done < <(grep -oE '"file:[^"]*"' "$d/package.json" | tr -d '"')
done

# The legacy service map: parallel arrays, in file order.
map_prefix=()
map_service=()
while read -r prefix service _; do
  [[ -z $prefix || $prefix == \#* ]] && continue
  [[ -n ${service:-} ]] || die "$map: line for '$prefix' has no service"
  map_prefix+=("$prefix")
  map_service+=("$service")
done <"$map"

# ---- results ----------------------------------------------------------------

declare -A r_node=() r_maven=() r_compose=() r_image=() r_unit=() r_service=()
docs=0
ciscripts=0
nginx=0

add_all_components() {
  docs=1
  ciscripts=1
  local d f
  for d in "${!pkg[@]}"; do r_node[$d]=1; done
  for d in "${!pom[@]}"; do r_maven[$d]=1; done
  for f in "${!composefile[@]}"; do r_compose[$f]=1; done
  for d in "${!dockerdir[@]}"; do r_image[$d]=1; done
}

add_all_legacy_services() {
  local s
  for s in "${map_service[@]}"; do r_service[$s]=1; done
}

# nearest_dockerdir <dir>: the nearest ancestor of <dir> (itself included) with
# a Dockerfile below a leoiot-* folder, or nothing
nearest_dockerdir() {
  local d=$1
  while [[ -n $d && $d == leoiot-* ]]; do
    [[ -n ${dockerdir[$d]:-} ]] && echo "$d" && return
    [[ $d == */* ]] && d=${d%/*} || d=""
  done
}

# add_dependents: check the local dependents of every affected Node component,
# repeated until nothing is added
add_dependents() {
  local added=1 d dep img
  while ((added)); do
    added=0
    for d in "${!r_node[@]}"; do
      for dep in ${dependents[$d]:-}; do
        [[ -n ${r_node[$dep]:-} ]] && continue
        r_node[$dep]=1
        added=1
        img=$(nearest_dockerdir "$dep")
        [[ -n $img ]] && r_image[$img]=1
      done
    done
  done
}

# classify <path>: record what one changed file affects.
classify() {
  local f=$1 dir top d found i prefix
  case $f in
    .github/*)
      add_all_components # shared files: over-run rather than under-run
      return
      ;;
    openspec/*) return ;;
  esac
  if [[ $f != */* ]]; then
    case $f in
      *.md | LICENSE* | .gitignore) return ;;
      astro.config.* | package.json | package-lock.json)
        docs=1
        return
        ;;
    esac
    add_all_components # a root file no rule owns
    return
  fi
  case $f in
    src/* | public/* | asciidocs/* | docs/*)
      docs=1
      return
      ;;
  esac

  top=${f%%/*}
  dir=${f%/*}
  found=0

  # nearest ancestor that is a Node or Maven component
  d=$dir
  while [[ -n $d ]]; do
    if [[ -n ${pkg[$d]:-} || -n ${pom[$d]:-} ]]; then
      [[ -n ${pkg[$d]:-} ]] && r_node[$d]=1
      [[ -n ${pom[$d]:-} ]] && r_maven[$d]=1
      found=1
      break
    fi
    [[ $d == */* ]] && d=${d%/*} || d=""
  done

  # nearest ancestor with a Dockerfile below a leoiot-* folder
  if [[ $top == leoiot-* ]]; then
    d=$dir
    while [[ -n $d ]]; do
      if [[ -n ${dockerdir[$d]:-} ]]; then
        r_image[$d]=1
        found=1
        break
      fi
      [[ $d == */* ]] && d=${d%/*} || d=""
    done
  fi

  # a Compose file is checked itself; a file of a unit that no component owns
  # is covered by the unit's Compose check
  if [[ -n ${composefile[$f]:-} ]]; then
    r_compose[$f]=1
    found=1
    [[ $f == legacy/* ]] && ciscripts=1
  elif [[ -n ${unit[$top]:-} && $found == 0 ]]; then
    for i in "${!composefile[@]}"; do
      [[ ${i%/*} == "$top" && $i != */*/* ]] && r_compose[$i]=1
    done
    found=1
  fi
  # a new legacy app has to be in the service map (checked by the script test)
  [[ $f =~ ^legacy/[^/]+/package\.json$ ]] && ciscripts=1

  # deployment
  if [[ -n ${unit[$top]:-} ]]; then
    r_unit[$top]=1
    found=1
    if [[ $top == legacy ]]; then
      for i in "${!map_prefix[@]}"; do
        prefix=${map_prefix[$i]}
        [[ $prefix == - ]] && continue
        if [[ $prefix == */ ]]; then
          [[ $f == "$prefix"* ]] && r_service[${map_service[$i]}]=1
        else
          [[ $f == "$prefix" ]] && r_service[${map_service[$i]}]=1
        fi
      done
    fi
  fi
  case $f in
    legacy/deploy/nginx.conf) nginx=1 ;;
    leoiot-platform/*) [[ ${f##*/} == nginx*.conf ]] && nginx=1 ;;
  esac

  # A sub-project folder without components, Dockerfile or Compose file has
  # nothing to verify yet. Anything else no rule owns runs everything.
  if [[ $found == 0 && $top != leoiot-* ]]; then
    add_all_components
  fi
}

case $mode in
  range)
    changed=$(git -c core.quotePath=false diff --name-only --no-renames "${positional[0]}" "${positional[1]}" --)
    while IFS= read -r f; do
      [[ -n $f ]] && classify "$f"
    done <<<"$changed"
    add_dependents
    ;;
  files)
    while IFS= read -r f; do
      [[ -n $f ]] && classify "$f"
    done
    add_dependents
    ;;
  all)
    add_all_components
    for d in "${!unit[@]}"; do r_unit[$d]=1; done
    add_all_legacy_services
    nginx=1 # nothing to compare with: the nginx file counts as changed
    ;;
  unit)
    [[ -n ${unit[$unit_arg]:-} ]] || die "unknown unit '$unit_arg' (known: ${!unit[*]})"
    r_unit[$unit_arg]=1
    [[ $unit_arg == legacy ]] && add_all_legacy_services
    ;;
esac

# ---- output -----------------------------------------------------------------

sorted_keys() { # sorted_keys <array name>
  local -n arr=$1
  ((${#arr[@]})) || return 0
  printf '%s\n' "${!arr[@]}" | LC_ALL=C sort
}

flag() { ((${1})) && echo true || echo false; }

if ((json)); then
  json_array() { # json_array <array name>
    local out="" v
    while IFS= read -r v; do
      [[ -z $v ]] && continue
      [[ $v == *[\"\\]* ]] && die "cannot put '$v' into JSON"
      out+="${out:+,}\"$v\""
    done < <(sorted_keys "$1")
    echo "[$out]"
  }
  echo "docs=$(flag "$docs")"
  echo "ci_scripts=$(flag "$ciscripts")"
  echo "node=$(json_array r_node)"
  echo "maven=$(json_array r_maven)"
  echo "compose=$(json_array r_compose)"
  echo "image=$(json_array r_image)"
  exit 0
fi

((docs)) && echo "docs true"
((ciscripts)) && echo "ci-scripts true"
while IFS= read -r v; do [[ -n $v ]] && echo "node $v"; done < <(sorted_keys r_node)
while IFS= read -r v; do [[ -n $v ]] && echo "maven $v"; done < <(sorted_keys r_maven)
while IFS= read -r v; do [[ -n $v ]] && echo "compose $v"; done < <(sorted_keys r_compose)
while IFS= read -r v; do [[ -n $v ]] && echo "image $v"; done < <(sorted_keys r_image)

# units in deployment order: leoiot-platform, legacy, the rest alphabetically
for v in leoiot-platform legacy; do
  [[ -n ${r_unit[$v]:-} ]] && echo "unit $v"
done
while IFS= read -r v; do
  [[ -n $v && $v != leoiot-platform && $v != legacy ]] && echo "unit $v"
done < <(sorted_keys r_unit)

# services in map order
declare -A seen=()
for v in "${map_service[@]}"; do
  if [[ -n ${r_service[$v]:-} && -z ${seen[$v]:-} ]]; then
    seen[$v]=1
    echo "service $v"
  fi
done

((nginx)) && echo "nginx-warning true"
exit 0
