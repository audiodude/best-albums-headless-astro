#!/usr/bin/env bash
# Deploy the Gemini capsule. GEM_USER and GEM_HOST are passed per-invocation;
# the host is reached via the existing passwordless ~/.ssh/config alias.
#   GEM_USER=<user> GEM_HOST=<host> npm run deploy:gem
# GEM_PATH defaults to the legacy capsule directory.
set -euo pipefail

if [[ -z "${GEM_USER:-}" || -z "${GEM_HOST:-}" ]]; then
  echo 'Set GEM_USER and GEM_HOST env vars (host resolved via ~/.ssh/config).' >&2
  exit 1
fi
GEM_PATH="${GEM_PATH:-/var/gem/best-albums}"

npm run build:gem
rsync -az --delete _gem/ "$GEM_USER@$GEM_HOST:$GEM_PATH/"
echo "Deployed _gem/ -> $GEM_USER@$GEM_HOST:$GEM_PATH/"
