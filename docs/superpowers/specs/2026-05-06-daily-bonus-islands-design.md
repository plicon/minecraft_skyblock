# Daily Bonus Islands + Void Respawn — Design

**Status:** Draft (revised — chain layout + themes)
**Date:** 2026-05-06
**Pack version target:** `1.1.0`

## Doel

Twee uitbreidingen op het bestaande Skyblock-addon:

1. **Daily bonus islands** — elke speler krijgt automatisch een nieuw bonus-eiland zodra een Minecraft-nacht voorbij is (sunrise = `world.getDay()` ophoogt). Eilanden vormen een **organische keten** rond het hoofdeiland: elk nieuw eiland wordt geplaatst op *bouwbare afstand* (bridge-able) van het vorige, op een variërende hoogte — zodat de speler letterlijk een archipel opbouwt en van eiland naar eiland kan reizen. De UX is volledig knop-gebaseerd (Xbox-controller-vriendelijk, geen typen nodig).
2. **Void respawn** — als een speler in de void valt (of op een andere manier overlijdt), respawnt hij op zijn hoofdeiland in plaats van op world spawn.

## Design principes

- **Auto > command.** Spelers hoeven niets te typen. Eiland verschijnt automatisch, navigatie via UI menu.
- **Geen breaking changes.** Bestaande dynamic property keys blijven onaangetast; bestaande spelers krijgen feature lazy zonder migratie.
- **Stable APIs only.** `@minecraft/server` 1.17.0 en `@minecraft/server-ui` 1.3.0, conform `CLAUDE.md`.
- **YAGNI.** Geen streaks, geen claim-cooldowns, geen reset-knop voor bonuseilanden in v1. Komt eventueel later.
- **Eilanden zijn organisch geketend**, niet in een vaste grid. Elk nieuw eiland verbindt aan een eerder eiland binnen bouwbare afstand — speler kan met blocks bridges/staircases bouwen om er heen te komen.
- **Themed islands** — elk bonus eiland heeft een willekeurig thema (Forest, Tundra, Desert, Jungle, Mushroom, Nether, Cherry) dat zichtbaar is aan blokken én chest-loot. Maakt elke ochtend verrassend en geeft elk eiland een eigen rol in de archipel.

---

## 1. Trigger — Minecraft day rollover

### Mechaniek

Een `system.runInterval` (elke 100 ticks ≈ 5 sec) loopt over alle online spelers en vergelijkt `world.getDay()` met de opgeslagen laatste claim-day per speler:

```
currentDay = world.getDay()
voor elke online speler:
    lastDay = world.getDynamicProperty("sb:dailyLastDay:" + player.id)
    als lastDay === undefined:
        zet lastDay = currentDay (initialisatie, geen claim)
    als currentDay > lastDay:
        genereer bonus-eiland
        zet lastDay = currentDay
```

### Eigenschappen

- **Granulariteit:** één claim per `world.getDay()` increment, ongeacht hoeveel days er voorbij zijn (anti-stacking bij lange afwezigheid).
- **Self-throttling:** `world.getDay()` advanced alleen als chunks ticken; offline ≠ tijdverloop. ~20 real-time minuten per Minecraft-day.
- **Eerste join:** main island wordt gegenereerd in dezelfde stap als `lastDay = currentDay`, dus speler krijgt geen bonus tegelijk met zijn main.

### Edge cases

| Scenario | Gedrag |
|---|---|
| Speler offline tijdens rollover | Krijgt bij volgende join (`currentDay > lastDay`). |
| Speler 5 dagen weg geweest | Krijgt **één** bonus, niet vijf. |
| Server restart midden in nacht | Geen probleem; `world.getDay()` is wereldopgeslagen, comparison werkt nog. |
| Geen geldige plek na N retries (collision) | Bonus skip + chat melding "Geen ruimte gevonden — probeer later"; `lastDay` wordt **niet** opgehoogd. Volgende rollover probeert opnieuw met nieuwe random seed. |

---

## 2. Bonus eilanden — locatie & content

### Chain layout (organisch, geen grid)

Elke nieuwe bonus verbindt aan een **anchor eiland** op een willekeurige plek binnen *bouwbare afstand*. De keten groeit organisch outward van main, met variërende hoogtes — past bij het sky-thema.

#### Constanten

| Naam | Waarde | Reden |
|---|---|---|
| `BONUS_DIST_MIN` | 32 | Minimaal bouwbaar (3-4 blokken bridgen + sprong) |
| `BONUS_DIST_MAX` | 64 | Maximaal bouwbaar zonder al te tedious te worden |
| `BONUS_Y_DELTA` | ±16 | Vertical offset t.o.v. anchor; geeft sky-feel zonder onbereikbaar te worden |
| `BONUS_Y_MIN` | 60 | Floor — voorkom dat speler eilanden onder void-spawnplatform krijgt |
| `BONUS_Y_MAX` | 140 | Plafond — onder build-limit, ruim onder cloud layer |
| `BONUS_MIN_SEPARATION` | 16 | Min afstand tussen 2 eilandcentra (geen overlap met 5×5 platforms) |
| `BONUS_TERRITORY_RADIUS` | 480 | Max horizontale afstand van main; voorkomt botsen met buur-territorium |
| `BONUS_PLACEMENT_RETRIES` | 12 | Aantal random pogingen voor geldige plek voordat we opgeven |

> **Spacing rationale:** main islands staan 1024 uit elkaar. Met `BONUS_TERRITORY_RADIUS=480` houdt elke speler een buffer van 64 blokken tussen z'n verste bonus en zijn buurman's verste bonus. Geen botsingen.

#### Plaatsings-algoritme

```
def pickBonusLocation(playerId):
    main = parse "sb:island:<playerId>"       # {x, z} (y=ISLAND_Y=80)
    bonusList = getBonusIslands(playerId)     # [{x,y,z}, ...]
    anchor = bonusList[-1] if bonusList else {x: main.x, y: ISLAND_Y, z: main.z}
    allCenters = [{x: main.x, y: ISLAND_Y, z: main.z}, ...bonusList]

    voor poging in 1..BONUS_PLACEMENT_RETRIES:
        angle = random(0, 2π)
        dist  = random(BONUS_DIST_MIN, BONUS_DIST_MAX)
        dx, dz = cos(angle)*dist, sin(angle)*dist
        dy    = random(-BONUS_Y_DELTA, +BONUS_Y_DELTA)

        cx = round(anchor.x + dx)
        cz = round(anchor.z + dz)
        cy = clamp(anchor.y + dy, BONUS_Y_MIN, BONUS_Y_MAX)

        # Territory check: max 480 horizontaal van main
        if dist2D({cx,cz}, main) > BONUS_TERRITORY_RADIUS:
            continue   # te ver, retry

        # Collision check: minimaal 16 van elk bestaand eiland
        if min over allCenters of dist3D(c, {cx,cy,cz}) < BONUS_MIN_SEPARATION:
            continue   # botsing, retry

        return {x: cx, y: cy, z: cz}

    return null   # Geen geldige plek gevonden
```

#### Eigenschappen van het algoritme

- **Anchor = laatste bonus** → keten groeit lineair van vorig eiland naar volgend. Speler ervaart een "pad" van eilanden.
- **Eerste bonus** anchort aan main, dus altijd zichtbaar vanaf hoofdbasis.
- **Random angle** geeft natuurlijk meanderend pad — geen rechte lijn.
- **Y delta** is relatief, dus de keten kan langzaam stijgen of dalen, maar blijft in het [60, 140] band.
- **Territory check** stuurt de keten subtiel terug naar huis als hij te ver afdwaalt (door retry). De speler merkt hier niets van behalve dat eilanden binnen handbereik blijven.
- **Geen hard cap** op aantal eilanden. Praktische limiet komt voort uit territory + min-separation: theoretisch ~600 eilanden mogelijk vóór ruimte vol is. In de praktijk irrelevant.

### Content (per bonus eiland)

Geparametrizeerd op zowel Y als **theme**. Bestaande `generateIsland(dimension, cx, cz)` (Y hardcoded) refactoren naar:

```js
generateIsland(dimension, cx, cy, cz, theme)
```

Het main island gebruikt theme `forest` (gelijk aan oude gedrag → geen visuele verandering voor bestaande spelers). Bonus eilanden kiezen een random theme uit het registry (zie §3 hieronder).

Algemene structuur (constant tussen themes):
- 5×5 platform op (cx, cy) — surface block per theme
- 2 lagen "subsoil" op cy-1 en cy-2 — sub block per theme
- "Tree" / focal point in NW hoek (cx-2, cz-2) — themespecifiek (log+leaves, cactus, mushroom, etc.)
- Chest op (cx+2, cy+1, cz) met theme-loot

---

## 3. Themes

### Theme registry

Een data-driven registry van 7 themes. Elk theme is een plain object — eenvoudig uit te breiden zonder code-wijzigingen.

| ID | Naam | Symbool | Surface | Subsoil | Tree-stijl | Loot (chest) |
|---|---|---|---|---|---|---|
| `forest` | Forest | 🌲 | grass_block | dirt | oak_log + oak_leaves canopy | ice ×2, lava_bucket, bone ×4, sapling ×2, melon_seeds, pumpkin_seeds, sugar_cane, cactus, wheat_seeds ×2 |
| `tundra` | Tundra | ❄️ | snow_block | packed_ice | spruce_log + spruce_leaves | ice ×4, snowball ×8, spruce_sapling ×2, leather ×2, beetroot_seeds, lava_bucket |
| `desert` | Desert | 🏜️ | sand | sandstone | cactus column (4 high) — geen leaves | sand ×8, cactus ×2, dead_bush, bone ×2, dried_kelp ×4, lava_bucket, wheat_seeds ×2 |
| `jungle` | Jungle | 🌴 | grass_block | dirt | jungle_log + jungle_leaves canopy | jungle_sapling ×2, melon_slice ×4, cocoa_beans ×3, bamboo ×4, lava_bucket, wheat_seeds ×2, ice |
| `mushroom` | Mushroom | 🍄 | mycelium | dirt | red_mushroom_block 2×2×2 (huge mushroom) | red_mushroom ×4, brown_mushroom ×4, beetroot_seeds, mushroom_stem ×2, lava_bucket, ice |
| `nether` | Nether | 🔥 | netherrack | soul_sand | crimson_stem + nether_wart_block canopy | nether_wart ×4, glowstone ×2, soul_sand ×4, blaze_powder ×2, gold_nugget ×4, lava_bucket |
| `cherry` | Cherry | 🌸 | grass_block | dirt | cherry_log + cherry_leaves canopy | cherry_sapling ×2, sweet_berries ×4, oak_sapling, lava_bucket, ice, wheat_seeds ×4, bone ×2 |

> **Symbool-keuze:** ASCII-fallback letters worden gebruikt in label-tekst (`F`/`T`/`D`/`J`/`M`/`N`/`C`) omdat Bedrock chat geen kleur-emoji rendert. Het symbool in de tabel is voor de spec-leesbaarheid; de daadwerkelijke menu-label gebruikt **kleurcodes per theme**.

### Theme kleurcodes (Minecraft § codes)

Voor visuele herkenbaarheid in de menu-lijst krijgt elk theme een chat color:

| Theme | Color code | Display |
|---|---|---|
| Forest | `§a` (green) | §aForest |
| Tundra | `§b` (aqua) | §bTundra |
| Desert | `§e` (yellow) | §eDesert |
| Jungle | `§2` (dark green) | §2Jungle |
| Mushroom | `§5` (dark purple) | §5Mushroom |
| Cherry | `§d` (light purple / pink) | §dCherry |
| Nether | `§c` (red) | §cNether |

Alle 7 unieke kleuren — direct herkenbaar in de menu-lijst.

### Theme selectie (gewogen random)

Elke bonus genereert een willekeurig theme uit een gewogen pool — gewone themes vaker, exotische themes zeldzaam:

| Theme | Weight | Effectief % |
|---|---|---|
| Forest | 25 | 25% |
| Tundra | 15 | 15% |
| Desert | 15 | 15% |
| Jungle | 15 | 15% |
| Mushroom | 10 | 10% |
| Cherry | 10 | 10% |
| Nether | 10 | 10% |

Implementatie: simpele weighted-pick. Geen anti-repeat logica in v1 (kan later: "max 2× zelfde theme achter elkaar").

### Theme-aware generation

Pseudo-code voor de geparametrizeerde generator:

```
def generateIsland(dim, cx, cy, cz, theme):
    # Platform: 5x5 surface + 2 lagen subsoil
    voor dx in -2..2, dz in -2..2:
        zet (cx+dx, cy, cz+dz) op theme.surface
        zet (cx+dx, cy-1, cz+dz) op theme.sub
        zet (cx+dx, cy-2, cz+dz) op theme.sub

    # Focal point in NW corner — gedelegeerd aan theme.placeFocal()
    theme.placeFocal(dim, cx-2, cy, cz-2)

    # Chest met theme.loot op (cx+2, cy+1, cz)
    zet (cx+2, cy+1, cz) op chest
    voor (slot, item, count) in enumerate(theme.loot):
        replaceitem block ... slot.container <slot> <item> <count>
```

Per theme is `placeFocal` een korte functie. Voorbeelden:

```js
forest.placeFocal = (dim, x, y, z) => {
    // 4 oak_log + 3x3x3 oak_leaves canopy (huidige tree-pattern, 1:1)
}
desert.placeFocal = (dim, x, y, z) => {
    // 4 cactus stacked, geen leaves
}
mushroom.placeFocal = (dim, x, y, z) => {
    // Single huge red_mushroom_block, of 2x2x2 cluster
}
```

Compact, data-driven, makkelijk uit te breiden.

---

## 4. Storage schema (dynamic properties)

### Bestaande keys (niet gewijzigd)

| Key | Type | Inhoud |
|---|---|---|
| `sb:islandCounter` | number | Globale spiraal-teller voor main islands |
| `sb:island:<playerId>` | string `"x,z"` | Hoofdeiland coords |
| `sb:visited:<playerId>` | bool | Of speler ooit is verschenen (initial spawn-flag) |
| `sb:quest:<playerId>:<questId>` | number | Quest progress |

### Nieuwe keys

| Key | Type | Inhoud |
|---|---|---|
| `sb:dailyLastDay:<playerId>` | number | Laatste Minecraft-day waarop bonus is geclaimd |
| `sb:bonusIslands:<playerId>` | string | CSV `"x,y,z,theme;x,y,z,theme;..."` van bonus-eilanden in claim-volgorde (theme = id uit registry, bv. `forest`) |
| `sb:spawnSet:<playerId>` | bool | Markeer dat `/spawnpoint` voor deze speler al gezet is (idempotency) |

### Helper-functies (in `island_manager.js`)

```
getBonusIslands(playerId) → Array<{x, y, z, theme}>
  // parse CSV uit sb:bonusIslands

appendBonusIsland(playerId, x, y, z, theme)
  // append to CSV

pickBonusLocation(playerId) → {x, y, z} | null
  // chain placement algoritme uit sectie 2; null als geen plek na N retries

pickRandomTheme() → themeId
  // weighted random uit theme registry (zie §3)

getAllIslands(playerId) → Array<{type, label, x, y, z, theme}>
  // [{type:"main", label:"★ Main Island", theme:"forest", x, y, z},
  //  {type:"bonus", label:"① Day 1", theme:"tundra", x, y, z}, ...]
```

---

## 5. Player UX

### Bij claim — chat melding

```
§b[Skyblock] §6Een nieuwe Minecraft-dag is aangebroken!
§b[Skyblock] §aBonus-eiland #N — {§colorTheme} {ThemeName}§r — gegenereerd op (x, y, z).
§7Open §f!island§7 → §fMy Islands§7 om te bezoeken.
```

Voorbeeld:
```
§b[Skyblock] §aBonus-eiland #3 — §dCherry§r — gegenereerd op (45, 88, -167).
```

Geen auto-teleport — speler kan rustig doorspelen op huidig eiland.

### Menu uitbreiding

In `!island` menu (ActionForm) komt een nieuwe knop **"§eMy Islands"** tussen "Teleport to my Island" en "View Quests". Bij klik opent een nieuwe form met genummerde lijst:

```
┌──────────────────────────────────────────────┐
│   §b§lMy Islands                             │
├──────────────────────────────────────────────┤
│ ★ Main          §aForest    — y 80           │  → teleport naar main
│ ① Day 1         §bTundra    — y 88, NE 47    │  → teleport naar bonus 1
│ ② Day 2         §eDesert    — y 76, E 112    │  → teleport naar bonus 2
│ ③ Day 3         §dCherry    — y 92, SE 178   │  → ...
│   §7Close                                    │
└──────────────────────────────────────────────┘
```

Label-format: `§{symbol} Day {N}  §{themeColor}{ThemeName}§r — y {Y}, {dir} {distFromMain}`.
- `{symbol}`: `★` voor main, `①②③…` voor bonus 1..N (Unicode circled digits, fallback `(N)` boven 20)
- `{themeColor}{ThemeName}`: gekleurde theme-naam uit §3 registry (bv. `§bTundra`)
- `{dir}`: kompas-richting van main naar dit eiland (N/NE/E/SE/S/SW/W/NW)
- `{distFromMain}`: 2D Euclidische afstand van main, op gehele blokken

Helpt de speler om mentaal kaart te bouwen: ze zien meteen of een eiland hoog (y 88), oost (E) en op middellange afstand (112 blokken) is — én van welk thema.

Klik op een rij → `player.teleport(...)` direct (geen confirmation, snel & soepel).

### Bestaande commands blijven werken

- `!home` / `!go` — teleport naar **main** island (ongewijzigd)
- `!island` / `!is` — opent menu (nu met "My Islands" knop)
- Geen nieuwe chat-commands toegevoegd (Xbox-vriendelijk)

---

## 6. Void respawn → main island

### Mechaniek

In `getOrCreateIsland`, na main island generatie en zodra coords bekend zijn, executeren we een `/spawnpoint` command voor de speler:

```
player.runCommand(`spawnpoint @s ${cx} ${ISLAND_Y + 1} ${cz}`)
world.setDynamicProperty("sb:spawnSet:" + player.id, true)
```

Hierdoor respawnt de speler op zijn hoofdeiland bij elke vorm van overlijden (void, mob, fall damage, drowning, etc).

### Idempotency voor bestaande spelers

Bestaande spelers (al een main island vóór deze update) hebben hun spawnpoint nog op world spawn staan. We lossen dat lazy op via een hook in `playerSpawn`:

```
on playerSpawn (initialSpawn=true):
    als sb:spawnSet:<playerId> niet gezet en sb:island:<playerId> bestaat:
        parse coords uit sb:island:<playerId>
        run spawnpoint command
        zet sb:spawnSet:<playerId> = true
```

Volgt het bestaande pattern in `island_manager.js` voor de `playerSpawn` event subscriber.

### Vanilla mechanics behouden

- **Beds:** spelers die in een bed slapen overschrijven hun spawnpoint via vanilla mechanic. Dat blijft gewoon werken.
- **Respawn anchor:** idem.
- **`/setworldspawn`:** werkt nog voor admins; spelers met persoonlijke spawnpoint krijgen voorrang.

### Geen aparte void-damage detectie

Vanilla void damage doodt de speler reeds binnen ~3 ticks. Met de nieuwe spawnpoint komen ze automatisch op main. We hoeven dus géén `entityHurt` met `damageCause === "void"` te subscriben — simpeler en robuuster.

---

## 7. Bestandsstructuur

### Nieuwe bestanden

- `scripts/themes.js` — theme registry (Forest, Tundra, Desert, Jungle, Mushroom, Nether, Cherry) + `pickRandomTheme()` + per-theme `placeFocal` functies
- `scripts/daily_islands.js` — day-rollover loop + bonus eiland generatie (delegeert aan `island_manager.js` voor placement & generation)

### Gewijzigde bestanden

| Bestand | Wijzigingen |
|---|---|
| `scripts/main.js` | `import "./daily_islands.js"` toevoegen |
| `scripts/island_manager.js` | `generateIsland` parametrizeren op Y én theme. Helpers `getBonusIslands`, `appendBonusIsland`, `getAllIslands`, `pickBonusLocation` exporteren. Spawnpoint zetten na main-generatie + lazy hook in bestaande `playerSpawn` subscriber. Main island gebruikt theme `forest` (geen visuele change). |
| `scripts/commands.js` | "My Islands" knop in `openMenu`. Nieuwe `showIslandList(player)` functie met theme-gekleurde labels en teleport-on-click. |
| `manifest.json` | `header.version` en module versions naar `[1, 1, 0]`. |
| `README.md` | Sectie "Daily bonus islands" (incl. theme overzicht) + "Void respawn" toevoegen aan Features en uitleg. |

### Module verantwoordelijkheden (na changes)

- **`themes.js`** — pure data: theme registry, theme-color, theme-loot, focal-builders. Geen events, geen state.
- **`island_manager.js`** — alle island state (main + bonus), placement-algorithm, generatie-helpers, spawnpoint, teleport
- **`daily_islands.js`** — alleen day-rollover detection en het *triggeren* van bonus-generatie (delegeert aan `island_manager.js` + `themes.js`)
- **`commands.js`** — alle UI / chat
- **`quests.js`, `balance.js`** — ongewijzigd

---

## 8. Test plan (handmatig op BDS)

| # | Scenario | Verwachte gedrag |
|---|---|---|
| 1 | Nieuwe speler joint voor 't eerst | Krijgt main island; `lastDay = currentDay`; spawnpoint zit op main; geen bonus melding. |
| 2 | Speler wacht in spel tot zonsopkomst | ~20 min real-time later: chat melding noemt theme-naam in kleur; bonus eiland verschijnt op 32-64 blokken van main, y in [60-140], met theme-blokken (snow voor Tundra, sand voor Desert, etc). |
| 3 | `!island` → My Islands | Lijst toont "★ Main §aForest" + "① Day 1 §{color}{Theme} — y X, dir, dist". Klik op #1 → teleport naar bonus 1. |
| 3b | Genereer 50 bonuseilanden, controleer theme-distributie | Statistisch: ~25% Forest, ~15% Tundra/Desert/Jungle elk, ~10% Mushroom/Cherry/Nether elk. Geen theme ontbreekt na 50 trials. |
| 3c | Open chest op Tundra eiland | Chest bevat theme-loot (ice ×4, snowball ×8, spruce_sapling ×2, leather ×2, beetroot_seeds, lava_bucket). Geen forest-loot. |
| 4 | Speler springt in void | Sterft, respawnt op main island (niet op world spawn, niet op bonus). |
| 5 | Bestaande speler (van pre-1.1.0) joint na update | Krijgt geen bonus; spawnpoint wordt gezet bij eerstvolgende `initialSpawn`; void-test werkt. |
| 6 | Speler offline 3 dagen, joint dan | Krijgt **één** bonus, niet drie. `lastDay` springt direct naar `currentDay`. |
| 7 | 20 bonuseilanden geclaimd | Geen cap melding; eilanden meanderen organisch verder maar blijven binnen `BONUS_TERRITORY_RADIUS=480` van main. |
| 8 | Twee spelers tegelijk online, day rollover | Beide krijgen onafhankelijk hun bonus zonder race condition (dynamic properties zijn per-key atomic). |
| 9 | Bonus eiland generatie ergens dicht bij vorig eiland | Bridge bouwen van anchor → nieuw eiland werkt (max 64 blokken horizontaal, max ±16 vertikaal). |
| 10 | Veel claims tegelijk in dichte territorium | Na ~12 retries zonder geldige plek → chat: "Geen ruimte gevonden — probeer later"; `lastDay` blijft op vorige. |

---

## 9. Out of scope (later misschien)

- Streak-bonus (extra reward na X dagen achter elkaar)
- "Reset bonus islands" knop in menu
- Custom eiland-naam per speler (`Edit name` in My Islands)
- Visuele markers / waypoints op de minimap of compass
- Anti-repeat in theme selectie (max 2× zelfde theme achter elkaar)
- Theme-specifieke quests (bv. "Mine 8 mushroom blocks op een Mushroom-eiland")
- Auto-bridges genereren tussen aangrenzende eilanden
- "View on map" preview van archipel-layout vanuit menu
- Extra themes (Ocean, End, Mining, Bamboo, Savanna, …)
