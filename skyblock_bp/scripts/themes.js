// Theme Registry
// Pure data + focal-point builders for daily bonus islands.
// Each theme defines surface/sub blocks, a focal point (tree-like structure),
// and a chest loot table. Used by island_manager.js#generateIsland.
//
// Theme display names are in Dutch (target audience: 6-year-old).

import { BlockPermutation } from "@minecraft/server";

function setBlock(dim, x, y, z, id) {
    try {
        dim.getBlock({ x, y, z })?.setPermutation(BlockPermutation.resolve(id));
    } catch (e) { /* chunk not loaded — ignore */ }
}

// Standard "tree" focal: 4-block log column at (x,z) with 3x3x3 leaves canopy.
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

// Starter tools every island needs so a young player can immediately
// gather resources (wooden pickaxe = unlock for cobblestone) without
// having to figure out crafting from scratch.
// The compass triggers the Skyblock menu via itemUse event — zero-typing
// UX for kids on console where the chat-/-button isn't available.
const STARTER_TOOLS = [
    ["wooden_pickaxe", 1],
    ["wooden_axe", 1],
    ["crafting_table", 1],
    ["compass", 1]
];

export const THEMES = {
    forest: {
        id: "forest",
        name: "Bos",
        color: "§a",
        surface: "minecraft:grass_block",
        sub: "minecraft:dirt",
        loot: [
            ...STARTER_TOOLS,
            ["ice", 2], ["lava_bucket", 1], ["bone", 4], ["sapling", 2],
            ["melon_seeds", 1], ["pumpkin_seeds", 1], ["sugar_cane", 1],
            ["wheat_seeds", 2]
        ],
        placeFocal: (dim, x, y, z) => buildTree(dim, x, y, z, "minecraft:oak_log", "minecraft:oak_leaves")
    },
    tundra: {
        id: "tundra",
        name: "Sneeuw",
        color: "§b",
        surface: "minecraft:snow_block",
        sub: "minecraft:packed_ice",
        loot: [
            ...STARTER_TOOLS,
            ["ice", 4], ["snowball", 8], ["spruce_sapling", 2],
            ["leather", 2], ["beetroot_seeds", 1], ["lava_bucket", 1]
        ],
        placeFocal: (dim, x, y, z) => buildTree(dim, x, y, z, "minecraft:spruce_log", "minecraft:spruce_leaves")
    },
    desert: {
        id: "desert",
        name: "Woestijn",
        color: "§e",
        surface: "minecraft:sand",
        sub: "minecraft:sandstone",
        loot: [
            ...STARTER_TOOLS,
            ["sand", 8], ["cactus", 2], ["deadbush", 1], ["bone", 2],
            ["dried_kelp", 4], ["lava_bucket", 1], ["wheat_seeds", 2]
        ],
        placeFocal: (dim, x, y, z) => {
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
            ...STARTER_TOOLS,
            ["jungle_sapling", 2], ["melon_slice", 4], ["cocoa_beans", 3],
            ["bamboo", 4], ["lava_bucket", 1], ["wheat_seeds", 2], ["ice", 1]
        ],
        placeFocal: (dim, x, y, z) => buildTree(dim, x, y, z, "minecraft:jungle_log", "minecraft:jungle_leaves")
    },
    mushroom: {
        id: "mushroom",
        name: "Paddenstoel",
        color: "§5",
        surface: "minecraft:mycelium",
        sub: "minecraft:dirt",
        loot: [
            ...STARTER_TOOLS,
            ["red_mushroom", 4], ["brown_mushroom", 4], ["beetroot_seeds", 1],
            ["mushroom_stem", 2], ["lava_bucket", 1], ["ice", 1]
        ],
        placeFocal: (dim, x, y, z) => {
            for (let dx = 0; dx <= 1; dx++) {
                for (let dz = 0; dz <= 1; dz++) {
                    for (let dy = 1; dy <= 2; dy++) {
                        setBlock(dim, x + dx, y + dy, z + dz, "minecraft:red_mushroom_block");
                    }
                }
            }
            setBlock(dim, x, y + 1, z, "minecraft:mushroom_stem");
        }
    },
    cherry: {
        id: "cherry",
        name: "Kers",
        color: "§d",
        surface: "minecraft:grass_block",
        sub: "minecraft:dirt",
        loot: [
            ...STARTER_TOOLS,
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
            ...STARTER_TOOLS,
            ["nether_wart", 4], ["glowstone", 2], ["soul_sand", 4],
            ["blaze_powder", 2], ["gold_nugget", 4], ["lava_bucket", 1]
        ],
        placeFocal: (dim, x, y, z) => {
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
    return "forest";
}
