#!/usr/bin/env bash
# Installs or updates Unyoke on a VPS that already runs Caddy. Run as root:
#   bash <(curl -fsSL https://raw.githubusercontent.com/phoenix-2203/unyoke/main/deploy/setup.sh)
# Optional: a different DuckDNS name, e.g.  ... setup.sh) myunyoke
#
# Unyoke is a static site: no server process, no keys, no database. Caddy serves
# the built files and forwards read-only /lcd-testnet requests to the chain's REST API.
# Other sites on this server are left alone: the Caddy config is checked before
# reloading, and the change is undone if the check fails.
set -euo pipefail
NAME="${1:-unyoke}"
DOMAIN="${NAME%.duckdns.org}.duckdns.org"
DIR=/opt/unyoke
SITE=/etc/caddy/unyoke.caddy
MAIN=/etc/caddy/Caddyfile

[ "$(uname -s)" = "Linux" ] || { echo "Log in to the server first (ssh), then run this there."; exit 1; }
[ "$(id -u)" = "0" ] || { echo "Run this as root on the server (for example: sudo -i, then run it again)."; exit 1; }
command -v caddy >/dev/null || { echo "Caddy isn't installed. See https://caddyserver.com/docs/install"; exit 1; }
[ -f "$MAIN" ] || { echo "No $MAIN found. Is Caddy set up as a system service?"; exit 1; }
command -v node >/dev/null || { echo "Node.js 20+ is needed: https://nodejs.org"; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || { echo "Node.js 20+ is needed"; exit 1; }

if [ ! -d "$DIR/.git" ]; then
  git clone https://github.com/phoenix-2203/unyoke "$DIR"
else
  git -C "$DIR" pull --ff-only
fi

echo "Building (uses up to 3 GB of memory)…"
cd "$DIR"
PNPM="npx -y pnpm@10"
command -v pnpm >/dev/null && PNPM=pnpm
$PNPM install --frozen-lockfile
NODE_OPTIONS=--max-old-space-size=3072 $PNPM build
chmod -R a+rX "$DIR/dist"

echo "Configuring Caddy for https://$DOMAIN …"
sed "s/^unyoke\.duckdns\.org {/$DOMAIN {/" "$DIR/deploy/Caddyfile" > "$SITE"
cp "$MAIN" "$MAIN.bak-unyoke"
grep -qxF "import $SITE" "$MAIN" || printf '\nimport %s\n' "$SITE" >> "$MAIN"
if ! caddy validate --config "$MAIN" --adapter caddyfile >/dev/null 2>&1; then
  cp "$MAIN.bak-unyoke" "$MAIN"
  echo "Caddy rejected the new config, so nothing was changed. Details:"
  caddy validate --config "$MAIN" --adapter caddyfile || true
  exit 1
fi
systemctl reload caddy

echo
echo "Done. Unyoke is at https://$DOMAIN (the HTTPS certificate can take a minute the first time)."
echo "To update later, run this script again."
