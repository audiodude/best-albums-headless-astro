#!/usr/bin/env bash
# Deploy the Gemini capsule. GEM_USER and GEM_HOST are passed per-invocation;
# the host is reached via the existing passwordless ~/.ssh/config alias.
#   GEM_USER=<user> GEM_HOST=<host> npm run deploy:gem
# GEM_PATH defaults to the Agate content root for the capsule's hostname.
set -euo pipefail

# Load local .env (gitignored) if present — GEM_USER / GEM_HOST / GEM_PATH.
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi

if [[ -z "${GEM_USER:-}" || -z "${GEM_HOST:-}" ]]; then
  echo 'Set GEM_USER and GEM_HOST (inline env vars or a local .env file).' >&2
  exit 1
fi
GEM_PATH="${GEM_PATH:-/srv/gemini/content/gem.bestalbumsintheuniverse.com}"

npm run build:gem
# GEM_PATH must be writable by GEM_USER. We don't preserve owner/group/perms
# (those caused chgrp/permission errors when the dir was owned by another user);
# --chmod publishes world-readable files for the Gemini daemon. Symbolic modes
# (= D755,F644) because macOS's openrsync rejects the octal D/F syntax.
rsync -rtz --delete --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r _gem/ "$GEM_USER@$GEM_HOST:$GEM_PATH/"
echo "Deployed _gem/ -> $GEM_USER@$GEM_HOST:$GEM_PATH/"
