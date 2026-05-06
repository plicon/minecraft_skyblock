// Daily Bonus Islands
// Detects Minecraft day rollover (sunrise = world.getDay() increment)
// and triggers bonus island generation per online player.

import { world, system } from "@minecraft/server";
import { generateBonusIsland } from "./island_manager.js";

const DAILY_LAST_DAY_PREFIX = "sb:dailyLastDay:";
const PLAYER_ISLAND_PREFIX = "sb:island:";
const CHECK_INTERVAL_TICKS = 100; // 5 seconds

system.runInterval(() => {
    let currentDay;
    try {
        currentDay = world.getDay();
    } catch (e) {
        return; // world not ready yet
    }

    for (const player of world.getAllPlayers()) {
        // Skip players who don't have a main island yet — island_manager
        // will set them up on first spawn.
        const hasMain = typeof world.getDynamicProperty(PLAYER_ISLAND_PREFIX + player.id) === "string";
        if (!hasMain) continue;

        const key = DAILY_LAST_DAY_PREFIX + player.id;
        const lastDay = world.getDynamicProperty(key);

        // First time we see this player after they have a main island:
        // initialize lastDay to today (no bonus on this rollover, anti-stacking).
        if (typeof lastDay !== "number") {
            world.setDynamicProperty(key, currentDay);
            continue;
        }

        if (currentDay > lastDay) {
            const ok = generateBonusIsland(player);
            if (ok) {
                world.setDynamicProperty(key, currentDay);
            }
            // If !ok (no valid location found), leave lastDay as-is so the
            // next rollover retries with a fresh random seed.
        }
    }
}, CHECK_INTERVAL_TICKS);
