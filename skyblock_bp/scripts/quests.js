// Quest System
// Tracks per-player progress on challenges. Stored as dynamic properties.
// Rewards are given via /give commands.

import { world, system } from "@minecraft/server";

const QUEST_PREFIX = "sb:quest:"; // + playerId + ":" + questId -> count or done

export const QUESTS = [
    {
        id: "cobble_64",
        name: "§eMijnwerker I",
        desc: "Hak 64 cobblestone",
        type: "break",
        block: "minecraft:cobblestone",
        target: 64,
        reward: { item: "iron_ingot", count: 4, msg: "§a4x IJzer" }
    },
    {
        id: "cobble_512",
        name: "§eMijnwerker II",
        desc: "Hak 512 cobblestone",
        type: "break",
        block: "minecraft:cobblestone",
        target: 512,
        reward: { item: "diamond", count: 2, msg: "§b2x Diamant" }
    },
    {
        id: "wood_32",
        name: "§eHouthakker",
        desc: "Hak 32 boomstammen",
        type: "break",
        block: "minecraft:oak_log",
        target: 32,
        reward: { item: "iron_axe", count: 1, msg: "§7IJzeren bijl" }
    },
    {
        id: "zombie_10",
        name: "§eMonsterjager",
        desc: "Versla 10 zombies",
        type: "kill",
        entity: "minecraft:zombie",
        target: 10,
        reward: { item: "golden_apple", count: 2, msg: "§62x Gouden appel" }
    },
    {
        id: "wheat_32",
        name: "§eBoer",
        desc: "Oogst 32 tarwe",
        type: "break",
        block: "minecraft:wheat",
        target: 32,
        reward: { item: "bread", count: 8, msg: "§e8x Brood" }
    },
    {
        id: "obsidian_1",
        name: "§eStoere held",
        desc: "Hak 1 obsidiaan",
        type: "break",
        block: "minecraft:obsidian",
        target: 1,
        reward: { item: "diamond_pickaxe", count: 1, msg: "§bDiamanten houweel" }
    }
];

function progKey(playerId, questId) { return QUEST_PREFIX + playerId + ":" + questId; }

export function getProgress(player, quest) {
    const v = world.getDynamicProperty(progKey(player.id, quest.id));
    return typeof v === "number" ? v : 0;
}

export function isDone(player, quest) {
    const v = world.getDynamicProperty(progKey(player.id, quest.id));
    return v === -1; // -1 = completed (reward given)
}

function setProgress(player, quest, val) {
    world.setDynamicProperty(progKey(player.id, quest.id), val);
}

function tryComplete(player, quest) {
    if (isDone(player, quest)) return;
    const p = getProgress(player, quest);
    if (p >= quest.target) {
        setProgress(player, quest, -1);
        const r = quest.reward;
        try {
            player.runCommand(`give @s ${r.item} ${r.count}`);
        } catch (e) { /* ignore */ }
        player.sendMessage(`§b[Skyblock] §6Opdracht klaar: ${quest.name}§r`);
        player.sendMessage(`§b[Skyblock] §7Beloning: §f${r.msg}`);
        player.playSound("random.levelup");
    }
}

// Track block breaks
world.afterEvents.playerBreakBlock.subscribe((ev) => {
    const player = ev.player;
    const blockId = ev.brokenBlockPermutation.type.id;
    for (const q of QUESTS) {
        if (q.type !== "break" || q.block !== blockId) continue;
        if (isDone(player, q)) continue;
        const cur = getProgress(player, q) + 1;
        setProgress(player, q, cur);
        if (cur === Math.floor(q.target / 2)) {
            player.sendMessage(`§b[Skyblock] §7${q.name}§7: ${cur}/${q.target}`);
        }
        tryComplete(player, q);
    }
});

// Track entity kills
world.afterEvents.entityDie.subscribe((ev) => {
    const killer = ev.damageSource?.damagingEntity;
    if (!killer || killer.typeId !== "minecraft:player") return;
    const deadId = ev.deadEntity?.typeId;
    if (!deadId) return;
    for (const q of QUESTS) {
        if (q.type !== "kill" || q.entity !== deadId) continue;
        if (isDone(killer, q)) continue;
        const cur = getProgress(killer, q) + 1;
        setProgress(killer, q, cur);
        tryComplete(killer, q);
    }
});
