// Island Manager
// - Assigns each player a unique island slot in a grid (1024 blocks apart)
// - Generates a starter island when they first join
// - Teleports players to their island on join
// - Stores data via world dynamic properties

import { world, system, BlockPermutation } from "@minecraft/server";
import { getTheme, pickRandomTheme } from "./themes.js";

const ISLAND_SPACING = 1024;          // blocks between island centers
const ISLAND_Y = 80;                  // island height
const ISLAND_DIM = "overworld";       // dimension to use
const ISLAND_COUNTER_KEY = "sb:islandCounter";
const PLAYER_ISLAND_PREFIX = "sb:island:"; // + playerId -> "x,z"
const PLAYER_VISITED_PREFIX = "sb:visited:"; // + playerId -> bool
const PLAYER_SPAWN_SET_PREFIX = "sb:spawnSet:"; // + playerId -> bool (idempotency)

// --- Bonus islands (chain layout) ---
const BONUS_ISLANDS_PREFIX = "sb:bonusIslands:"; // + playerId -> "x,y,z,theme;..."
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

/** Get next island grid slot (spiral outward). */
function nextSlot() {
    let counter = world.getDynamicProperty(ISLAND_COUNTER_KEY);
    if (typeof counter !== "number") counter = 0;
    world.setDynamicProperty(ISLAND_COUNTER_KEY, counter + 1);
    // Simple spiral: convert counter to (x,z) grid coords
    return spiralCoord(counter);
}

function spiralCoord(n) {
    if (n === 0) return { x: 0, z: 0 };
    let layer = Math.ceil((Math.sqrt(n + 1) - 1) / 2);
    let legLen = 2 * layer;
    let maxIdx = 4 * layer * layer;
    let prevMax = 4 * (layer - 1) * (layer - 1);
    let stepInLayer = n - prevMax;
    let leg = Math.floor(stepInLayer / legLen);
    let posInLeg = stepInLayer % legLen;
    let x = 0, z = 0;
    switch (leg) {
        case 0: x = layer; z = -layer + posInLeg + 1; break;
        case 1: x = layer - posInLeg - 1; z = layer; break;
        case 2: x = -layer; z = layer - posInLeg - 1; break;
        case 3: x = -layer + posInLeg + 1; z = -layer; break;
    }
    return { x, z };
}

/** Get a player's main island coords, or null if not yet created. */
export function getMainIsland(playerId) {
    const stored = world.getDynamicProperty(PLAYER_ISLAND_PREFIX + playerId);
    if (typeof stored !== "string") return null;
    const [x, z] = stored.split(",").map(Number);
    return { x, z };
}

/** Parse the CSV "x,y,z,theme;..." into an array of bonus islands. */
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

        const ddx = cx - main.x, ddz = cz - main.z;
        if (Math.sqrt(ddx * ddx + ddz * ddz) > BONUS_TERRITORY_RADIUS) continue;

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

/** 8-sector compass direction from main toward (dx,dz). */
function compassDir(dx, dz) {
    if (dx === 0 && dz === 0) return "";
    let deg = Math.atan2(-dz, dx) * 180 / Math.PI;
    if (deg < 0) deg += 360;
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

    const result = [{
        type: "main",
        x: main.x, y: ISLAND_Y, z: main.z,
        theme: "forest",
        label: `§f★ Main           §aForest§r §7— y ${ISLAND_Y}`
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

/** Generate an island structure at world coords with a given theme. */
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

/** Public: get or create a player's island, return spawn point. */
export function getOrCreateIsland(player) {
    const key = PLAYER_ISLAND_PREFIX + player.id;
    let stored = world.getDynamicProperty(key);
    let cx, cz, isNew = false;

    if (typeof stored === "string") {
        const [sx, sz] = stored.split(",").map(Number);
        cx = sx; cz = sz;
    } else {
        const slot = nextSlot();
        cx = slot.x * ISLAND_SPACING;
        cz = slot.z * ISLAND_SPACING;
        world.setDynamicProperty(key, `${cx},${cz}`);
        isNew = true;
    }

    const dim = world.getDimension(ISLAND_DIM);
    if (isNew) {
        // Force-load the area, then generate
        try { dim.runCommand(`tickingarea add ${cx - 16} 0 ${cz - 16} ${cx + 16} 200 ${cz + 16} sb_${player.id.replace(/-/g, "")}`); } catch (e) {}
        // Small delay so chunks load before placing blocks
        system.runTimeout(() => generateIsland(dim, cx, ISLAND_Y, cz, "forest"), 40);
    }

    return { x: cx, y: ISLAND_Y + 1, z: cz, dimension: dim, isNew };
}

/** Set the player's personal spawnpoint to their main island. Idempotent. */
function setIslandSpawnpoint(player, cx, cz) {
    try {
        player.runCommand(`spawnpoint @s ${cx} ${ISLAND_Y + 1} ${cz}`);
        world.setDynamicProperty(PLAYER_SPAWN_SET_PREFIX + player.id, true);
    } catch (e) { /* ignore — will retry on next spawn */ }
}

/** Teleport player to their island. */
export function teleportToIsland(player) {
    const { x, y, z, dimension, isNew } = getOrCreateIsland(player);
    // If new, wait for generation before tp
    const delay = isNew ? 60 : 5;
    system.runTimeout(() => {
        try {
            player.teleport({ x: x + 0.5, y, z: z + 0.5 }, { dimension });
            setIslandSpawnpoint(player, x, z);
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
}

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
    // Per-player ticking area name avoids accumulating one per bonus.
    const taName = `sb_b_${player.id.replace(/-/g, "").slice(0, 12)}`;
    try { dim.runCommand(`tickingarea remove ${taName}`); } catch (e) {}
    try {
        dim.runCommand(
            `tickingarea add ${loc.x - 16} 0 ${loc.z - 16} ${loc.x + 16} 200 ${loc.z + 16} ${taName}`
        );
    } catch (e) { /* chunks may already be loaded */ }

    // Persist BEFORE generation so a server crash mid-generation doesn't lose the record.
    appendBonusIsland(player.id, loc.x, loc.y, loc.z, themeId);

    system.runTimeout(() => {
        try {
            generateIsland(dim, loc.x, loc.y, loc.z, themeId);
        } catch (e) { /* ignore — partial gen handled by retry on next visit */ }
        try { dim.runCommand(`tickingarea remove ${taName}`); } catch (e) {}
    }, 40);

    const bonusCount = getBonusIslands(player.id).length;
    player.sendMessage("§b[Skyblock] §6Een nieuwe Minecraft-dag is aangebroken!");
    player.sendMessage(
        `§b[Skyblock] §aBonus-eiland #${bonusCount} — ${theme.color}${theme.name}§r §a— gegenereerd op (${loc.x}, ${loc.y}, ${loc.z}).`
    );
    player.sendMessage("§7Open §f!island§7 → §fMy Islands§7 om te bezoeken.");
    return true;
}

// --- Auto-spawn on first join ---
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

    // Existing player: lazy-set spawnpoint to main if not yet set
    // (handles users with islands from before 1.1.0).
    const spawnSet = world.getDynamicProperty(PLAYER_SPAWN_SET_PREFIX + player.id);
    if (!spawnSet) {
        const main = getMainIsland(player.id);
        if (main) {
            system.runTimeout(() => setIslandSpawnpoint(player, main.x, main.z), 20);
        }
    }
});
