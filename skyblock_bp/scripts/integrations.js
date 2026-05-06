// Third-party addon integrations
// User-editable config: fill in the item/block IDs of the addons you've
// installed alongside this Skyblock pack. Leave null to disable a feature.
//
// How to find a block/item ID:
//   1. Unzip the addon's .mcaddon file (it's just a renamed .zip)
//   2. Open <addon_bp>/blocks/*.json or items/*.json
//   3. The "minecraft:block.description.identifier" or
//      "minecraft:item.description.identifier" field is the ID

export const INTEGRATIONS = {
    /**
     * Lucky Blocks integration.
     * Most popular Bedrock pack uses ID "lucky:lucky_block" — check yours.
     * When configured:
     *   - 10% chance a bonus island chest contains a Lucky Block
     *   - New quest: "Gelukspoes — Hak een Lucky Block"
     */
    luckyBlock: {
        // Default for Effect99's Lucky Blocks pack on CurseForge.
        // Other Effect99 variants you can swap to: effect99:lucky_block,
        // effect99:lucky_horror, etc. — check packs/<name>/blocks/*.json.
        blockId:     "effect99:lucky_mobs",
        itemId:      "effect99:lucky_mobs",
        chestChance: 0.10,
        questTarget: 1
    },

    /**
     * Fun/Cosmetic TNT integration (Pink TNT, Confetti TNT, etc).
     * When configured:
     *   - 8% chance a bonus chest contains a few "fun TNT" items
     *   - New quest: "Pyromaan — Vind X Roze TNT"
     */
    funTnt: {
        // Default for DouarMC's More TNT pack on CurseForge (stable APIs).
        // Lightning TNT is a fun-but-not-too-destructive variant. Other
        // options in the same pack (browse packs/<name>/blocks/*.json):
        //   douarmc_more_tnt:cake_tnt         — cake-themed
        //   douarmc_more_tnt:firework_tnt     — fireworks display
        //   douarmc_more_tnt:teleport_tnt     — teleports nearby entities
        //   douarmc_more_tnt:nuclear_tnt      — for adults only
        itemId:      "douarmc_more_tnt:lightning_tnt",
        displayName: "Bliksem TNT",
        chestChance: 0.08,
        count:       4,
        questTarget: 3
    }
};

export function isLuckyBlockEnabled() {
    return typeof INTEGRATIONS.luckyBlock.blockId === "string"
        && INTEGRATIONS.luckyBlock.blockId.length > 0;
}

export function isFunTntEnabled() {
    return typeof INTEGRATIONS.funTnt.itemId === "string"
        && INTEGRATIONS.funTnt.itemId.length > 0;
}
