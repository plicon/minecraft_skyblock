# Daily Bonus Islands + Void Respawn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voeg twee features toe aan het Skyblock-addon: (1) een dagelijkse bonus-eilandgenerator die elke Minecraft-zonsopkomst een nieuw themed eiland aan elke speler geeft, gechaind binnen bouwbare afstand met variërende hoogte; en (2) een void-respawn die spelers terugbrengt naar hun hoofdeiland in plaats van world spawn.

**Architecture:** Pure JavaScript, alleen `@minecraft/server` (1.17.0) en `@minecraft/server-ui` (1.3.0) stable APIs. Persistent state via `world.getDynamicProperty`. 7 themes als data-driven registry (`themes.js`). Day-rollover detection via `system.runInterval` (`daily_islands.js`) die `world.getDay()` checkt vs per-speler opgeslagen `lastDay`. Bonus-eilanden worden geplaatst via een ketting-algoritme (random angle/dist binnen [32-64] blokken van vorige bonus, ±16 Y, max 480 horizontaal van main, retry-on-collision). Void respawn via `/spawnpoint @s` na main-generatie.

**Tech Stack:** Minecraft Bedrock Script API (stable), Bedrock 1.21.x, BDS server. Geen build-step, geen TypeScript, geen test framework — verificatie is handmatig via een running BDS instance volgens spec §8.

**Spec:** [docs/superpowers/specs/2026-05-06-daily-bonus-islands-design.md](../specs/2026-05-06-daily-bonus-islands-design.md)

---

## Notes voor de implementer

- **Bestaande code patterns volgen.** `skyblock_bp/scripts/` heeft een vast patroon: top-of-file comment, imports, constanten met `sb:` prefix, helper functions, exports, event subscribers onderaan. Houd je daaraan.
- **Geen tests.** Het project gebruikt geen test framework (`CLAUDE.md`: "houden simpel"). Verificatie is per-task code review + één eindtest op BDS volgens spec §8.
- **Block IDs:** Bedrock 1.21 gebruikt `minecraft:foo` IDs. Saplings/leaves/logs zijn species-specifiek (`oak_log`, `spruce_leaves` etc). Bij twijfel checken via [bedrock.dev block list](https://bedrock.dev/docs/stable/Blocks).
- **Try/catch pattern:** Bestaande code wraps block-placement in `try {} catch (e) { /* ignore */ }` voor unloaded chunks. Volg dat patroon.
- **Tickingarea pattern:** Main island gebruikt `tickingarea add` + 40-tick delay om chunks geforceerd te laden vóór block-placement. Doe hetzelfde voor bonus eilanden.

---

## File Structure

### Nieuwe bestanden

| Pad | Verantwoordelijkheid |
|---|---|
| `skyblock_bp/scripts/themes.js` | Theme registry (7 themes), `getTheme()`, `pickRandomTheme()`, per-theme `placeFocal` builders, theme color/name/loot data. Pure data + functions, geen events, geen state. |
| `skyblock_bp/scripts/daily_islands.js` | `system.runInterval` die `world.getDay()` rollover detecteert per speler; delegeert generatie aan `island_manager.js#generateBonusIsland`. |

### Gewijzigde bestanden

| Pad | Aard van wijziging |
|---|---|
| `skyblock_bp/scripts/island_manager.js` | `generateIsland` wordt theme- en Y-parametrized. Nieuwe exports: `getMainIsland`, `getBonusIslands`, `appendBonusIsland`, `pickBonusLocation`, `generateBonusIsland`, `getAllIslands`. Spawnpoint zetten na main-generatie + lazy hook in `playerSpawn` subscriber. |
| `skyblock_bp/scripts/main.js` | `import "./daily_islands.js"` toevoegen. |
| `skyblock_bp/scripts/commands.js` | Nieuwe knop "My Islands" in `openMenu`, nieuwe `showIslandList(player)` form-handler met theme-gekleurde labels en teleport-on-click. |
| `skyblock_bp/manifest.json` | `header.version` en `modules[*].version` naar `[1, 1, 0]`. |
| `skyblock_bp/README.md` | Sectie over Daily Bonus Islands + theme-overzicht + Void Respawn toevoegen. |

---

## Task 1: Theme registry (`themes.js`)

**Files:**
- Create: `skyblock_bp/scripts/themes.js`

**Doel:** Pure data-module met 7 themes. Geen runtime side effects bij import. `placeFocal` functies plaatsen het focal-point block (tree/cactus/mushroom/etc) in de NW-hoek van het eiland.

- [ ] **Step 1: Maak `skyblock_bp/scripts/themes.js`**

```js
// Theme Registry
// Pure data + focal-point builders for daily bonus islands.
// Each theme defines surface/sub blocks, a focal point (tree-like structure),
// and a chest loot table. Used by island_manager.js#generateIsland.

import { BlockPermutation } from "@minecraft/server";

function setBlock(dim, x, y, z, id) {
    try {
        dim.getBlock({ x, y, z })?.setPermutation(BlockPermutation.resolve(id));
    } catch (e) { /* chunk not loaded — ignore */ }
}

// Standard "tree" focal: 4-block log column at (x,z) with 3x3x3 leaves canopy.
// Matches the existing oak tree pattern in island_manager.js.
function buildTree(dim, x, y, z, logId, leavesId) {
    for (let i = 1; i <= 4; i++) setBlock(dim, x, y + i, z, logId);
    for (let dx = 0; dx <= 2; dx++) {
        for (let dz = 0; dz <= 2; dz++) {
            for (let dy = 3; dy <= 5; dy++) {
                if (dx === 0 && dz === 0 && dy < 5) continue; // skip log column
                setBlock(dim, x + dx, y + dy, z + dz, leavesId);
            }
        }
    }
}

export const THEMES = {
    forest: {
        id: "forest",
        name: "Forest",
        color: "§a",
        surface: "minecraft:grass_block",
        sub: "minecraft:dirt",
        loot: [
            ["ice", 2], ["lava_bucket", 1], ["bone", 4], ["sapling", 2],
            ["melon_seeds", 1], ["pumpkin_seeds", 1], ["sugar_cane", 1],
            ["cactus", 1], ["wheat_seeds", 2]
        ],
        placeFocal: (dim, x, y, z) => buildTree(dim, x, y, z, "minecraft:oak_log", "minecraft:oak_leaves")
    },
    tundra: {
        id: "tundra",
        name: "Tundra",
        color: "§b",
        surface: "minecraft:snow_block",
        sub: "minecraft:packed_ice",
        loot: [
            ["ice", 4], ["snowball", 8], ["spruce_sapling", 2],
            ["leather", 2], ["beetroot_seeds", 1], ["lava_bucket", 1]
        ],
        placeFocal: (dim, x, y, z) => buildTree(dim, x, y, z, "minecraft:spruce_log", "minecraft:spruce_leaves")
    },
    desert: {
        id: "desert",
        name: "Desert",
        color: "§e",
        surface: "minecraft:sand",
        sub: "minecraft:sandstone",
        loot: [
            ["sand", 8], ["cactus", 2], ["deadbush", 1], ["bone", 2],
            ["dried_kelp", 4], ["lava_bucket", 1], ["wheat_seeds", 2]
        ],
        placeFocal: (dim, x, y, z) => {
            // 4 cacti stacked, no canopy
            for (let i = 1; i <= 4; i++) setBlock(dim, x, y + i, z, "minecraft:cactus");
        }
    },
    jungle: {
        id: "jungle",
        name: "Jungle",
        color: "§2",
        surface: "minecraft:grass_block",
        sub: "minecraft:dirt",
        loot: [
            ["jungle_sapling", 2], ["melon_slice", 4], ["cocoa_beans", 3],
            ["bamboo", 4], ["lava_bucket", 1], ["wheat_seeds", 2], ["ice", 1]
        ],
        placeFocal: (dim, x, y, z) => buildTree(dim, x, y, z, "minecraft:jungle_log", "minecraft:jungle_leaves")
    },
    mushroom: {
        id: "mushroom",
        name: "Mushroom",
        color: "§5",
        surface: "minecraft:mycelium",
        sub: "minecraft:dirt",
        loot: [
            ["red_mushroom", 4], ["brown_mushroom", 4], ["beetroot_seeds", 1],
            ["mushroom_stem", 2], ["lava_bucket", 1], ["ice", 1]
        ],
        placeFocal: (dim, x, y, z) => {
            // 2x2x2 cluster of red_mushroom_block at (x,y+1..y+2)
            for (let dx = 0; dx <= 1; dx++) {
                for (let dz = 0; dz <= 1; dz++) {
                    for (let dy = 1; dy <= 2; dy++) {
                        setBlock(dim, x + dx, y + dy, z + dz, "minecraft:red_mushroom_block");
                    }
                }
            }
            // single stem column underneath for "trunk" feel
            setBlock(dim, x, y + 1, z, "minecraft:mushroom_stem");
        }
    },
    cherry: {
        id: "cherry",
        name: "Cherry",
        color: "§d",
        surface: "minecraft:grass_block",
        sub: "minecraft:dirt",
        loot: [
            ["cherry_sapling", 2], ["sweet_berries", 4], ["oak_sapling", 1],
            ["lava_bucket", 1], ["ice", 1], ["wheat_seeds", 4], ["bone", 2]
        ],
        placeFocal: (dim, x, y, z) => buildTree(dim, x, y, z, "minecraft:cherry_log", "minecraft:cherry_leaves")
    },
    nether: {
        id: "nether",
        name: "Nether",
        color: "§c",
        surface: "minecraft:netherrack",
        sub: "minecraft:soul_sand",
        loot: [
            ["nether_wart", 4], ["glowstone", 2], ["soul_sand", 4],
            ["blaze_powder", 2], ["gold_nugget", 4], ["lava_bucket", 1]
        ],
        placeFocal: (dim, x, y, z) => {
            // 4-block crimson_stem column with nether_wart_block canopy 3x3x3
            for (let i = 1; i <= 4; i++) setBlock(dim, x, y + i, z, "minecraft:crimson_stem");
            for (let dx = 0; dx <= 2; dx++) {
                for (let dz = 0; dz <= 2; dz++) {
                    for (let dy = 3; dy <= 5; dy++) {
                        if (dx === 0 && dz === 0 && dy < 5) continue;
                        setBlock(dim, x + dx, y + dy, z + dz, "minecraft:nether_wart_block");
                    }
                }
            }
        }
    }
};

const THEME_WEIGHTS = {
    forest: 25,
    tundra: 15,
    desert: 15,
    jungle: 15,
    mushroom: 10,
    cherry: 10,
    nether: 10
};

export function getTheme(id) {
    return THEMES[id] || THEMES.forest;
}

export function pickRandomTheme() {
    const total = Object.values(THEME_WEIGHTS).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [id, w] of Object.entries(THEME_WEIGHTS)) {
        r -= w;
        if (r <= 0) return id;
    }
    return "forest"; // fallback
}
```

- [ ] **Step 2: Verify (code check)**

Bevestig:
- File parseert als geldige JS (`node --check skyblock_bp/scripts/themes.js`)
- Geen niet-gedefinieerde imports
- Alle 7 themes hebben dezelfde shape: `id`, `name`, `color`, `surface`, `sub`, `loot`, `placeFocal`

```bash
node --check skyblock_bp/scripts/themes.js && echo "OK"
```
Expected: `OK`

> Note: `node --check` parseert maar resolved geen imports. `@minecraft/server` is een runtime-only module — dat is hier prima.

- [ ] **Step 3: Commit**

```bash
git add skyblock_bp/scripts/themes.js
git commit -m "feat(themes): add theme registry with 7 themes for daily islands"
```

---

## Task 2: Refactor `generateIsland` voor theme + Y parameters

**Files:**
- Modify: `skyblock_bp/scripts/island_manager.js`

**Doel:** Bestaande hardcoded oak/grass/dirt generatie wordt theme-driven. Main island gebruikt `forest` theme — visueel exact identiek aan oude gedrag.

- [ ] **Step 1: Voeg import toe bovenaan `island_manager.js`**

Vind de bestaande import-regel:
```js
import { world, system, BlockPermutation } from "@minecraft/server";
```

Voeg eronder toe:
```js
import { getTheme } from "./themes.js";
```

- [ ] **Step 2: Vervang `generateIsland` functie**

Oude functie (regels 44-97 in huidige `island_manager.js`):
```js
function generateIsland(dimension, cx, cz) {
    const y = ISLAND_Y;
    // ... 5x5 grass platform
    // ... oak tree
    // ... chest with hardcoded items
}
```

Vervang door:
```js
function generateIsland(dimension, cx, cy, cz, themeId = "forest") {
    const theme = getTheme(themeId);

    // 5x5 platform (surface) + 2 layers subsoil
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            try {
                dimension.getBlock({ x: cx + dx, y: cy, z: cz + dz })
                    ?.setPermutation(BlockPermutation.resolve(theme.surface));
                dimension.getBlock({ x: cx + dx, y: cy - 1, z: cz + dz })
                    ?.setPermutation(BlockPermutation.resolve(theme.sub));
                dimension.getBlock({ x: cx + dx, y: cy - 2, z: cz + dz })
                    ?.setPermutation(BlockPermutation.resolve(theme.sub));
            } catch (e) { /* chunk not loaded yet — handled by retry */ }
        }
    }

    // Focal point in NW corner — delegated to theme
    try {
        theme.placeFocal(dimension, cx - 2, cy, cz - 2);
    } catch (e) { /* ignore */ }

    // Chest with theme loot
    try {
        const chestPos = { x: cx + 2, y: cy + 1, z: cz };
        dimension.getBlock(chestPos)?.setPermutation(BlockPermutation.resolve("minecraft:chest"));
        for (let i = 0; i < theme.loot.length; i++) {
            const [item, count] = theme.loot[i];
            dimension.runCommand(
                `replaceitem block ${chestPos.x} ${chestPos.y} ${chestPos.z} slot.container ${i} ${item} ${count}`
            );
        }
    } catch (e) { /* ignore */ }
}
```

- [ ] **Step 3: Update de bestaande caller in `getOrCreateIsland`**

Vind de regel:
```js
system.runTimeout(() => generateIsland(dim, cx, cz), 40);
```

Vervang door:
```js
system.runTimeout(() => generateIsland(dim, cx, ISLAND_Y, cz, "forest"), 40);
```

- [ ] **Step 4: Verify (code check)**

```bash
node --check skyblock_bp/scripts/island_manager.js && echo "OK"
```
Expected: `OK`

Bevestig in code dat het main-eiland nog steeds:
- Op Y=80 wordt geplaatst (`ISLAND_Y` doorgegeven)
- Met `forest` theme → grass + dirt + oak tree + originele loot

- [ ] **Step 5: Commit**

```bash
git add skyblock_bp/scripts/island_manager.js
git commit -m "refactor(island): parametrize generateIsland on Y and theme

Main island generation behavior unchanged (forest theme is identical
to the previous hardcoded output); enables future theme-aware bonus
island generation."
```

---

## Task 3: Bonus island helpers (storage + chain placement)

**Files:**
- Modify: `skyblock_bp/scripts/island_manager.js`

**Doel:** Voeg alle helpers toe die het bonus-eiland systeem nodig heeft: storage parsing/append, main-island lookup, chain placement, getAllIslands voor UI. Nog geen orchestrator-functie (dat is Task 4).

- [ ] **Step 1: Voeg constanten toe (boven `function nextSlot`)**

Vind de bestaande constanten in `island_manager.js`:
```js
const ISLAND_SPACING = 1024;
const ISLAND_Y = 80;
const ISLAND_DIM = "overworld";
const ISLAND_COUNTER_KEY = "sb:islandCounter";
const PLAYER_ISLAND_PREFIX = "sb:island:";
const PLAYER_VISITED_PREFIX = "sb:visited:";
```

Voeg eronder toe:
```js
// --- Bonus islands (chain layout) ---
const BONUS_ISLANDS_PREFIX = "sb:bonusIslands:";
const BONUS_DIST_MIN = 32;
const BONUS_DIST_MAX = 64;
const BONUS_Y_DELTA = 16;
const BONUS_Y_MIN = 60;
const BONUS_Y_MAX = 140;
const BONUS_MIN_SEPARATION = 16;
const BONUS_TERRITORY_RADIUS = 480;
const BONUS_PLACEMENT_RETRIES = 12;

const CIRCLED_DIGITS = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩",
                        "⑪","⑫","⑬","⑭","⑮","⑯","⑰","⑱","⑲","⑳"];
```

- [ ] **Step 2: Voeg `getMainIsland` helper toe (onder `spiralCoord`)**

```js
/** Get a player's main island coords, or null if not yet created. */
export function getMainIsland(playerId) {
    const stored = world.getDynamicProperty(PLAYER_ISLAND_PREFIX + playerId);
    if (typeof stored !== "string") return null;
    const [x, z] = stored.split(",").map(Number);
    return { x, z };
}
```

- [ ] **Step 3: Voeg storage helpers toe (`getBonusIslands`, `appendBonusIsland`)**

```js
/** Parse the CSV "x,y,z,theme;..." into an array of islands. */
export function getBonusIslands(playerId) {
    const stored = world.getDynamicProperty(BONUS_ISLANDS_PREFIX + playerId);
    if (typeof stored !== "string" || stored === "") return [];
    return stored.split(";").map((entry) => {
        const [x, y, z, theme] = entry.split(",");
        return { x: Number(x), y: Number(y), z: Number(z), theme };
    });
}

/** Append a bonus island to the player's CSV record. */
export function appendBonusIsland(playerId, x, y, z, theme) {
    const existing = world.getDynamicProperty(BONUS_ISLANDS_PREFIX + playerId);
    const entry = `${x},${y},${z},${theme}`;
    const updated = (typeof existing === "string" && existing.length > 0)
        ? `${existing};${entry}`
        : entry;
    world.setDynamicProperty(BONUS_ISLANDS_PREFIX + playerId, updated);
}
```

- [ ] **Step 4: Voeg het chain placement algoritme toe (`pickBonusLocation`)**

```js
/**
 * Pick a valid location for the next bonus island, chained off the
 * player's last bonus (or main if no bonuses yet). Returns null if no
 * valid spot is found within BONUS_PLACEMENT_RETRIES attempts.
 */
export function pickBonusLocation(playerId) {
    const main = getMainIsland(playerId);
    if (!main) return null;

    const bonusList = getBonusIslands(playerId);
    const anchor = bonusList.length > 0
        ? bonusList[bonusList.length - 1]
        : { x: main.x, y: ISLAND_Y, z: main.z };

    const allCenters = [
        { x: main.x, y: ISLAND_Y, z: main.z },
        ...bonusList.map((b) => ({ x: b.x, y: b.y, z: b.z }))
    ];

    for (let attempt = 0; attempt < BONUS_PLACEMENT_RETRIES; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = BONUS_DIST_MIN + Math.random() * (BONUS_DIST_MAX - BONUS_DIST_MIN);
        const dy = (Math.random() * 2 - 1) * BONUS_Y_DELTA;

        const cx = Math.round(anchor.x + Math.cos(angle) * dist);
        const cz = Math.round(anchor.z + Math.sin(angle) * dist);
        const cy = Math.max(BONUS_Y_MIN, Math.min(BONUS_Y_MAX, Math.round(anchor.y + dy)));

        // Territory check: max BONUS_TERRITORY_RADIUS horizontaal van main
        const ddx = cx - main.x, ddz = cz - main.z;
        if (Math.sqrt(ddx * ddx + ddz * ddz) > BONUS_TERRITORY_RADIUS) continue;

        // Collision check: minimaal BONUS_MIN_SEPARATION van elk bestaand eiland
        let collides = false;
        for (const c of allCenters) {
            const ex = cx - c.x, ey = cy - c.y, ez = cz - c.z;
            if (Math.sqrt(ex * ex + ey * ey + ez * ez) < BONUS_MIN_SEPARATION) {
                collides = true;
                break;
            }
        }
        if (collides) continue;

        return { x: cx, y: cy, z: cz };
    }
    return null;
}
```

- [ ] **Step 5: Voeg `getAllIslands` toe voor de UI**

```js
/** 8-sector compass direction from main toward (dx,dz). */
function compassDir(dx, dz) {
    if (dx === 0 && dz === 0) return "";
    // Bedrock: -z = north, +z = south, +x = east, -x = west.
    let deg = Math.atan2(-dz, dx) * 180 / Math.PI;
    if (deg < 0) deg += 360;
    // Sectors of 45°: 0=E, 45=NE, 90=N, 135=NW, 180=W, 225=SW, 270=S, 315=SE
    const sector = Math.round(deg / 45) % 8;
    return ["E", "NE", "N", "NW", "W", "SW", "S", "SE"][sector];
}

/**
 * Return all of a player's islands (main + bonus) with formatted labels
 * for the My Islands menu.
 */
export function getAllIslands(playerId) {
    const main = getMainIsland(playerId);
    if (!main) return [];

    const forestColor = "§a"; // main is always forest
    const result = [{
        type: "main",
        x: main.x,
        y: ISLAND_Y,
        z: main.z,
        theme: "forest",
        label: `§f★ Main           ${forestColor}Forest§r §7— y ${ISLAND_Y}`
    }];

    const bonuses = getBonusIslands(playerId);
    bonuses.forEach((b, i) => {
        const theme = getTheme(b.theme);
        const num = i < CIRCLED_DIGITS.length ? CIRCLED_DIGITS[i] : `(${i + 1})`;
        const ddx = b.x - main.x, ddz = b.z - main.z;
        const dist = Math.round(Math.sqrt(ddx * ddx + ddz * ddz));
        const dir = compassDir(ddx, ddz);
        result.push({
            type: "bonus",
            x: b.x, y: b.y, z: b.z,
            theme: b.theme,
            label: `§f${num} Day ${i + 1}      ${theme.color}${theme.name}§r §7— y ${b.y}, ${dir} ${dist}`
        });
    });

    return result;
}
```

> Note: `getTheme` is geïmporteerd in Task 2. Als die import er niet staat in jouw branch, voeg hem toe.

- [ ] **Step 6: Verify (code check)**

```bash
node --check skyblock_bp/scripts/island_manager.js && echo "OK"
```
Expected: `OK`

Bevestig:
- Alle nieuwe functies zijn geëxporteerd (`export function ...`)
- Geen ongebruikte constanten
- `compassDir` is een interne helper (geen `export`)

- [ ] **Step 7: Commit**

```bash
git add skyblock_bp/scripts/island_manager.js
git commit -m "feat(island): add bonus island helpers (storage, chain placement, list)"
```

---

## Task 4: Bonus island orchestrator (`generateBonusIsland`)

**Files:**
- Modify: `skyblock_bp/scripts/island_manager.js`

**Doel:** Eén exported functie die alle stappen samenbrengt: locatie kiezen, theme kiezen, ticking-area zetten, generatie inplannen, opslaan, chat-melding.

- [ ] **Step 1: Voeg import van `pickRandomTheme` toe**

Vind de bestaande import:
```js
import { getTheme } from "./themes.js";
```

Verander naar:
```js
import { getTheme, pickRandomTheme } from "./themes.js";
```

- [ ] **Step 2: Voeg `generateBonusIsland` toe (onder `getAllIslands`, vóór de `playerSpawn` subscriber)**

```js
/**
 * Orchestrate bonus island creation:
 *  - pick location (chain placement)
 *  - pick random theme
 *  - schedule generation with ticking-area force-load
 *  - persist to storage
 *  - notify the player
 *
 * Returns true on success, false if no valid location was found
 * (in which case the caller should NOT bump lastDay so the next
 * rollover retries with a fresh random seed).
 */
export function generateBonusIsland(player) {
    const loc = pickBonusLocation(player.id);
    if (!loc) {
        player.sendMessage("§b[Skyblock] §7Geen ruimte gevonden voor nieuw eiland — probeer later.");
        return false;
    }

    const themeId = pickRandomTheme();
    const theme = getTheme(themeId);
    const dim = world.getDimension(ISLAND_DIM);

    // Force-load chunks for placement (same pattern as main island).
    // Use a per-player ticking-area name so we don't accumulate one per bonus.
    const taName = `sb_b_${player.id.replace(/-/g, "").slice(0, 12)}`;
    try { dim.runCommand(`tickingarea remove ${taName}`); } catch (e) {}
    try {
        dim.runCommand(
            `tickingarea add ${loc.x - 16} 0 ${loc.z - 16} ${loc.x + 16} 200 ${loc.z + 16} ${taName}`
        );
    } catch (e) { /* ignore — chunks may already be loaded */ }

    // Persist BEFORE generation so a server crash mid-generation doesn't lose the record.
    appendBonusIsland(player.id, loc.x, loc.y, loc.z, themeId);

    // Generate after a 40-tick delay (same as main) to let chunks load.
    system.runTimeout(() => {
        try {
            generateIsland(dim, loc.x, loc.y, loc.z, themeId);
        } catch (e) { /* ignore — partial gen handled by retry on next visit */ }
        try { dim.runCommand(`tickingarea remove ${taName}`); } catch (e) {}
    }, 40);

    // Send chat notification immediately (don't wait for chunks).
    const bonusCount = getBonusIslands(player.id).length;
    player.sendMessage("§b[Skyblock] §6Een nieuwe Minecraft-dag is aangebroken!");
    player.sendMessage(
        `§b[Skyblock] §aBonus-eiland #${bonusCount} — ${theme.color}${theme.name}§r §a— gegenereerd op (${loc.x}, ${loc.y}, ${loc.z}).`
    );
    player.sendMessage("§7Open §f!island§7 → §fMy Islands§7 om te bezoeken.");
    return true;
}
```

- [ ] **Step 3: Verify (code check)**

```bash
node --check skyblock_bp/scripts/island_manager.js && echo "OK"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add skyblock_bp/scripts/island_manager.js
git commit -m "feat(island): add generateBonusIsland orchestrator"
```

---

## Task 5: Day-rollover loop (`daily_islands.js`)

**Files:**
- Create: `skyblock_bp/scripts/daily_islands.js`
- Modify: `skyblock_bp/scripts/main.js`

**Doel:** De minimale event-loop die per Minecraft-zonsopkomst `generateBonusIsland` triggert. Eerste keer voor een speler initialiseert `lastDay = currentDay` (geen bonus).

- [ ] **Step 1: Maak `skyblock_bp/scripts/daily_islands.js`**

```js
// Daily Bonus Islands
// Detects Minecraft day rollover (sunrise = world.getDay() increment)
// and triggers bonus island generation per online player.

import { world, system } from "@minecraft/server";
import { generateBonusIsland } from "./island_manager.js";

const DAILY_LAST_DAY_PREFIX = "sb:dailyLastDay:";
const PLAYER_ISLAND_PREFIX = "sb:island:";
const CHECK_INTERVAL_TICKS = 100; // 5 seconds

system.runInterval(() => {
    let currentDay;
    try {
        currentDay = world.getDay();
    } catch (e) {
        return; // world not ready yet
    }

    for (const player of world.getAllPlayers()) {
        // Skip players who don't have a main island yet — island_manager
        // will set them up on first spawn.
        const hasMain = typeof world.getDynamicProperty(PLAYER_ISLAND_PREFIX + player.id) === "string";
        if (!hasMain) continue;

        const key = DAILY_LAST_DAY_PREFIX + player.id;
        const lastDay = world.getDynamicProperty(key);

        // First time we see this player after they have a main island:
        // initialize lastDay to today (no bonus on this rollover, anti-stacking).
        if (typeof lastDay !== "number") {
            world.setDynamicProperty(key, currentDay);
            continue;
        }

        if (currentDay > lastDay) {
            const ok = generateBonusIsland(player);
            if (ok) {
                world.setDynamicProperty(key, currentDay);
            }
            // If !ok (no valid location found), leave lastDay as-is so the
            // next rollover retries with a fresh random seed.
        }
    }
}, CHECK_INTERVAL_TICKS);
```

- [ ] **Step 2: Update `skyblock_bp/scripts/main.js` — voeg import toe**

Vind:
```js
import "./island_manager.js";
import "./quests.js";
import "./balance.js";
import "./commands.js";
```

Verander naar:
```js
import "./island_manager.js";
import "./quests.js";
import "./balance.js";
import "./commands.js";
import "./daily_islands.js";
```

- [ ] **Step 3: Verify (code check)**

```bash
node --check skyblock_bp/scripts/daily_islands.js && echo "daily OK"
node --check skyblock_bp/scripts/main.js && echo "main OK"
```
Expected:
```
daily OK
main OK
```

- [ ] **Step 4: Commit**

```bash
git add skyblock_bp/scripts/daily_islands.js skyblock_bp/scripts/main.js
git commit -m "feat(daily): add Minecraft-day rollover loop for bonus islands"
```

---

## Task 6: Void respawn (spawnpoint = main island)

**Files:**
- Modify: `skyblock_bp/scripts/island_manager.js`

**Doel:** Speler respawnt op zijn hoofdeiland in plaats van world spawn. Geen aparte void-detection — `/spawnpoint` zorgt dat alle deaths daar uitkomen.

- [ ] **Step 1: Voeg constante toe (bij de andere `sb:` keys)**

Vind:
```js
const PLAYER_VISITED_PREFIX = "sb:visited:";
```

Voeg eronder toe:
```js
const PLAYER_SPAWN_SET_PREFIX = "sb:spawnSet:";
```

- [ ] **Step 2: Voeg helper `setIslandSpawnpoint` toe (boven de `playerSpawn` subscriber)**

```js
/** Set the player's personal spawnpoint to their main island. Idempotent. */
function setIslandSpawnpoint(player, cx, cz) {
    try {
        player.runCommand(`spawnpoint @s ${cx} ${ISLAND_Y + 1} ${cz}`);
        world.setDynamicProperty(PLAYER_SPAWN_SET_PREFIX + player.id, true);
    } catch (e) { /* ignore — will retry on next spawn */ }
}
```

- [ ] **Step 3: Roep `setIslandSpawnpoint` aan na main-generatie**

In `teleportToIsland`, vind:
```js
system.runTimeout(() => {
    try {
        player.teleport({ x: x + 0.5, y, z: z + 0.5 }, { dimension });
        if (isNew) {
            player.sendMessage("§b[Skyblock] §aYour new island is ready! §7Check the chest for starter items.");
            player.sendMessage("§b[Skyblock] §7Tip: place §flava§7 above §fice§7 (with a block beside) to make a cobblestone generator.");
        } else {
            player.sendMessage("§b[Skyblock] §aTeleported to your island.");
        }
    } catch (e) {
        player.sendMessage("§c[Skyblock] Teleport failed — try again in a moment.");
    }
}, delay);
```

Voeg een setIslandSpawnpoint-aanroep toe binnen de try-block, na de teleport:
```js
system.runTimeout(() => {
    try {
        player.teleport({ x: x + 0.5, y, z: z + 0.5 }, { dimension });
        setIslandSpawnpoint(player, x, z);    // <-- NEW
        if (isNew) {
            player.sendMessage("§b[Skyblock] §aYour new island is ready! §7Check the chest for starter items.");
            player.sendMessage("§b[Skyblock] §7Tip: place §flava§7 above §fice§7 (with a block beside) to make a cobblestone generator.");
        } else {
            player.sendMessage("§b[Skyblock] §aTeleported to your island.");
        }
    } catch (e) {
        player.sendMessage("§c[Skyblock] Teleport failed — try again in a moment.");
    }
}, delay);
```

- [ ] **Step 4: Voeg lazy-set hook toe in bestaande `playerSpawn` subscriber**

Vind onderaan `island_manager.js`:
```js
world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return; // only on first join of session
    const player = ev.player;
    const visitedKey = PLAYER_VISITED_PREFIX + player.id;
    const visited = world.getDynamicProperty(visitedKey);

    if (!visited) {
        world.setDynamicProperty(visitedKey, true);
        player.sendMessage("§b[Skyblock] §7Welcome! Generating your private island...");
        system.runTimeout(() => teleportToIsland(player), 20);
    }
});
```

Vervang door:
```js
world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return; // only on first join of session
    const player = ev.player;
    const visitedKey = PLAYER_VISITED_PREFIX + player.id;
    const visited = world.getDynamicProperty(visitedKey);

    if (!visited) {
        world.setDynamicProperty(visitedKey, true);
        player.sendMessage("§b[Skyblock] §7Welcome! Generating your private island...");
        system.runTimeout(() => teleportToIsland(player), 20);
        return;
    }

    // Existing player: lazy-set spawnpoint to main island if not yet set.
    // This handles users who got their island in a pre-1.1.0 version.
    const spawnSet = world.getDynamicProperty(PLAYER_SPAWN_SET_PREFIX + player.id);
    if (!spawnSet) {
        const main = getMainIsland(player.id);
        if (main) {
            // Small delay so the player is fully spawned before we run the command.
            system.runTimeout(() => setIslandSpawnpoint(player, main.x, main.z), 20);
        }
    }
});
```

- [ ] **Step 5: Verify (code check)**

```bash
node --check skyblock_bp/scripts/island_manager.js && echo "OK"
```
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add skyblock_bp/scripts/island_manager.js
git commit -m "feat(island): set player spawnpoint to main island on creation

Replaces world-spawn respawn behavior. Existing players (pre-1.1.0)
get their spawnpoint set lazily on next initial spawn."
```

---

## Task 7: "My Islands" UI in `commands.js`

**Files:**
- Modify: `skyblock_bp/scripts/commands.js`

**Doel:** Nieuwe knop in het hoofdmenu plus een form-handler die alle eilanden listet met theme-kleuren en teleport-on-click.

- [ ] **Step 1: Update imports**

Vind:
```js
import { teleportToIsland } from "./island_manager.js";
import { QUESTS, getProgress, isDone } from "./quests.js";
```

Verander naar:
```js
import { teleportToIsland, getAllIslands } from "./island_manager.js";
import { QUESTS, getProgress, isDone } from "./quests.js";
```

- [ ] **Step 2: Voeg "My Islands" knop toe aan `openMenu`**

Vind:
```js
function openMenu(player) {
    const form = new ActionFormData()
        .title("§b§lSkyblock Menu")
        .body("§7Choose an option:")
        .button("§aTeleport to my Island", "textures/items/ender_pearl")
        .button("§eView Quests", "textures/items/book_writable")
        .button("§cReset Island", "textures/blocks/tnt_side")
        .button("§7Help", "textures/items/paper");

    form.show(player).then((res) => {
        if (res.canceled) return;
        switch (res.selection) {
            case 0: teleportToIsland(player); break;
            case 1: showQuests(player); break;
            case 2: confirmReset(player); break;
            case 3: showHelp(player); break;
        }
    });
}
```

Vervang door (knop tussen Teleport en Quests, indices schuiven):
```js
function openMenu(player) {
    const form = new ActionFormData()
        .title("§b§lSkyblock Menu")
        .body("§7Choose an option:")
        .button("§aTeleport to my Island", "textures/items/ender_pearl")
        .button("§dMy Islands", "textures/items/map_filled")
        .button("§eView Quests", "textures/items/book_writable")
        .button("§cReset Island", "textures/blocks/tnt_side")
        .button("§7Help", "textures/items/paper");

    form.show(player).then((res) => {
        if (res.canceled) return;
        switch (res.selection) {
            case 0: teleportToIsland(player); break;
            case 1: showIslandList(player); break;
            case 2: showQuests(player); break;
            case 3: confirmReset(player); break;
            case 4: showHelp(player); break;
        }
    });
}
```

- [ ] **Step 3: Voeg `showIslandList` functie toe (onder `openMenu`, vóór `showQuests`)**

```js
function showIslandList(player) {
    const islands = getAllIslands(player.id);
    if (islands.length === 0) {
        player.sendMessage("§b[Skyblock] §7Je hebt nog geen eiland.");
        return;
    }

    const form = new ActionFormData()
        .title("§b§lMy Islands")
        .body("§7Klik om te teleporteren:");

    for (const isl of islands) {
        form.button(isl.label);
    }

    form.show(player).then((res) => {
        if (res.canceled) return;
        const target = islands[res.selection];
        if (!target) return;
        const dim = world.getDimension("overworld");
        try {
            player.teleport(
                { x: target.x + 0.5, y: target.y + 1, z: target.z + 0.5 },
                { dimension: dim }
            );
            player.sendMessage(`§b[Skyblock] §aTeleported to §f${target.label}§r§a.`);
        } catch (e) {
            player.sendMessage("§c[Skyblock] Teleport mislukt — probeer opnieuw.");
        }
    });
}
```

- [ ] **Step 4: Verify (code check)**

```bash
node --check skyblock_bp/scripts/commands.js && echo "OK"
```
Expected: `OK`

Bevestig handmatig:
- "My Islands" knop staat op index 1 (tussen Teleport en Quests)
- Switch-cases zijn opgehoogd: Quests=2, Reset=3, Help=4

- [ ] **Step 5: Commit**

```bash
git add skyblock_bp/scripts/commands.js
git commit -m "feat(ui): add My Islands menu with themed list and teleport"
```

---

## Task 8: Bump pack versie naar 1.1.0

**Files:**
- Modify: `skyblock_bp/manifest.json`

- [ ] **Step 1: Update versies in `manifest.json`**

Vind:
```json
{
  "format_version": 2,
  "header": {
    "name": "§bSkyblock §7Addon",
    "description": "§7Multi-player Skyblock with auto islands, quests & balance tweaks",
    "uuid": "8a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    {
      "type": "data",
      "uuid": "9b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
      "version": [1, 0, 0]
    },
    {
      "type": "script",
      "language": "javascript",
      "entry": "scripts/main.js",
      "uuid": "a1c2d3e4-5f6a-7b8c-9d0e-1f2a3b4c5d6f",
      "version": [1, 0, 0]
    }
  ],
  "dependencies": [
    {
      "module_name": "@minecraft/server",
      "version": "1.17.0"
    },
    {
      "module_name": "@minecraft/server-ui",
      "version": "1.3.0"
    }
  ]
}
```

Verander de drie `[1, 0, 0]` naar `[1, 1, 0]`. Niet aan de UUIDs of dependencies komen.

Eindresultaat:
```json
{
  "format_version": 2,
  "header": {
    "name": "§bSkyblock §7Addon",
    "description": "§7Multi-player Skyblock with auto islands, quests & balance tweaks",
    "uuid": "8a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    "version": [1, 1, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    {
      "type": "data",
      "uuid": "9b2c3d4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e",
      "version": [1, 1, 0]
    },
    {
      "type": "script",
      "language": "javascript",
      "entry": "scripts/main.js",
      "uuid": "a1c2d3e4-5f6a-7b8c-9d0e-1f2a3b4c5d6f",
      "version": [1, 1, 0]
    }
  ],
  "dependencies": [
    {
      "module_name": "@minecraft/server",
      "version": "1.17.0"
    },
    {
      "module_name": "@minecraft/server-ui",
      "version": "1.3.0"
    }
  ]
}
```

- [ ] **Step 2: Verify**

```bash
python3 -c "import json; json.load(open('skyblock_bp/manifest.json')); print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add skyblock_bp/manifest.json
git commit -m "chore: bump pack version to 1.1.0"
```

---

## Task 9: Update `README.md` met nieuwe features

**Files:**
- Modify: `skyblock_bp/README.md`

**Doel:** Spelers en server-admins moeten de nieuwe features begrijpen. We voegen items toe aan de Features-lijst, één nieuwe sectie over Daily Bonus Islands (incl. theme-tabel), en één nieuwe sectie over Void Respawn.

- [ ] **Step 1: Update Features-sectie**

Vind:
```markdown
## ✨ Features

- **Automatische eiland-generatie** — elke speler krijgt bij zijn eerste join een uniek eiland in een grid (1024 blokken uit elkaar)
- **Multi-player ondersteuning** — onbeperkt aantal spelers, elk met eigen eiland
- **Starter chest** — ice, lava bucket, saplings, seeds om mee te beginnen
- **Quest-systeem** — 6 challenges met progressie-tracking en beloningen
- **Custom mob drops** — iron, diamond, emerald, redstone uit mobs (essentieel voor skyblock balans)
- **Chat-commands** — `!island`, `!home`, `!quests`, `!reset`, etc.
- **UI menu** — mooi grafisch menu via in-game forms
- **Persistent data** — alles wordt opgeslagen via dynamic properties (overleeft restarts)
```

Voeg twee nieuwe items toe (na "Starter chest"):
```markdown
## ✨ Features

- **Automatische eiland-generatie** — elke speler krijgt bij zijn eerste join een uniek eiland in een grid (1024 blokken uit elkaar)
- **Multi-player ondersteuning** — onbeperkt aantal spelers, elk met eigen eiland
- **Starter chest** — ice, lava bucket, saplings, seeds om mee te beginnen
- **Daily bonus islands** 🆕 — elke Minecraft-zonsopkomst een nieuw themed eiland erbij, gekoppeld in een keten rond je hoofdbasis (Forest, Tundra, Desert, Jungle, Mushroom, Cherry, Nether)
- **Void respawn** 🆕 — val je in de void? Geen probleem, je respawnt op je hoofdeiland
- **Quest-systeem** — 6 challenges met progressie-tracking en beloningen
- **Custom mob drops** — iron, diamond, emerald, redstone uit mobs (essentieel voor skyblock balans)
- **Chat-commands** — `!island`, `!home`, `!quests`, `!reset`, etc.
- **UI menu** — mooi grafisch menu via in-game forms (incl. "My Islands" lijst voor bonus-eilanden)
- **Persistent data** — alles wordt opgeslagen via dynamic properties (overleeft restarts)
```

- [ ] **Step 2: Voeg sectie "Daily bonus islands" toe**

Vind de sectie:
```markdown
## 🎯 Quests & beloningen
```

Voeg dáárvóór toe (en zorg dat de volgorde correct blijft):

```markdown
## 🌅 Daily bonus islands

Elke keer dat een Minecraft-nacht voorbij is (zonsopkomst — `world.getDay()` ophoogt) krijg je automatisch een nieuw eiland erbij. ~20 real-time minuten actieve speeltijd per eiland — tijd loopt alleen door als er iemand online is.

### Hoe werkt het?

- Bij zonsopkomst krijg je een chat-melding: `§b[Skyblock] §6Een nieuwe Minecraft-dag is aangebroken!`
- Het nieuwe eiland verschijnt op **bouwbare afstand** (32-64 blokken) van je vorige eiland, op een variërende hoogte (Y 60-140)
- Je archipel groeit organisch outward — je kunt letterlijk bridges bouwen tussen je eilanden
- Maximaal 480 blokken horizontaal van je hoofdeiland → blijft binnen je territorium, geen botsingen met buren

### De 7 themes

Elk bonus-eiland heeft een willekeurig thema, met eigen blokken en chest-loot:

| Theme | Kleur | Blokken | Loot highlights |
|---|---|---|---|
| Forest 🌲 | Groen | grass + dirt + oak | starter mix (ice, lava, saplings, seeds) |
| Tundra ❄️ | Aqua | snow + packed_ice + spruce | ice ×4, snowball ×8, leather, beetroot |
| Desert 🏜️ | Geel | sand + sandstone + cactus | sand ×8, dried_kelp, deadbush |
| Jungle 🌴 | Donkergroen | grass + jungle log/leaves | jungle_sapling, melon, cocoa, bamboo |
| Mushroom 🍄 | Paars | mycelium + huge mushroom | red/brown mushrooms, mushroom_stem |
| Cherry 🌸 | Roze | grass + cherry log/leaves | cherry_sapling, sweet_berries |
| Nether 🔥 | Rood | netherrack + soul_sand + crimson | nether_wart, glowstone, blaze_powder |

Distributie: Forest 25%, Tundra/Desert/Jungle elk 15%, Mushroom/Cherry/Nether elk 10%.

### Naar je bonus-eilanden teleporteren

Geen typen nodig — alles via menu:

1. Type `!island` (of klik in het hoofdmenu)
2. Kies **My Islands**
3. Zie de lijst met al je eilanden, gekleurd per thema, met hoogte en kompasrichting
4. Klik op een eiland om er heen te teleporteren

### Edge cases

- **Lange tijd offline?** Bij terugkomst krijg je **één** bonus, niet één per gemiste dag (anti-stacking).
- **Geen ruimte gevonden?** Als je archipel zo dicht is dat het algoritme geen plek vindt, krijg je een melding "Geen ruimte gevonden — probeer later". De volgende zonsopkomst probeert opnieuw met andere random waardes.

---

## 🪦 Void respawn

Val je in de void of overlijd je op een andere manier? Je respawnt automatisch op je **hoofdeiland**, niet op world spawn. Dit gebeurt via een persoonlijk `/spawnpoint` dat we zetten zodra je hoofdeiland is gegenereerd.

- Werkt voor alle death-causes (void, mob, fall, drowning, etc)
- **Beds en respawn anchors blijven werken** — sleep je in een bed, dan respawn je daar (vanilla mechanic)
- **Bestaande spelers** (van vóór 1.1.0) krijgen hun spawnpoint gezet bij hun eerstvolgende join

---
```

- [ ] **Step 3: Verify**

```bash
test -f skyblock_bp/README.md && grep -c "Daily bonus islands" skyblock_bp/README.md
```
Expected: een getal ≥ 2 (één in TOC niet, één in heading + één in Features)

Visuele check: open `skyblock_bp/README.md` en bevestig:
- Twee nieuwe Features-items met 🆕 markers
- Sectie "Daily bonus islands" met theme-tabel
- Sectie "Void respawn"

- [ ] **Step 4: Commit**

```bash
git add skyblock_bp/README.md
git commit -m "docs: add daily bonus islands and void respawn to README"
```

---

## Task 10: Manuele integratie-test op BDS

**Files:** geen wijzigingen — dit is een verificatie-stap.

**Doel:** Volg het test plan uit spec §8 op een echte BDS-server. Bevestig per scenario dat het verwachte gedrag klopt.

**Voorbereiding (eenmalig):**

- [ ] **Step 1: Pack op BDS plaatsen**

```bash
# Vervang met jouw BDS-pad
BDS=~/bedrock_server
cp -R skyblock_bp "$BDS/behavior_packs/skyblock_bp"
```

- [ ] **Step 2: Bevestig dat `world_behavior_packs.json` de pack referenceert (zonder UUID change)**

```bash
cat "$BDS/worlds/Skyblock/world_behavior_packs.json"
```
Expected: bevat `"pack_id": "8a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d"` met `"version": [1, 1, 0]` (of update de version daar als je 'm vroeger op `[1, 0, 0]` had).

- [ ] **Step 3: BDS starten en console kijken**

```bash
cd "$BDS" && ./bedrock_server
```
Expected console output:
```
[Scripting] [Skyblock] Addon loaded successfully.
[Scripting] [Skyblock] Ready. Type !island in chat for the menu.
```
Geen `[ERROR]` lines van scripting.

**Test scenarios (uit spec §8):**

- [ ] **Test #1 — Nieuwe speler joint**

Join met een nieuwe Xbox/PC client. Verwacht:
- Chat: `§b[Skyblock] §7Welcome! Generating your private island...`
- Na ~3 sec teleport naar nieuw 5×5 grass eiland op Y=80
- Chest met starter items aanwezig
- Bonus-eiland melding **NIET** gezien (lastDay = currentDay, anti-instant-bonus)

- [ ] **Test #2 — Wacht tot zonsopkomst**

Blijf in spel tot een Minecraft-nacht voorbij is (~10 min real-time vanaf nacht-start). Verwacht:
- Chat: `§b[Skyblock] §6Een nieuwe Minecraft-dag is aangebroken!`
- Chat: `§b[Skyblock] §aBonus-eiland #1 — §{color}{Theme}§r §a— gegenereerd op (X, Y, Z).`
- Coordinaten zijn 32-64 blokken horizontaal van main, Y in [60,140]
- Vlieg er heen (creative mode for testing) — eiland heeft theme-blokken (geen forest)

- [ ] **Test #3 — `!island` → My Islands**

Type `!island`, klik **My Islands**. Verwacht:
- Form titel: `§b§lMy Islands`
- Lijst toont:
  - `★ Main           §aForest    §7— y 80`
  - `① Day 1          §{color}{Theme}    §7— y {Y}, {dir} {dist}`
- Klik op `① Day 1` → teleport naar bonus 1
- Chat bevestigt teleport

- [ ] **Test #3b — Theme distributie (steekproef)**

Genereer 10-20 bonus eilanden via /scriptevent of via wachten. Open chest van elk. Verwacht ruwweg:
- Forest meest voorkomend (~25%)
- Tundra/Desert/Jungle middelmatig (~15% elk)
- Mushroom/Cherry/Nether zeldzaam (~10% elk)
- Geen NULL of ontbrekende theme

> Niet exact te valideren met statistische rigor in handmatige test, maar je moet alle 7 themes wel kunnen zien na ~30 generaties.

- [ ] **Test #3c — Theme-loot verificatie**

Open de chest op een Tundra-eiland. Verwacht:
- ice ×4, snowball ×8, spruce_sapling ×2, leather ×2, beetroot_seeds, lava_bucket
- **Geen** forest-items (geen melon_seeds, pumpkin_seeds, etc)

Herhaal met 1-2 andere themes (bv. Desert, Cherry).

- [ ] **Test #4 — Void respawn**

Spring vanaf je eiland in de void. Verwacht:
- Sterf na ~3 sec van void damage
- Respawn-screen: klik "Respawn"
- Spawn op je **main island** (niet world spawn, niet op een bonus)
- Coords ongeveer (mainX + 0.5, 81, mainZ + 0.5)

- [ ] **Test #5 — Bestaande speler (pre-1.1.0)**

Voor deze test moet je een bestaande wereld hebben met een speler die al een main heeft (`sb:island:<id>` ingevuld) maar geen `sb:spawnSet`. Als je niet zo'n wereld hebt, sla deze test over of forceer 't:

```
# In game als admin, of via console:
/scriptevent debug:resetSpawnSet @s
```
(Niet geïmplementeerd — als je deze edge wil testen kun je tijdelijk in `playerSpawn` de spawnSet check uitcommenten of de dynamic property handmatig verwijderen.)

Verwacht na re-join:
- Geen "Generating island..." melding
- Spawnpoint wordt gezet op main (zichtbaar door dood te gaan: respawn op main)

- [ ] **Test #6 — Lange afwezigheid**

Als test setup: zet handmatig `sb:dailyLastDay:<playerId>` op een laag getal (bv. 0) terwijl `world.getDay()` veel hoger is. Of speel een aantal Minecraft-dagen door zonder dat de speler online is.

Join opnieuw. Verwacht:
- **Eén** bonus-eiland melding, niet meerdere
- `lastDay` springt direct naar `currentDay`

- [ ] **Test #7 — Veel bonus eilanden**

Genereer 20+ bonus eilanden (door te wachten of door `world.setDynamicProperty` aanroepen via een tijdelijke `/scriptevent`). Verwacht:
- **Geen "archipel vol" melding**
- Eilanden meanderen organisch
- Alle eilanden binnen 480 blokken horizontaal van main
- Geen botsingen (alle eilanden ≥ 16 blokken uit elkaar)

- [ ] **Test #9 — Bridge-able afstand**

Vanaf elk genereerd bonus-eiland: ga naar de rand, kijk naar het vorige eiland (volgens `bonusList[i-1]`). Bouw een bridge erheen met blocks. Verwacht:
- Volgend eiland zichtbaar (niet 256+ weg)
- Bridge bouwbaar binnen 64 blokken horizontaal + 16 vertikaal

**Eindcommit:**

- [ ] **Step 4: Bij volledig groen — final commit (geen code, alleen log)**

Geen code-wijzigingen meer; als alle tests groen zijn, het project is klaar voor release. Geen commit nodig.

Als er issues zijn: documenteer ze, fix in een aparte taak, en re-run de relevante test.

---

## Self-review (voltooid tijdens schrijven)

**Spec coverage:**

| Spec sectie | Plan task |
|---|---|
| §1 Trigger (day rollover loop) | Task 5 |
| §2 Chain layout (constanten + algoritme) | Task 3 (helpers) + Task 4 (orchestrator) |
| §3 Themes (registry + selection) | Task 1 |
| §3 Theme-aware generation | Task 2 (refactor generateIsland) |
| §4 Storage schema (nieuwe keys + helpers) | Task 3 |
| §5 Player UX (chat + My Islands menu) | Task 4 (chat) + Task 7 (UI) |
| §6 Void respawn (spawnpoint + lazy hook) | Task 6 |
| §7 Bestandsstructuur (nieuwe + gewijzigde files) | Tasks 1, 2, 3, 4, 5, 6, 7 |
| §8 Test plan | Task 10 |
| Manifest version bump | Task 8 |
| README update | Task 9 |

Geen gaps gevonden.

**Placeholder scan:** Alle code-stappen bevatten complete code. Geen TODO/TBD/"add error handling". Verify-stappen verwijzen naar echte commands met expected output.

**Type / signature consistency:**
- `generateIsland(dim, cx, cy, cz, themeId)` — Task 2 definieert, Task 4 + Task 5 callen ermee.
- `getMainIsland(playerId)` — Task 3 exporteert, Task 4 (`pickBonusLocation`) en Task 6 (`playerSpawn` hook) callen.
- `getBonusIslands(playerId)` → `Array<{x,y,z,theme}>` — consistent in Task 3, Task 4, Task 7.
- `appendBonusIsland(playerId, x, y, z, theme)` — consistent in Task 3 en Task 4.
- `pickBonusLocation(playerId)` → `{x,y,z} | null` — consistent in Task 3 en Task 4.
- `generateBonusIsland(player)` → `boolean` — consistent in Task 4 en Task 5 (`daily_islands.js`).
- `getAllIslands(playerId)` → `Array<{type, label, x, y, z, theme}>` — consistent in Task 3 en Task 7.
- `pickRandomTheme()` → themeId string — Task 1 definieert, Task 4 callt.
- Theme color codes (Forest=§a, Tundra=§b, Desert=§e, Jungle=§2, Mushroom=§5, Cherry=§d, Nether=§c) consistent in Task 1, Task 3 (getAllIslands label), Task 9 (README tabel).
