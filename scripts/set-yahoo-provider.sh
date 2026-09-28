#!/usr/bin/env bash
# Point a hosted Supabase project's custom:yahoo provider at the one
# Fantasy-activated Yahoo app, PikachuBball (VZxFFbzH), then confirm the
# project's sign-in redirect uses it. Run by the project owner:
#
#   npm run yahoo:provider -- prod     # Pikachu Basketball
#   npm run yahoo:provider -- dev      # Pikachu Basketball Development
#   npm run yahoo:provider -- prod --check   # only report which app is live
#
# The Yahoo client ID and secret come from YAHOO_CLIENT_ID/YAHOO_CLIENT_SECRET
# in the environment or .env.local. The project's secret key is asked for at
# the prompt and never stored or printed.
set -euo pipefail

cd "$(dirname "$0")/.."

EXPECTED_APP_ID="VZxFFbzH"

case "${1:-}" in
  prod) ref="fpdwtpwpmxsbgjxizuxa"; name="Pikachu Basketball" ;;
  dev) ref="ocqdxmfpezxpgutoicyh"; name="Pikachu Basketball Development" ;;
  *) echo "Usage: $0 prod|dev [--check]" >&2; exit 2 ;;
esac
check_only="${2:-}"
base="https://$ref.supabase.co/auth/v1"

# Yahoo client IDs are base64 of "...&d=<base64 of ai=APPID&pj=0>&s=...".
app_id_of() {
  node -e '
    const id = process.argv[1] ?? "";
    const outer = Buffer.from(id, "base64").toString("latin1");
    const d = /[?&]d=([^&]*)/.exec("&" + outer)?.[1] ?? "";
    const inner = Buffer.from(decodeURIComponent(d), "base64").toString("latin1");
    process.stdout.write(/ai=([^&]*)/.exec(inner)?.[1] ?? "unknown");
  ' "$1"
}

live_app_id() {
  local location
  location=$(curl -s -o /dev/null -w '%{redirect_url}' "$base/authorize?provider=custom:yahoo" || true)
  app_id_of "$(sed -n 's/.*[?&]client_id=\([^&]*\).*/\1/p' <<<"$location")"
}

current=$(live_app_id)
echo "$name ($ref) signs in through Yahoo app: $current"
if [[ "$check_only" == "--check" ]]; then
  [[ "$current" == "$EXPECTED_APP_ID" ]]
  exit
fi
if [[ "$current" == "$EXPECTED_APP_ID" ]]; then
  echo "Already on $EXPECTED_APP_ID. Nothing to change."
  exit 0
fi

read_env_local() {
  [[ -f .env.local ]] || return 0
  sed -n "s/^$1=//p" .env.local | tail -n 1 | sed 's/^["'\'']//; s/["'\'']$//'
}
client_id="${YAHOO_CLIENT_ID:-$(read_env_local YAHOO_CLIENT_ID)}"
client_secret="${YAHOO_CLIENT_SECRET:-$(read_env_local YAHOO_CLIENT_SECRET)}"
if [[ -z "$client_id" || -z "$client_secret" ]]; then
  echo "YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET not found in the environment or .env.local." >&2
  exit 1
fi
if [[ "$(app_id_of "$client_id")" != "$EXPECTED_APP_ID" ]]; then
  echo "YAHOO_CLIENT_ID belongs to Yahoo app $(app_id_of "$client_id"), not $EXPECTED_APP_ID. Stopping." >&2
  exit 1
fi

echo
echo "Paste the $name secret key (starts with sb_secret_)."
echo "  https://supabase.com/dashboard/project/$ref/settings/api-keys"
read -r -s -p "Secret key: " secret_key
echo
[[ -n "$secret_key" ]] || { echo "No key entered." >&2; exit 1; }

auth_headers=(-H "apikey: $secret_key")
# Legacy service_role keys are JWTs and also go in Authorization.
[[ "$secret_key" == ey* ]] && auth_headers+=(-H "Authorization: Bearer $secret_key")

body=$(CLIENT_ID="$client_id" CLIENT_SECRET="$client_secret" node -e '
  process.stdout.write(JSON.stringify({
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
  }));
')

read -r -p "Update custom:yahoo on $name from $current to $EXPECTED_APP_ID? [y/N] " answer
[[ "$answer" == [yY] ]] || { echo "Cancelled."; exit 1; }

status=$(curl -s -o /tmp/set-yahoo-provider.$$ -w '%{http_code}' -X PUT \
  "${auth_headers[@]}" -H "Content-Type: application/json" \
  --data-binary @- "$base/admin/custom-providers/custom:yahoo" <<<"$body")
response=$(node -e '
  const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8") || "{}");
  delete r.client_secret;
  process.stdout.write(JSON.stringify(r));
' /tmp/set-yahoo-provider.$$ 2>/dev/null || cat /tmp/set-yahoo-provider.$$)
rm -f /tmp/set-yahoo-provider.$$
if [[ "$status" != 2* ]]; then
  echo "Supabase returned HTTP $status: $response" >&2
  echo "Fallback: Authentication > Providers > custom:yahoo in the dashboard:" >&2
  echo "  https://supabase.com/dashboard/project/$ref/auth/providers" >&2
  exit 1
fi
echo "Updated (HTTP $status). Waiting for the sign-in redirect to change..."

for _ in $(seq 1 12); do
  current=$(live_app_id)
  if [[ "$current" == "$EXPECTED_APP_ID" ]]; then
    echo "Done: $name now signs in through $EXPECTED_APP_ID."
    echo "Vercel's YAHOO_CLIENT_ID for this tier must end in ...${client_id: -6}."
    exit 0
  fi
  sleep 10
done
echo "The update was accepted, but the redirect still shows $current after 2 minutes." >&2
exit 1
