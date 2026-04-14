#!/usr/bin/env bash
set -euo pipefail
#
# Install language runtimes for the Piston code execution engine.
#
# Prerequisites:
#   docker compose -f piston-compose.yml up -d
#
# Usage:
#   bash scripts/setup-piston.sh
#
# Environment variables (optional):
#   PISTON_URL       — API base URL  (default: http://localhost:2000)
#   PISTON_CONTAINER — container name (default: piston)
#

PISTON_URL="${PISTON_URL:-http://localhost:2000}"
CONTAINER="${PISTON_CONTAINER:-piston}"

# ── Wait for Piston API ──────────────────────────────────────────────────────
echo "⏳ Waiting for Piston at $PISTON_URL ..."
for i in $(seq 1 30); do
  if curl -sf "$PISTON_URL/api/v2/runtimes" > /dev/null 2>&1; then
    echo "✅ Piston is ready!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌ Timed out waiting for Piston. Is the container running?"
    echo "   Try: docker compose -f piston-compose.yml up -d"
    exit 1
  fi
  sleep 2
done
echo ""

# ── Install language packages ────────────────────────────────────────────────
# Piston installs runtimes via its CLI tool inside the container.
# Add or remove languages here as needed.

install_lang() {
  local lang="$1"
  local version="$2"
  echo "📦 Installing $lang $version ..."
  if docker exec "$CONTAINER" /piston/cli/index.js ppman install "$lang" "$version" 2>&1; then
    echo "   ✅ $lang $version installed"
  else
    echo "   ⚠️  Could not install $lang $version (may already exist or version unavailable)"
  fi
  echo ""
}

# ── Core languages (match JUDGE0_ID_TO_PISTON_LANG in src/lib/piston.ts) ─────
install_lang python    3.12.0
install_lang node      20.11.1     # JavaScript
install_lang gcc       12.2.0      # C and C++
install_lang java      15.0.2
install_lang typescript 5.0.3

# ── Optional languages ───────────────────────────────────────────────────────
# Uncomment any you need:
# install_lang csharp   6.12.0
# install_lang go       1.16.2
# install_lang rust     1.68.2
# install_lang kotlin   1.8.20
# install_lang ruby     3.2.3
# install_lang php      8.2.3
# install_lang bash     5.2.0
# install_lang swift    5.3.3

# ── Verify ───────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════"
echo "🔍 Installed runtimes:"
echo ""
curl -sf "$PISTON_URL/api/v2/runtimes" | python3 -m json.tool 2>/dev/null || \
  curl -sf "$PISTON_URL/api/v2/runtimes"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Piston setup complete!"
echo "   API:  $PISTON_URL"
echo "   Docs: $PISTON_URL/api/v2/runtimes"
echo ""
echo "Set PISTON_BASE=$PISTON_URL in .env.local and restart the Next.js dev server."
