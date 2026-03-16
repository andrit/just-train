#!/bin/bash
# ------------------------------------------------------------
# release.sh — Commit, tag, and push a versioned release
#
# USAGE:
#   ./release.sh v1.5.1 "feat: UX event side effects"
#
# WHAT IT DOES:
#   1. Stages all changes
#   2. Creates a commit with the provided message
#   3. Tags the commit with the version
#   4. Pushes commit and tag to origin/main
#
# WORKFLOW:
#   1. I deliver a new zip (e.g. TrainerApp-v1.5.1.zip)
#   2. You unzip over the repo: unzip -o TrainerApp-v1.5.1.zip -d .
#   3. Run: ./release.sh v1.5.1 "feat: UX event side effects"
#   4. GitHub Actions CI runs automatically on push
# ------------------------------------------------------------

set -e  # Exit on any error

VERSION=$1
MESSAGE=$2

if [ -z "$VERSION" ] || [ -z "$MESSAGE" ]; then
  echo "Usage: ./release.sh <version> <message>"
  echo "Example: ./release.sh v1.5.1 \"feat: UX event side effects\""
  exit 1
fi

# Validate version format
if ! echo "$VERSION" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must be in format vX.Y.Z (e.g. v1.5.1)"
  exit 1
fi

echo "Releasing $VERSION..."

git add .
git commit -m "$MESSAGE"
git tag "$VERSION" -m "$VERSION"
git push origin main --tags

echo ""
echo "✓ Released $VERSION"
echo "  Commit: $(git rev-parse --short HEAD)"
echo "  Tag:    $VERSION"
echo "  CI:     https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//')/actions"
