#!/usr/bin/env bash
# Unzip a downloaded .mcaddon (or .mcpack) file into ./packs/ so deploy.sh
# can pick it up. Auto-detects nested BP/RP folder structure.
#
# Usage:
#   ./tools/install-mcaddon.sh ~/Downloads/lucky_blocks.mcaddon
#   ./tools/install-mcaddon.sh "~/Downloads/TNT Addon (1.21.120).mcaddon"

set -euo pipefail

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
blue()  { printf '\033[34m%s\033[0m\n' "$*"; }
gray()  { printf '\033[90m%s\033[0m\n' "$*"; }

die() { red "ERROR: $*"; exit 1; }

[[ $# -ge 1 ]] || die "Usage: $0 <path-to-.mcaddon-or-.mcpack>"

INPUT="$1"
[[ -f "$INPUT" ]] || die "file not found: $INPUT"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKS_DIR="$REPO_ROOT/packs"
mkdir -p "$PACKS_DIR"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

blue "→ Extracting $INPUT ..."
# .mcaddon and .mcpack are just zip files
if ! unzip -q "$INPUT" -d "$TMP" 2>/dev/null; then
    # Try renaming to .zip first (some tools refuse non-.zip extensions)
    cp "$INPUT" "$TMP/__source.zip"
    unzip -q "$TMP/__source.zip" -d "$TMP" || die "unzip failed — is this a valid .mcaddon/.mcpack/.zip?"
    rm "$TMP/__source.zip"
fi

# Walk the extracted tree: every folder that contains a manifest.json IS a pack.
# .mcaddon often has multiple top-level folders (BP + RP). .mcpack has one pack.
pack_count=0
while IFS= read -r -d '' manifest; do
    pack_dir="$(dirname "$manifest")"
    pack_count=$((pack_count + 1))

    # Read pack info to determine name + type
    info=$(MANIFEST="$manifest" python3 - <<'PY'
import json, os, re
m = json.load(open(os.environ["MANIFEST"]))
name = m["header"].get("name", "unnamed")
types = [mod.get("type") for mod in m.get("modules", [])]
has_bp = any(t in ("data", "script") for t in types)
has_rp = "resources" in types
kind = "rp" if (has_rp and not has_bp) else "bp"
# Sanitize name → lowercase, strip non-alnum, strip redundant trailing _bp/_rp
slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "pack"
slug = re.sub(r"_(bp|rp)$", "", slug)
print(f"{slug}|{kind}|{name}")
PY
)
    IFS='|' read -r slug kind display_name <<< "$info"
    target="$PACKS_DIR/${slug}_${kind}"

    # Avoid clobbering an existing different pack with the same slug
    if [[ -d "$target" ]]; then
        gray "  replacing existing $target"
        rm -rf "$target"
    fi
    mkdir -p "$target"
    # Copy the entire pack folder contents
    cp -R "$pack_dir/." "$target/"
    green "  installed: $display_name → packs/${slug}_${kind}/"
done < <(find "$TMP" -name "manifest.json" -not -name "__source*" -print0)

if (( pack_count == 0 )); then
    die "no manifest.json found in archive — is this really a Bedrock addon?"
fi

echo
green "✓ Done. Found and installed $pack_count pack(s)."
gray "  Next: run ./tools/detect-ids.sh to find Lucky Block / TNT item IDs."
gray "  Then:  ./deploy.sh /path/to/bds Skyblock"
