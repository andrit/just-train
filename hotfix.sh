#!/bin/bash
# ------------------------------------------------------------
# hotfix.sh — Commit and push without tagging
#
# Use for bug fixes and corrections between versioned releases.
# For versioned releases use release.sh instead.
#
# USAGE:
#   ./hotfix.sh "fix: restore catch blocks in sessions.ts"
# ------------------------------------------------------------

set -e

MESSAGE=$1

if [ -z "$MESSAGE" ]; then
  echo "Usage: ./hotfix.sh <message>"
  echo "Example: ./hotfix.sh \"fix: restore catch blocks in sessions.ts\""
  exit 1
fi

git add .
git commit -m "$MESSAGE"
git push origin main

echo ""
echo "✓ Pushed hotfix"
echo "  Commit: $(git rev-parse --short HEAD)"
