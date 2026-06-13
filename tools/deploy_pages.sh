#!/bin/sh
# Publish the built game to the live site:
#   github.com/DevinGalvin/nbpt-living  →  https://devingalvin.github.io/nbpt-living/
# Usage: npm run deploy   (builds, then pushes dist/ to the Pages repo)
set -e
cd "$(dirname "$0")/.."
npm run share

D=/tmp/nbpt-pages-live
rm -rf "$D"
git clone -q --depth 1 https://github.com/DevinGalvin/nbpt-living "$D"
rsync -a --delete --exclude .git --exclude README.md --exclude .nojekyll dist/ "$D"/
cd "$D"
git add -A
if git diff --cached --quiet; then
  echo "no changes to deploy"
  exit 0
fi
git -c user.name="Devin Galvin" -c user.email="DevinGalvin@users.noreply.github.com" \
    commit -qm "deploy $(date '+%Y-%m-%d %H:%M')"
git -c credential.helper="!gh auth git-credential" push -q
echo "deployed — live in ~30s at https://devingalvin.github.io/nbpt-living/"
