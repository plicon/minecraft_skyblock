// Skyblock Custom Commands & UI Menu
// Registers /skyblock:island (typeable as /island), /home, /quests, /reset,
// /spawn so players can open menus and teleport without typing chat.
//
// All player-facing text is in Dutch (target audience: 6-year-old).
//
// Why custom commands instead of `!chat`: world.beforeEvents.chatSend was
// moved from stable to beta in @minecraft/server. Beta APIs are off-limits
// per CLAUDE.md, so we use the stable Custom Commands API. Bonus: it shows
// up in Bedrock's command autocomplete (great for Xbox players).

import { world, system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { teleportToIsland, getAllIslands, getMainIsland } from "./island_manager.js";
import { QUESTS, getProgress, isDone } from "./quests.js";

// CommandPermissionLevel.Any = 0. Hardcoded as a literal to avoid relying on
// the enum being a named export — its export shape has shifted between
// @minecraft/server versions, but the numeric value is stable.
const PERM_ANY = 0;

// --- Command registration ---
// Callbacks run in restricted mode; mutations must be deferred via system.run().
system.beforeEvents.startup.subscribe((ev) => {
    const reg = ev.customCommandRegistry;

    const command = (name, description, handler) => {
        reg.registerCommand({
            name: `skyblock:${name}`,
            description,
            permissionLevel: PERM_ANY,
            cheatsRequired: false
        }, (origin) => {
            const player = origin.sourceEntity;
            if (!player || player.typeId !== "minecraft:player") return;
            system.run(() => handler(player));
        });
    };

    command("island", "Open het Skyblock-menu",                  openMenu);
    command("home",   "Ga naar je hoofdeiland",                  teleportToIsland);
    command("visit",  "Ga op bezoek bij een andere speler",      showVisitList);
    command("quests", "Bekijk je opdrachten",                    showQuests);
    command("reset",  "Begin je opdrachten opnieuw (vraagt OK)", confirmReset);
    command("spawn",  "Ga naar het beginpunt van de wereld",     teleportSpawn);
});

// --- Menu compass ---
// Holding a compass and using it (right-click / ZL / tap) opens the menu.
// Zero-typing UX for console players where the chat-/-button is awkward.
world.afterEvents.itemUse.subscribe((ev) => {
    if (ev.itemStack?.typeId !== "minecraft:compass") return;
    const player = ev.source;
    if (!player || player.typeId !== "minecraft:player") return;
    openMenu(player);
});

// --- Handlers ---

function teleportSpawn(player) {
    try {
        const sp = world.getDefaultSpawnLocation();
        player.teleport(sp, { dimension: world.getDimension("overworld") });
        player.sendMessage("§b[Skyblock] §aJe bent nu bij het beginpunt.");
    } catch (e) {
        player.sendMessage("§c[Skyblock] Het lukte niet om je te verplaatsen.");
    }
}

function openMenu(player) {
    const form = new ActionFormData()
        .title("§b§lSkyblock-menu")
        .body("§7Wat wil je doen?")
        .button("§aNaar mijn eiland", "textures/items/ender_pearl")
        .button("§dMijn eilanden", "textures/items/map_filled")
        .button("§bBezoek speler", "textures/items/compass_item")
        .button("§eMijn opdrachten", "textures/items/book_writable")
        .button("§cOpdrachten opnieuw", "textures/blocks/tnt_side")
        .button("§7Hulp", "textures/items/paper");

    form.show(player).then((res) => {
        if (res.canceled) return;
        switch (res.selection) {
            case 0: teleportToIsland(player); break;
            case 1: showIslandList(player); break;
            case 2: showVisitList(player); break;
            case 3: showQuests(player); break;
            case 4: confirmReset(player); break;
            case 5: showHelp(player); break;
        }
    });
}

function showVisitList(player) {
    const others = world.getAllPlayers().filter((p) => p.id !== player.id);
    if (others.length === 0) {
        player.sendMessage("§b[Skyblock] §7Er is verder niemand online — speel even mee met iemand anders!");
        return;
    }

    // Filter to players who already have a main island
    const visitable = others
        .map((p) => ({ player: p, main: getMainIsland(p.id) }))
        .filter((entry) => entry.main !== null);

    if (visitable.length === 0) {
        player.sendMessage("§b[Skyblock] §7De andere spelers hebben nog geen eiland.");
        return;
    }

    const form = new ActionFormData()
        .title("§b§lBezoek een speler")
        .body("§7Tik op iemand om naar diens eiland te gaan:");

    for (const entry of visitable) {
        form.button(`§f${entry.player.name}`);
    }

    form.show(player).then((res) => {
        if (res.canceled) return;
        const target = visitable[res.selection];
        if (!target) return;
        const dim = world.getDimension("overworld");
        try {
            // Teleport visitor 1 block above the target's main island spawn
            player.teleport(
                { x: target.main.x + 0.5, y: 81, z: target.main.z + 0.5 },
                { dimension: dim }
            );
            player.sendMessage(`§b[Skyblock] §aJe bent nu bij §f${target.player.name}§r§a!`);
            // Notify the visited player
            try {
                target.player.sendMessage(`§b[Skyblock] §6${player.name}§7 komt op bezoek!`);
                target.player.playSound("random.levelup");
            } catch (e) { /* visited player may have left mid-tp */ }
        } catch (e) {
            player.sendMessage("§c[Skyblock] Het lukte niet om je te verplaatsen — probeer het nog eens.");
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
        .title("§b§lMijn eilanden")
        .body("§7Tik op een eiland om er heen te gaan:");

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
            player.sendMessage(`§b[Skyblock] §aJe bent nu bij §f${target.label}§r§a.`);
        } catch (e) {
            player.sendMessage("§c[Skyblock] Het lukte niet om je te verplaatsen — probeer het nog eens.");
        }
    });
}

function showQuests(player) {
    let body = "§7Hoe ver ben je?\n\n";
    for (const q of QUESTS) {
        if (isDone(player, q)) {
            body += `§a✓ ${q.name} §7- ${q.desc}\n`;
        } else {
            const p = getProgress(player, q);
            body += `§e◯ ${q.name} §7- ${q.desc} §8(${p}/${q.target})\n`;
        }
    }
    new ActionFormData()
        .title("§b§lOpdrachten")
        .body(body)
        .button("§7Sluiten")
        .show(player);
}

function confirmReset(player) {
    new MessageFormData()
        .title("§c§lOpdrachten opnieuw beginnen?")
        .body("§7Je begint helemaal opnieuw met je opdrachten. §cJe blokken blijven staan§7. Je gaat terug naar je hoofdeiland.\n\n§eWeet je het zeker?")
        .button1("§cJa, opnieuw")
        .button2("§7Nee, laat maar")
        .show(player).then((res) => {
            if (res.canceled || res.selection !== 0) return;
            for (const q of QUESTS) {
                world.setDynamicProperty(`sb:quest:${player.id}:${q.id}`, undefined);
            }
            teleportToIsland(player);
            player.sendMessage("§b[Skyblock] §aJe begint opnieuw met je opdrachten!");
        });
}

function showHelp(player) {
    player.sendMessage("§b[Skyblock] §7Wat kun je typen?");
    player.sendMessage("§f/island §7- het menu openen");
    player.sendMessage("§f/home §7- naar je eiland gaan");
    player.sendMessage("§f/visit §7- naar iemand anders gaan");
    player.sendMessage("§f/quests §7- je opdrachten bekijken");
    player.sendMessage("§f/reset §7- opdrachten opnieuw beginnen");
    player.sendMessage("§f/spawn §7- naar het beginpunt gaan");
    player.sendMessage("§7Tip: typ §f/§7 in de chat — Minecraft toont alle commando's.");
}
