#!/usr/bin/env bash
set -euo pipefail

# Publish extension zips to Cloudflare R2
# Usage: npm run publish

BUCKET="contextbro-app"
VERSION=$(node -p "require('./package.json').version")
CHROME_ZIP=".output/context-bro-${VERSION}-chrome.zip"
FIREFOX_ZIP=".output/context-bro-${VERSION}-firefox.zip"

echo "Publishing Context Bro v${VERSION} to R2..."

# Build and zip
npm run zip
npm run zip:firefox

# Upload versioned files
echo "Uploading Chrome zip..."
npx wrangler r2 object put --remote "${BUCKET}/releases/context-bro-${VERSION}-chrome.zip" \
  --file "${CHROME_ZIP}" \
  --content-type "application/zip"

echo "Uploading Firefox zip..."
npx wrangler r2 object put --remote "${BUCKET}/releases/context-bro-${VERSION}-firefox.zip" \
  --file "${FIREFOX_ZIP}" \
  --content-type "application/zip"

# Upload as "latest" (stable permalink)
echo "Updating latest links..."
npx wrangler r2 object put --remote "${BUCKET}/releases/context-bro-latest-chrome.zip" \
  --file "${CHROME_ZIP}" \
  --content-type "application/zip"

npx wrangler r2 object put --remote "${BUCKET}/releases/context-bro-latest-firefox.zip" \
  --file "${FIREFOX_ZIP}" \
  --content-type "application/zip"

# Upload version manifest
echo "{\"version\":\"${VERSION}\",\"date\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" | \
  npx wrangler r2 object put --remote "${BUCKET}/releases/latest.json" \
  --pipe \
  --content-type "application/json"

echo ""
echo "Published v${VERSION}!"
echo "  Chrome:  https://assets.contextbro.app/releases/context-bro-${VERSION}-chrome.zip"
echo "  Firefox: https://assets.contextbro.app/releases/context-bro-${VERSION}-firefox.zip"
echo "  Latest:  https://assets.contextbro.app/releases/context-bro-latest-chrome.zip"
echo "  Meta:    https://assets.contextbro.app/releases/latest.json"
