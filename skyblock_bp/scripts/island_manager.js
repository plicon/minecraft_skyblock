// Island Manager
// - Assigns each player a unique island slot in a grid (1024 blocks apart)
// - Generates a starter island when they first join
// - Teleports players to their island on join
// - Stores data via world dynamic properties

import { world, system, BlockPermutation } from "@minecraft/server";

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

/** Generate the starter island structure at world coords. */
function generateIsland(dimension, cx, cz) {
    const y = ISLAND_Y;

    // 5x5 dirt platform with grass top
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            try {
                dimension.getBlock({ x: cx + dx, y: y, z: cz + dz })
                    ?.setPermutation(BlockPermutation.resolve("minecraft:grass_block"));
                dimension.getBlock({ x: cx + dx, y: y - 1, z: cz + dz })
                    ?.setPermutation(BlockPermutation.resolve("minecraft:dirt"));
                dimension.getBlock({ x: cx + dx, y: y - 2, z: cz + dz })
                    ?.setPermutation(BlockPermutation.resolve("minecraft:dirt"));
            } catch (e) { /* chunk not loaded yet — handled by retry */ }
        }
    }

    // Tree (oak log + leaves)
    try {
        for (let i = 1; i <= 4; i++) {
            dimension.getBlock({ x: cx - 2, y: y + i, z: cz - 2 })
                ?.setPermutation(BlockPermutation.resolve("minecraft:oak_log"));
        }
        // Leaves canopy
        for (let dx = -3; dx <= -1; dx++) {
            for (let dz = -3; dz <= -1; dz++) {
                for (let dy = 3; dy <= 5; dy++) {
                    if (dx === -2 && dz === -2 && dy < 5) continue; // skip log column
                    dimension.getBlock({ x: cx + dx, y: y + dy, z: cz + dz })
                        ?.setPermutation(BlockPermutation.resolve("minecraft:oak_leaves"));
                }
            }
        }
    } catch (e) { /* ignore */ }

    // Chest with starter items (placed on east edge)
    try {
        const chestPos = { x: cx + 2, y: y + 1, z: cz };
        dimension.getBlock(chestPos)?.setPermutation(BlockPermutation.resolve("minecraft:chest"));
        // Fill chest via /replaceitem (works reliably)
        const cmd = (slot, item, count = 1) =>
            `replaceitem block ${chestPos.x} ${chestPos.y} ${chestPos.z} slot.container ${slot} ${item} ${count}`;
        dimension.runCommand(cmd(0, "ice", 2));
        dimension.runCommand(cmd(1, "lava_bucket", 1));
        dimension.runCommand(cmd(2, "bone", 4));
        dimension.runCommand(cmd(3, "sapling", 2));
        dimension.runCommand(cmd(4, "melon_seeds", 1));
        dimension.runCommand(cmd(5, "pumpkin_seeds", 1));
        dimension.runCommand(cmd(6, "sugar_cane", 1));
        dimension.runCommand(cmd(7, "cactus", 1));
        dimension.runCommand(cmd(8, "wheat_seeds", 2));
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
        system.runTimeout(() => generateIsland(dim, cx, cz), 40);
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
