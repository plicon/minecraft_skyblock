// Chat Commands & UI Menu
// Players type chat commands prefixed with "!"
//   !island        - open menu
//   !home / !is    - teleport to your island
//   !reset         - reset your island (with confirmation)
//   !quests        - show quest progress
//   !spawn         - go to world spawn

import { world, system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { teleportToIsland } from "./island_manager.js";
import { QUESTS, getProgress, isDone } from "./quests.js";

world.beforeEvents.chatSend.subscribe((ev) => {
    const msg = ev.message.trim();
    if (!msg.startsWith("!")) return;
    ev.cancel = true; // don't broadcast the command

    const player = ev.sender;
    const parts = msg.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();

    // UI must be opened on the next tick (can't open from beforeEvent directly)
    system.run(() => handleCommand(player, cmd, parts.slice(1)));
});

function handleCommand(player, cmd, args) {
    switch (cmd) {
        case "island":
        case "is":
            openMenu(player);
            break;
        case "home":
        case "go":
            teleportToIsland(player);
            break;
        case "quests":
        case "q":
            showQuests(player);
            break;
        case "reset":
            confirmReset(player);
            break;
        case "spawn":
            try {
                const sp = world.getDefaultSpawnLocation();
                player.teleport(sp, { dimension: world.getDimension("overworld") });
                player.sendMessage("§b[Skyblock] §aTeleported to spawn.");
            } catch (e) {
                player.sendMessage("§c[Skyblock] Could not teleport to spawn.");
            }
            break;
        case "help":
            showHelp(player);
            break;
        default:
            player.sendMessage(`§c[Skyblock] Unknown command: !${cmd}. Type §f!help`);
    }
}

function showHelp(player) {
    player.sendMessage("§b[Skyblock] §7Commands:");
    player.sendMessage("§f!island §7- open the menu");
    player.sendMessage("§f!home §7- teleport to your island");
    player.sendMessage("§f!quests §7- view quests");
    player.sendMessage("§f!reset §7- reset your island");
    player.sendMessage("§f!spawn §7- go to world spawn");
}

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
    const form = new ActionFormData()
        .title("§b§lQuests")
        .body(body)
        .button("§7Close");
    form.show(player);
}

function confirmReset(player) {
    const form = new MessageFormData()
        .title("§c§lReset Island?")
        .body("§7This will §cnot delete blocks§7, but you will be teleported back to your island spawn. Your quest progress is also reset.\n\n§eContinue?")
        .button1("§cYes, reset")
        .button2("§7Cancel");

    form.show(player).then((res) => {
        if (res.canceled || res.selection !== 0) return;
        // Reset quest progress
        for (const q of QUESTS) {
            world.setDynamicProperty(`sb:quest:${player.id}:${q.id}`, undefined);
        }
        teleportToIsland(player);
        player.sendMessage("§b[Skyblock] §aQuest progress reset. §7(Blocks remain — clear them manually if needed.)");
    });
}
