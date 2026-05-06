// Balance Tweaks
// Skyblock needs bonus mob drops because some resources can't be obtained
// naturally on a sky island (iron, redstone, emerald, diamond, etc.).
// We give the bonus directly to the killer.

import { world } from "@minecraft/server";

const BONUS_DROPS = {
    // mob -> [{ item, chance (0-1), min, max }]
    "minecraft:zombie": [
        { item: "iron_ingot", chance: 0.10, min: 1, max: 1 },
        { item: "potato",     chance: 0.15, min: 1, max: 2 },
        { item: "carrot",     chance: 0.15, min: 1, max: 2 }
    ],
    "minecraft:skeleton": [
        { item: "flint", chance: 0.20, min: 1, max: 2 }
    ],
    "minecraft:creeper": [
        { item: "redstone", chance: 0.25, min: 1, max: 3 }
    ],
    "minecraft:spider": [
        { item: "string", chance: 0.30, min: 1, max: 2 }
    ],
    "minecraft:enderman": [
        { item: "diamond",  chance: 0.05, min: 1, max: 1 },
        { item: "obsidian", chance: 0.10, min: 1, max: 1 }
    ],
    "minecraft:witch": [
        { item: "emerald", chance: 0.30, min: 1, max: 2 }
    ],
    "minecraft:blaze": [
        { item: "gold_ingot", chance: 0.20, min: 1, max: 2 }
    ],
    "minecraft:husk": [
        { item: "iron_ingot", chance: 0.10, min: 1, max: 1 }
    ],
    "minecraft:drowned": [
        { item: "iron_ingot", chance: 0.10, min: 1, max: 1 },
        { item: "copper_ingot", chance: 0.20, min: 1, max: 2 }
    ]
};

world.afterEvents.entityDie.subscribe((ev) => {
    const killer = ev.damageSource?.damagingEntity;
    if (!killer || killer.typeId !== "minecraft:player") return;

    const dead = ev.deadEntity;
    if (!dead) return;
    const drops = BONUS_DROPS[dead.typeId];
    if (!drops) return;

    for (const d of drops) {
        if (Math.random() > d.chance) continue;
        const count = Math.floor(Math.random() * (d.max - d.min + 1)) + d.min;
        try {
            killer.runCommand(`give @s ${d.item} ${count}`);
        } catch (e) { /* inventory full or other — skip silently */ }
    }
});
