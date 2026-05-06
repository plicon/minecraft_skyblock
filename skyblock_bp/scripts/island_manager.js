// Island Manager
// - Assigns each player a unique island slot in a grid (1024 blocks apart)
// - Generates a starter island when they first join
// - Teleports players to their island on join
// - Stores data via world dynamic properties

import { world, system, BlockPermutation } from "@minecraft/server";
import { getTheme } from "./themes.js";

const ISLAND_SPACING = 1024;          // blocks between island centers
const ISLAND_Y = 80;                  // island height
const ISLAND_DIM = "overworld";       // dimension to use
const ISLAND_COUNTER_KEY = "sb:islandCounter";
const PLAYER_ISLAND_PREFIX = "sb:island:"; // + playerId -> "x,z"
const PLAYER_VISITED_PREFIX = "sb:visited:"; // + playerId -> bool

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

/** Teleport player to their island. */
export function teleportToIsland(player) {
    const { x, y, z, dimension, isNew } = getOrCreateIsland(player);
    // If new, wait for generation before tp
    const delay = isNew ? 60 : 5;
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
    }
});
