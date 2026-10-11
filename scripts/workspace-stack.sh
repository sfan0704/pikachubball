# Sourced by the local-stack scripts: this checkout's own Supabase stack and
# ports (scripts/workspace.mts). Every Supabase CLI call goes through `sb`, so
# it targets only this workspace's stack, and nothing is reset unless the
# containers on this workspace's ports are this workspace's.

eval "$(node scripts/workspace.mts --shell)"

# The Supabase CLI against this workspace's generated config, never the shared default stack.
sb() {
  supabase --workdir "$WORKSPACE_SUPABASE_DIR" "$@"
}

# Refuses to go on if a container that isn't this workspace's holds one of its ports.
require_workspace_ports() {
  local port owner
  for port in "$WORKSPACE_SUPABASE_API_PORT" "$WORKSPACE_SUPABASE_DB_PORT"; do
    owner="$(docker ps --filter "publish=$port" --format '{{.Names}}' | head -n 1)"
    if [ -n "$owner" ] && [[ "$owner" != *"_$WORKSPACE_PROJECT_ID" ]]; then
      echo "Port $port belongs to '$owner', not this workspace ($WORKSPACE_PROJECT_ID). Refusing." >&2
      echo "See 'Several workspaces' in the README to clean up." >&2
      exit 1
    fi
  done
}

# Starts this workspace's stack (without the services the app doesn't use) and checks it answers on its own port.
start_workspace_stack() {
  require_workspace_ports
  # A stack left half-started has no API; stop it so `start` brings everything up.
  if sb status -o env >/dev/null 2>&1 && ! sb status -o env | grep -q '^API_URL='; then
    sb stop --no-backup
  fi
  sb start \
    -x studio,imgproxy,mailpit,realtime,storage-api,edge-runtime,logflare,vector,supavisor,postgres-meta
  require_workspace_ports
  case "$(workspace_status API_URL)" in
    "http://127.0.0.1:$WORKSPACE_SUPABASE_API_PORT") ;;
    *) echo "This workspace's stack isn't answering on port $WORKSPACE_SUPABASE_API_PORT. Refusing." >&2; exit 1 ;;
  esac
}

# One value from this workspace's `supabase status`, such as API_URL.
workspace_status() {
  sb status -o env | sed -n "s/^$1=\"\(.*\)\"$/\1/p"
}
