#!/usr/bin/env bash
# Deploy skyblock_bp + any extra packs to a Bedrock Dedicated Server.
#
# Reads each pack's UUID, version and module types from manifest.json,
# syncs the pack folder into the correct <BDS>/{behavior,resource}_packs/
# directory, and (idempotently) updates the world's
# world_behavior_packs.json and world_resource_packs.json.
#
# Usage:
#   ./deploy.sh <bds_root> <world_name>
#   BDS_ROOT=/path/to/bds WORLD_NAME=Skyblock ./deploy.sh
#
# Extra packs:
#   Drop unzipped addon folders in ./packs/ (each with its own manifest.json).
#   The script auto-detects whether it's a behavior or resource pack by
#   looking at the modules[*].type field, and routes it to the right place.
#
#   Example layout:
#     packs/
#       lucky_block_bp/   (modules: type=data → behavior pack)
#       lucky_block_rp/   (modules: type=resources → resource pack)
#       too_much_tnt_bp/
#       too_much_tnt_rp/

set -euo pipefail

BDS_ROOT="${BDS_ROOT:-${1:-}}"
WORLD_NAME="${WORLD_NAME:-${2:-}}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACK_SRC="$REPO_ROOT/skyblock_bp"
EXTRA_PACKS_DIR="$REPO_ROOT/packs"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
blue()  { printf '\033[34m%s\033[0m\n' "$*"; }
gray()  { printf '\033[90m%s\033[0m\n' "$*"; }

die() { red "ERROR: $*"; exit 1; }

if [[ -z "$BDS_ROOT" || -z "$WORLD_NAME" ]]; then
    cat <<USAGE
Usage:
  $0 <bds_root> <world_name>

  or set environment variables:
  BDS_ROOT=/path/to/bedrock_server WORLD_NAME=Skyblock $0

Optional: drop additional addon folders in ./packs/ — they will be
detected by manifest.json and deployed as behavior or resource packs
automatically.

Required tools: bash, rsync, python3 (all standard on macOS/Linux).
USAGE
    exit 1
fi

# --- Sanity checks ---
[[ -d "$PACK_SRC"                    ]] || die "pack source not found: $PACK_SRC"
[[ -f "$PACK_SRC/manifest.json"      ]] || die "manifest.json missing in $PACK_SRC"
[[ -d "$BDS_ROOT"                    ]] || die "BDS_ROOT does not exist: $BDS_ROOT"
[[ -d "$BDS_ROOT/behavior_packs"     ]] || die "$BDS_ROOT/behavior_packs not found — is this a valid BDS install?"
[[ -d "$BDS_ROOT/worlds/$WORLD_NAME" ]] || die "world not found: $BDS_ROOT/worlds/$WORLD_NAME"

command -v rsync   >/dev/null || die "rsync not installed"
command -v python3 >/dev/null || die "python3 not installed"

# Make sure the resource_packs dir exists (BDS sometimes doesn't pre-create it)
mkdir -p "$BDS_ROOT/resource_packs"

WORLD_DIR="$BDS_ROOT/worlds/$WORLD_NAME"
WBP_FILE="$WORLD_DIR/world_behavior_packs.json"
WRP_FILE="$WORLD_DIR/world_resource_packs.json"

# --- Helper: update a world_*_packs.json idempotently ---
# Args (env): WBP=path, PACK_UUID=uuid, PACK_VER="x.y.z"
update_world_pack_json() {
    PACK_UUID="$1" PACK_VER="$2" WBP="$3" python3 - <<'PY'
import json, os
path = os.environ["WBP"]
uuid = os.environ["PACK_UUID"]
ver  = [int(x) for x in os.environ["PACK_VER"].split(".")]

if os.path.exists(path):
    with open(path) as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"      WARN: existing {path} is invalid JSON, replacing")
            data = []
else:
    data = []

if not isinstance(data, list):
    print(f"      WARN: {path} is not a JSON array, replacing")
    data = []

found = False
for entry in data:
    if isinstance(entry, dict) and entry.get("pack_id") == uuid:
        old = entry.get("version")
        entry["version"] = ver
        found = True
        action = f"version {old} → {ver}" if old != ver else "already current"
        print(f"      updated existing entry ({action})")
        break

if not found:
    data.append({"pack_id": uuid, "version": ver})
    print(f"      added new entry")

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
}

# --- Helper: read UUID, version and pack type (BP/RP) from a manifest.json ---
# Sets globals: PI_UUID, PI_VER, PI_NAME, PI_TARGET (behavior_packs|resource_packs), PI_WORLD_FILE
read_pack_info() {
    local manifest="$1"
    local info
    info=$(MANIFEST="$manifest" python3 - <<'PY'
import json, os
m = json.load(open(os.environ["MANIFEST"]))
uuid = m["header"]["uuid"]
ver  = ".".join(str(x) for x in m["header"]["version"])
name = m["header"].get("name", "unnamed")
types = [mod.get("type") for mod in m.get("modules", [])]
has_bp = any(t in ("data", "script") for t in types)
has_rp = "resources" in types
if has_rp and not has_bp:
    target = "resource_packs"; world_file = "world_resource_packs.json"
elif has_bp:
    target = "behavior_packs"; world_file = "world_behavior_packs.json"
else:
    target = "behavior_packs"; world_file = "world_behavior_packs.json"  # fallback
print(f"{uuid}|{ver}|{name}|{target}|{world_file}")
PY
)
    IFS='|' read -r PI_UUID PI_VER PI_NAME PI_TARGET PI_WORLD_FILE <<< "$info"
}

# --- Helper: deploy a single pack folder ---
# Args: $1 = source dir, $2 = label for logging
deploy_pack() {
    local src="$1"
    local label="$2"
    local sub
    sub=$(basename "$src")

    [[ -f "$src/manifest.json" ]] || { gray "  skip (no manifest.json): $src"; return; }

    read_pack_info "$src/manifest.json"

    local target="$BDS_ROOT/$PI_TARGET/$sub"
    local world_file="$WORLD_DIR/$PI_WORLD_FILE"

    blue "→ $label: $PI_NAME v$PI_VER ($PI_TARGET)"
    gray "  syncing $src → $target ..."
    mkdir -p "$target"
    rsync -a --delete \
        --exclude='.DS_Store' \
        --exclude='.git' \
        "$src/" "$target/"
    gray "  updating $world_file ..."
    update_world_pack_json "$PI_UUID" "$PI_VER" "$world_file"
}

echo
deploy_pack "$PACK_SRC" "Main pack"
echo

# --- Extra packs in ./packs/ ---
if [[ -d "$EXTRA_PACKS_DIR" ]]; then
    shopt -s nullglob
    extra_dirs=("$EXTRA_PACKS_DIR"/*/)
    shopt -u nullglob

    if (( ${#extra_dirs[@]} == 0 )); then
        gray "→ No extra packs found in $EXTRA_PACKS_DIR (drop unzipped addons there to auto-deploy)"
    else
        for pack_dir in "${extra_dirs[@]}"; do
            deploy_pack "${pack_dir%/}" "Extra pack"
            echo
        done
    fi
else
    gray "→ ./packs/ does not exist — skipping extra packs."
    gray "  Create ./packs/ and drop unzipped addons there to auto-deploy them."
fi

green "✓ Deployment complete."
gray  "  Restart your BDS server to load the updated packs."
gray  "  Look for: [Scripting] [Skyblock] Skyblock is geladen!"
