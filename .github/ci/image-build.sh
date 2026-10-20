#!/usr/bin/env bash
# Builds the image of one leoiot-* Dockerfile directory the way CI does
# (.github/workflows/ci.yml, job "images"), without pushing it.
# Rules: openspec/changes/platform-ci-build-context, design D1.
#
#   image-build.sh <dir>           docker build of <dir>
#   image-build.sh --print <dir>   print the docker command instead of running it
#
# <dir> is relative to the repository root. The build context is <dir> itself,
# unless <dir>/build-context holds a relative path to an ancestor folder of
# <dir> inside the same leoiot-* folder (for example ".."); the image is then
# built from that folder with <dir>/Dockerfile.
# Exits non-zero, naming the file, when the declared context is not allowed.

set -euo pipefail

die() {
  echo "image-build.sh: $*" >&2
  exit 2
}

print=0
if [[ ${1:-} == --print ]]; then
  print=1
  shift
fi
(($# == 1)) || die "usage: image-build.sh [--print] <dir>"
dir=${1%/}

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(git -C "$script_dir" rev-parse --show-toplevel)
cd "$repo"

[[ $dir == leoiot-*/* || $dir == leoiot-* ]] || die "$dir is not below a leoiot-* folder"
[[ -f $dir/Dockerfile ]] || die "$dir/Dockerfile does not exist"

context=$dir
declaration=$dir/build-context
if [[ -f $declaration ]]; then
  declared=$(grep -vE '^[[:space:]]*(#|$)' "$declaration" | head -n 1 | tr -d '[:space:]')
  [[ -n $declared ]] || die "$declaration is empty"
  [[ $declared != /* ]] || die "$declaration: '$declared' is not a relative path"
  context=$(realpath -m --relative-to=. "$dir/$declared")
  top=${dir%%/*}
  case $context in
    "$top" | "$top"/*) ;;
    *) die "$declaration: '$declared' leads outside $top/" ;;
  esac
  case $dir in
    "$context" | "$context"/*) ;;
    *) die "$declaration: '$declared' is not an ancestor of $dir" ;;
  esac
fi

cmd=(docker build)
[[ $context != "$dir" ]] && cmd+=(-f "$dir/Dockerfile")
cmd+=("$context")
if ((print)); then
  echo "${cmd[*]}"
else
  "${cmd[@]}"
fi
