#!/usr/bin/env bash
# Garage 2007 — E2E start script
# Usage: ./scripts/e2e-start.sh
# Prereqs: docker, node, npm, ngrok (or cloudflared)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT/garage-2007-backend"
FRONTEND_DIR="$ROOT/garage-2007-frontend"
ENV_FILE="$BACKEND_DIR/.env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PIDS=()
TUNNEL_URL=""
TUNNEL_TOOL=""

log()     { echo -e "${CYAN}[e2e]${NC} $*"; }
ok()      { echo -e "${GREEN}[ok]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
err()     { echo -e "${RED}[error]${NC} $*" >&2; }
section() { echo -e "\n${BOLD}$*${NC}"; }

cleanup() {
  echo ""
  warn "Stopping all processes..."
  for pid in "${PIDS[@]+"${PIDS[@]}"}"; do
    kill "$pid" 2>/dev/null || true
  done
  if [[ -n "$TUNNEL_TOOL" ]]; then
    pkill -f "$TUNNEL_TOOL" 2>/dev/null || true
  fi
  ok "Stopped."
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

wait_for() {
  local name="$1" cmd="$2" max="${3:-30}"
  echo -n "  Waiting for $name"
  for _ in $(seq 1 "$max"); do
    if eval "$cmd" &>/dev/null; then
      echo -e " ${GREEN}ready!${NC}"
      return 0
    fi
    echo -n "."
    sleep 1
  done
  echo -e " ${RED}timeout!${NC}"
  return 1
}

check_var() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    err "$var is not set in $ENV_FILE"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Step 1: Prerequisites
# ---------------------------------------------------------------------------

section "1. Checking prerequisites..."

MISSING=()
for cmd in docker node npm; do
  command -v "$cmd" &>/dev/null || MISSING+=("$cmd")
done

# Prefer cloudflared: no browser interstitial warning (ngrok free shows it in Telegram WebView)
if command -v cloudflared &>/dev/null; then
  TUNNEL_TOOL="cloudflared"
elif command -v ngrok &>/dev/null; then
  TUNNEL_TOOL="ngrok"
  warn "Using ngrok (free tier shows interstitial page in Telegram WebView)"
  warn "Prefer cloudflared: brew install cloudflared"
else
  MISSING+=("cloudflared or ngrok")
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  err "Missing prerequisites: ${MISSING[*]}"
  err "Install missing tools and try again."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  err "$ENV_FILE not found."
  err "Copy $BACKEND_DIR/.env.example to $ENV_FILE and fill in your values."
  exit 1
fi

ok "Using tunnel tool: $TUNNEL_TOOL"

# ---------------------------------------------------------------------------
# Step 2: Load .env
# ---------------------------------------------------------------------------

section "2. Loading environment..."
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

for var in BOT_TOKEN WEBHOOK_SECRET JWT_SECRET DATABASE_URL; do
  check_var "$var"
done

ok "Environment loaded."

# ---------------------------------------------------------------------------
# Step 3: Docker PostgreSQL
# ---------------------------------------------------------------------------

section "3. Starting PostgreSQL..."
(cd "$BACKEND_DIR" && docker compose up -d)

wait_for "postgres" \
  "cd '$BACKEND_DIR' && docker compose exec -T postgres pg_isready -q" \
  30

# ---------------------------------------------------------------------------
# Step 4: DB push
# ---------------------------------------------------------------------------

section "4. Installing dependencies..."
(cd "$BACKEND_DIR" && npm install --silent)
(cd "$FRONTEND_DIR" && npm install --silent)
ok "Dependencies installed."

section "5. Running db:push..."
(cd "$BACKEND_DIR" && npm run db:push)
ok "Schema up to date."

# ---------------------------------------------------------------------------
# Step 6: Backend
# ---------------------------------------------------------------------------

section "6. Starting backend (port 3001)..."
(cd "$BACKEND_DIR" && npm run dev) &>/tmp/garage-backend.log &
PIDS+=($!)

wait_for "backend" \
  "curl -sf http://localhost:3001/api/health" \
  40 || {
  err "Backend failed to start. Check /tmp/garage-backend.log:"
  tail -20 /tmp/garage-backend.log >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Step 7: Frontend
# ---------------------------------------------------------------------------

section "7. Starting frontend (port 5173)..."
(cd "$FRONTEND_DIR" && npm run dev) &>/tmp/garage-frontend.log &
PIDS+=($!)

wait_for "frontend" \
  "curl -sf http://localhost:5173 -o /dev/null" \
  40 || {
  err "Frontend failed to start. Check /tmp/garage-frontend.log:"
  tail -20 /tmp/garage-frontend.log >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Step 8: Tunnel
# ---------------------------------------------------------------------------

section "8. Starting $TUNNEL_TOOL tunnel → port 5173..."

if [[ "$TUNNEL_TOOL" == "ngrok" ]]; then
  ngrok http 5173 --log=stdout &>/tmp/garage-ngrok.log &
  PIDS+=($!)

  wait_for "ngrok API" \
    "curl -sf http://localhost:4040/api/tunnels | grep -q 'public_url'" \
    30 || {
    err "ngrok failed. Check /tmp/garage-ngrok.log"
    exit 1
  }

  TUNNEL_URL=$(curl -sf http://localhost:4040/api/tunnels | \
    node -e "
      let d = '';
      process.stdin.on('data', c => d += c);
      process.stdin.on('end', () => {
        const t = JSON.parse(d).tunnels;
        const h = t.find(x => x.proto === 'https');
        process.stdout.write(h ? h.public_url : '');
      });
    ")

else
  # cloudflared — use http2 (TCP) instead of default QUIC to avoid NAT/firewall drops
  cloudflared tunnel --url http://localhost:5173 --protocol http2 &>/tmp/garage-ngrok.log &
  PIDS+=($!)

  echo -n "  Waiting for cloudflared URL"
  for _ in $(seq 1 60); do
    TUNNEL_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' \
      /tmp/garage-ngrok.log 2>/dev/null | head -1 || true)
    if [[ -n "$TUNNEL_URL" ]]; then
      echo -e " ${GREEN}URL found!${NC}"
      break
    fi
    echo -n "."
    sleep 1
  done

  if [[ -z "$TUNNEL_URL" ]]; then
    err "cloudflared failed to get URL. Check /tmp/garage-ngrok.log"
    exit 1
  fi

  # Wait for cloudflared to register a connection to Cloudflare edge
  wait_for "cloudflared connection" \
    "grep -q 'Registered tunnel connection' /tmp/garage-ngrok.log" \
    30 || {
    err "cloudflared could not connect to Cloudflare edge. Check /tmp/garage-ngrok.log"
    exit 1
  }
fi

ok "Tunnel: $TUNNEL_URL"

# ---------------------------------------------------------------------------
# Step 9: Set Telegram webhook
# ---------------------------------------------------------------------------

section "9. Setting Telegram webhook..."
WEBHOOK_URL="${TUNNEL_URL}/api/purchase/webhook"

RESULT=$(curl -sf "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WEBHOOK_URL}" \
  -d "secret_token=${WEBHOOK_SECRET}" \
  -d 'allowed_updates=["message","pre_checkout_query"]' || true)

if echo "$RESULT" | grep -q '"ok":true'; then
  ok "Webhook set: $WEBHOOK_URL"
else
  warn "Webhook response: $RESULT"
  warn "You may need to set it manually (check your BOT_TOKEN)."
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

echo ""
echo -e "${BOLD}${GREEN}=== Garage 2007 E2E Ready ===${NC}"
echo ""
echo -e "  Backend:  ${CYAN}http://localhost:3001${NC}"
echo -e "  Frontend: ${CYAN}${TUNNEL_URL}${NC}"
echo -e "  Webhook:  ${CYAN}${WEBHOOK_URL}${NC}"
echo ""
echo -e "${YELLOW}Next step:${NC} Update your bot's Mini App URL in @BotFather:"
echo -e "  ${BOLD}${TUNNEL_URL}${NC}"
echo ""
echo -e "Logs:"
echo -e "  Backend:  /tmp/garage-backend.log"
echo -e "  Frontend: /tmp/garage-frontend.log"
echo -e "  Tunnel:   /tmp/garage-ngrok.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services.${NC}"
echo ""

# Keep alive until Ctrl+C
wait
