#!/usr/bin/env bash
# Scan packs/ for likely Lucky Block / TNT identifiers and print the exact
# integrations.js config lines to copy in.
#
# Usage:
#   ./tools/detect-ids.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKS_DIR="$REPO_ROOT/packs"

green() { printf '\033[32m%s\033[0m\n' "$*"; }
blue()  { printf '\033[34m%s\033[0m\n' "$*"; }
gray()  { printf '\033[90m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }

if [[ ! -d "$PACKS_DIR" ]]; then
    yellow "No packs/ directory yet — install some addons first via tools/install-mcaddon.sh"
    exit 0
fi

PACKS_DIR="$PACKS_DIR" python3 - <<'PY'
import json, os, re
from pathlib import Path

packs_dir = Path(os.environ["PACKS_DIR"])

ANSI = {
    "blue":   "\033[34m",
    "green":  "\033[32m",
    "yellow": "\033[33m",
    "gray":   "\033[90m",
    "reset":  "\033[0m",
}
def color(c, s): return f"{ANSI[c]}{s}{ANSI['reset']}"

# Collect all (identifier, source_file) tuples from blocks/ and items/ JSONs
candidates = []
for json_path in packs_dir.glob("*/blocks/*.json"):
    try:
        data = json.loads(json_path.read_text())
        ident = data.get("minecraft:block", {}).get("description", {}).get("identifier")
        if ident: candidates.append(("block", ident, json_path))
    except (json.JSONDecodeError, OSError):
        pass

for json_path in packs_dir.glob("*/items/*.json"):
    try:
        data = json.loads(json_path.read_text())
        ident = data.get("minecraft:item", {}).get("description", {}).get("identifier")
        if ident: candidates.append(("item", ident, json_path))
    except (json.JSONDecodeError, OSError):
        pass

if not candidates:
    print(color("yellow", "No block/item identifiers found in packs/. Did you run install-mcaddon.sh?"))
    raise SystemExit(0)

# Heuristics
def is_lucky(ident): return "lucky" in ident.lower()
def is_tnt(ident):
    low = ident.lower()
    if "minecraft:tnt" == low: return False  # vanilla
    return "tnt" in low

# Score TNT IDs — kid-friendly preferences float to top
def tnt_kindness_score(ident):
    low = ident.lower()
    score = 0
    for nice in ("pink", "confetti", "party", "fireworks", "rainbow", "trolling", "fake", "harmless"):
        if nice in low: score += 10
    for scary in ("nuclear", "atomic", "extreme", "hyper", "destruction", "destroyer"):
        if scary in low: score -= 5
    return -score  # for sorting ascending

lucky_blocks = [c for c in candidates if c[0] == "block" and is_lucky(c[1])]
tnt_items    = [c for c in candidates if is_tnt(c[1])]
tnt_items.sort(key=lambda c: tnt_kindness_score(c[1]))

# Print Lucky Block findings
print(color("blue", "→ Lucky Block candidates:"))
if not lucky_blocks:
    print(color("gray", "  (none found — make sure you've installed a Lucky Block addon)"))
else:
    for kind, ident, path in lucky_blocks:
        rel = path.relative_to(packs_dir.parent)
        print(f"  {color('green', ident)}  {color('gray', f'(from {rel})')}")

print()

# Print TNT findings
print(color("blue", "→ Custom TNT candidates (kid-friendly first):"))
if not tnt_items:
    print(color("gray", "  (none found — make sure you've installed a TNT addon)"))
else:
    for kind, ident, path in tnt_items[:10]:
        rel = path.relative_to(packs_dir.parent)
        print(f"  {color('green', ident)}  {color('gray', f'(from {rel})')}")

if not lucky_blocks and not tnt_items:
    raise SystemExit(0)

# Print suggested integrations.js snippet
print()
print(color("blue", "→ Suggested skyblock_bp/scripts/integrations.js snippet:"))
print()
print(color("gray", "// Copy these into the INTEGRATIONS object:"))
print()

if lucky_blocks:
    pick = lucky_blocks[0][1]
    print(f"    luckyBlock: {{")
    print(f"        blockId:     {color('green', repr(pick))},")
    print(f"        itemId:      {color('green', repr(pick))},")
    print(f"        chestChance: 0.10,")
    print(f"        questTarget: 1")
    print(f"    }},")
    print()

if tnt_items:
    pick = tnt_items[0][1]
    nice_name = pick.split(":")[-1].replace("_", " ").title()
    print(f"    funTnt: {{")
    print(f"        itemId:      {color('green', repr(pick))},")
    print(f"        displayName: {color('green', repr(nice_name))},")
    print(f"        chestChance: 0.08,")
    print(f"        count:       4,")
    print(f"        questTarget: 3")
    print(f"    }}")
    print()

print(color("gray", "Then run ./deploy.sh again and your bonus chests will start dropping these."))
PY
