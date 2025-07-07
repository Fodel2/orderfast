#!/usr/bin/env bash
set -e

# Install dependencies if node_modules is missing
if [ ! -d node_modules ]; then
  echo "Installing npm dependencies..."
  npm install
else
  echo "Dependencies already installed"
fi

PREVIEW_URL="http://localhost:3000"

echo "\nStarting Next.js dev server on $PREVIEW_URL"
# Use exec to hand off to npm so signals are handled correctly
exec npm run dev
