// Skyblock Custom Commands & UI Menu
// Registers /skyblock:island (typeable as /island), /home, /quests, /reset,
// /spawn so players can open menus and teleport without typing chat.
//
// Why custom commands instead of `!chat`: world.beforeEvents.chatSend was
// moved from stable to beta in @minecraft/server. Beta APIs are off-limits
// per CLAUDE.md, so we use the stable Custom Commands API. Bonus: it shows
// up in Bedrock's command autocomplete (great for Xbox players).

import { world, system, CommandPermissionLevel } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { teleportToIsland, getAllIslands } from "./island_manager.js";
import { QUESTS, getProgress, isDone } from "./quests.js";

// --- Command registration ---
// Callbacks run in restricted mode; mutations must be deferred via system.run().
system.beforeEvents.startup.subscribe((ev) => {
    const reg = ev.customCommandRegistry;

    const command = (name, description, handler) => {
        reg.registerCommand({
            name: `skyblock:${name}`,
            description,
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false
        }, (origin) => {
            const player = origin.sourceEntity;
            if (!player || player.typeId !== "minecraft:player") return;
            system.run(() => handler(player));
        });
    };

    command("island", "Open the Skyblock menu",               openMenu);
    command("home",   "Teleport to your main island",         teleportToIsland);
    command("quests", "View your quest progress",             showQuests);
    command("reset",  "Reset your quest progress (confirms)", confirmReset);
    command("spawn",  "Teleport to world spawn",              teleportSpawn);
});

// --- Handlers ---

function teleportSpawn(player) {
    try {
        const sp = world.getDefaultSpawnLocation();
        player.teleport(sp, { dimension: world.getDimension("overworld") });
        player.sendMessage("§b[Skyblock] §aTeleported to spawn.");
    } catch (e) {
        player.sendMessage("§c[Skyblock] Could not teleport to spawn.");
    }
}

function openMenu(player) {
    const form = new ActionFormData()
        .title("§b§lSkyblock Menu")
        .body("§7Choose an option:")
        .button("§aTeleport to my Island", "textures/items/ender_pearl")
        .button("§dMy Islands", "textures/items/map_filled")
        .button("§eView Quests", "textures/items/book_writable")
        .button("§cReset Quest Progress", "textures/blocks/tnt_side")
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

function showIslandList(player) {
    const islands = getAllIslands(player.id);
    if (islands.length === 0) {
        player.sendMessage("§b[Skyblock] §7Je hebt nog geen eiland.");
        return;
    }

    const form = new ActionFormData()
        .title("§b§lMy Islands")
        .body("§7Klik om te teleporteren:");

    for (const isl of islands) form.button(isl.label);

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

function showQuests(player) {
    let body = "§7Your progress:\n\n";
    for (const q of QUESTS) {
        if (isDone(player, q)) {
            body += `§a✓ ${q.name} §7- ${q.desc}\n`;
        } else {
            const p = getProgress(player, q);
            body += `§e◯ ${q.name} §7- ${q.desc} §8(${p}/${q.target})\n`;
        }
    }
    new ActionFormData()
        .title("§b§lQuests")
        .body(body)
        .button("§7Close")
        .show(player);
}

function confirmReset(player) {
    new MessageFormData()
        .title("§c§lReset Quest Progress?")
        .body("§7Dit reset al je quest-progressie. §cBlokken blijven§7. Je wordt teleporteerd naar je hoofdeiland.\n\n§eDoorgaan?")
        .button1("§cYes, reset")
        .button2("§7Cancel")
        .show(player).then((res) => {
            if (res.canceled || res.selection !== 0) return;
            for (const q of QUESTS) {
                world.setDynamicProperty(`sb:quest:${player.id}:${q.id}`, undefined);
            }
            teleportToIsland(player);
            player.sendMessage("§b[Skyblock] §aQuest progress reset.");
        });
}

function showHelp(player) {
    player.sendMessage("§b[Skyblock] §7Commands:");
    player.sendMessage("§f/island §7- open the menu");
    player.sendMessage("§f/home §7- teleport to your island");
    player.sendMessage("§f/quests §7- view quests");
    player.sendMessage("§f/reset §7- reset your quest progress");
    player.sendMessage("§f/spawn §7- go to world spawn");
    player.sendMessage("§7(of namespaced: §f/skyblock:island§7 enz.)");
}
