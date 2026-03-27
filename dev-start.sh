#!/usr/bin/env bash
# ------------------------------------------------------------
# dev-start.sh — Set up and start the TrainerApp dev environment
#
# Usage:  ./dev-start.sh
# Run from the directory CONTAINING trainer-app-v1.5.0/
#
# What it does:
#   1. Copies .env into the backend
#   2. pnpm install
#   3. pnpm approve-builds (auto-selects argon2 + esbuild, confirms)
#   4. pnpm lint
#   5. pnpm typecheck
#   6. pnpm dev
# ------------------------------------------------------------

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # no colour

log()  { echo -e "${GREEN}[dev-start]${NC} $*"; }
warn() { echo -e "${YELLOW}[dev-start]${NC} $*"; }
die()  { echo -e "${RED}[dev-start] ERROR:${NC} $*" >&2; exit 1; }

# ── Step 1: Copy .env ─────────────────────────────────────────────────────────
log "Copying .env → trainer-app-v1.5.0/apps/backend/.env"

[[ -f ".env" ]] || die ".env not found in current directory ($(pwd))"
[[ -d "trainer-app-v1.5.0/apps/backend" ]] || die "trainer-app-v1.5.0/apps/backend not found — run this script from the directory containing trainer-app-v1.5.0/"

cp ./.env trainer-app-v1.5.0/apps/backend/.env
log ".env copied"

# ── Move into the project ─────────────────────────────────────────────────────
cd trainer-app-v1.5.0

# ── Step 2: pnpm install ──────────────────────────────────────────────────────
log "Running pnpm install..."
pnpm install

# ── Step 3: pnpm approve-builds (automated) ──────────────────────────────────
log "Running pnpm approve-builds (auto-selecting argon2 + esbuild)..."

# approve-builds presents two interactive prompts:
#   1. A checkbox list — we send space to toggle argon2, down+space for esbuild, then enter
#   2. "Do you approve?" — we send 'y'
#
# The expect-style input: argon2 is typically first, esbuild second.
# We select both with space, navigate with arrow keys, then confirm.

# Check if 'expect' is available for cleaner interaction
if command -v expect &>/dev/null; then
  expect -c '
    set timeout 30
    spawn pnpm approve-builds
    # Wait for the checkbox prompt
    expect "Choose which packages"
    # Select first item (argon2) — already highlighted, press space
    send " "
    # Move down to next item (esbuild) and select it
    send "\033\[B"
    send " "
    # Confirm selection
    send "\r"
    # Answer approval prompt
    expect "Do you approve"
    send "y\r"
    # Wait for completion
    expect eof
    catch wait result
    exit [lindex $result 3]
  '
else
  # Fallback: pipe the interactive responses via printf
  # Space selects item 1, down-arrow+space selects item 2, enter confirms, y approves
  warn "'expect' not found — using printf fallback for approve-builds"
  printf ' \033[B \n y\n' | pnpm approve-builds || true
fi

# ── Step 4: pnpm install (second pass after approval) ────────────────────────
log "Re-running pnpm install after build approval..."
pnpm install

# ── Step 5: pnpm lint ─────────────────────────────────────────────────────────
log "Running pnpm lint..."
pnpm -r lint

# ── Step 6: pnpm typecheck ────────────────────────────────────────────────────
log "Running pnpm typecheck..."
pnpm -r typecheck

# ── Step 7: pnpm dev ──────────────────────────────────────────────────────────
log "Starting dev server..."
pnpm dev
