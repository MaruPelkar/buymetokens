#!/bin/sh
set -e

# Install Linux-native node_modules on first boot (or when package.json changes).
#
# The /app/node_modules directory is an anonymous Docker volume — it persists
# between restarts but starts empty on the very first run. A stamp file tracks
# whether npm ci has already been run against the current package.json.
if [ ! -f node_modules/.install-stamp ] || \
   [ package.json -nt node_modules/.install-stamp ] || \
   [ package-lock.json -nt node_modules/.install-stamp ]; then
  echo "[entrypoint] Installing dependencies (first boot or package.json changed)..."
  npm ci
  touch node_modules/.install-stamp
  echo "[entrypoint] Done."
fi

echo "[entrypoint] Starting Next.js dev server..."
# exec replaces the shell process so Docker signals (SIGTERM) reach Node directly
exec npm run dev
