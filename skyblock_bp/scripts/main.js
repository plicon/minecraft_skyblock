// Skyblock Addon - Main Entry
// Imports all modules; each module subscribes to its own events.

import "./island_manager.js";
import "./quests.js";
import "./balance.js";
import "./commands.js";
import "./daily_islands.js";

import { world } from "@minecraft/server";

world.afterEvents.worldInitialize?.subscribe?.(() => {
    world.sendMessage("§b[Skyblock] §7Addon loaded successfully.");
});

// Fallback for when worldInitialize isn't available — log on first tick.
import { system } from "@minecraft/server";
let booted = false;
system.runInterval(() => {
    if (!booted) {
        booted = true;
        try {
            world.sendMessage("§b[Skyblock] §7Ready. Type §a!island§7 in chat for the menu.");
        } catch (e) { /* world not ready yet */ }
    }
}, 20);
