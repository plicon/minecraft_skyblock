#!/usr/bin/env bash
# Deploy skyblock_bp to a Bedrock Dedicated Server.
#
# Reads the pack UUID and version from skyblock_bp/manifest.json, syncs the
# pack folder into <BDS>/behavior_packs/, and (idempotently) updates the
# world's world_behavior_packs.json so the server actually loads it.
#
# Usage:
#   ./deploy.sh <bds_root> <world_name>
#   BDS_ROOT=/path/to/bds WORLD_NAME=Skyblock ./deploy.sh
#
# Examples:
#   ./deploy.sh ~/bedrock_server Skyblock
#   ./deploy.sh /opt/bds MyWorld
#
# For a remote server, deploy locally first to a staging dir then rsync,
# or run this script directly on the server. There is no built-in SSH mode.

set -euo pipefail

BDS_ROOT="${BDS_ROOT:-${1:-}}"
WORLD_NAME="${WORLD_NAME:-${2:-}}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACK_SRC="$REPO_ROOT/skyblock_bp"

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

Required tools: bash, rsync, python3 (all standard on macOS/Linux).
USAGE
    exit 1
fi

# --- Sanity checks ---
[[ -d "$PACK_SRC"                 ]] || die "pack source not found: $PACK_SRC"
[[ -f "$PACK_SRC/manifest.json"   ]] || die "manifest.json missing in $PACK_SRC"
[[ -d "$BDS_ROOT"                 ]] || die "BDS_ROOT does not exist: $BDS_ROOT"
[[ -d "$BDS_ROOT/behavior_packs"  ]] || die "$BDS_ROOT/behavior_packs not found — is this a valid BDS install?"
[[ -d "$BDS_ROOT/worlds/$WORLD_NAME" ]] || die "world not found: $BDS_ROOT/worlds/$WORLD_NAME"

command -v rsync   >/dev/null || die "rsync not installed"
command -v python3 >/dev/null || die "python3 not installed"

# --- Read manifest ---
read -r PACK_UUID PACK_VER < <(python3 - <<PY
import json
m = json.load(open("$PACK_SRC/manifest.json"))
print(m["header"]["uuid"], ".".join(str(x) for x in m["header"]["version"]))
PY
)

blue "→ Pack:    $PACK_UUID v$PACK_VER"
blue "→ Source:  $PACK_SRC"
blue "→ BDS:     $BDS_ROOT"
blue "→ World:   $WORLD_NAME"
echo

# --- 1. Sync pack folder ---
TARGET="$BDS_ROOT/behavior_packs/skyblock_bp"
gray "[1/2] Syncing pack to $TARGET ..."
mkdir -p "$TARGET"
rsync -a --delete \
    --exclude='.DS_Store' \
    --exclude='.git' \
    "$PACK_SRC/" "$TARGET/"
green "      synced."

# --- 2. Update world_behavior_packs.json ---
WBP="$BDS_ROOT/worlds/$WORLD_NAME/world_behavior_packs.json"
gray "[2/2] Updating $WBP ..."

PACK_UUID="$PACK_UUID" PACK_VER="$PACK_VER" WBP="$WBP" python3 - <<'PY'
import json, os, sys

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

green "      done."

echo
green "✓ Deployment complete."
gray  "  Restart your BDS server to load the updated pack."
gray  "  Look for: [Scripting] [Skyblock] Addon loaded successfully."
