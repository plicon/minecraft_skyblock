# 🏝️ Skyblock Addon voor Minecraft Bedrock

Een complete Skyblock-ervaring voor je eigen Minecraft Bedrock Dedicated Server (BDS) versie **1.21.x**. Elke speler krijgt automatisch een eigen privé-eiland, een quest-systeem houdt voortgang bij, en custom mob drops zorgen dat je écht kunt overleven op een eilandje in het niets.

---

## 📋 Inhoudsopgave

1. [Features](#-features)
2. [Vereisten](#-vereisten)
3. [Installatie (stap voor stap)](#-installatie-stap-voor-stap)
4. [Wereld aanmaken (void wereld)](#-wereld-aanmaken-void-wereld)
5. [Eerste keer testen](#-eerste-keer-testen)
6. [Spelers-handleiding](#-spelers-handleiding)
7. [Quests & beloningen](#-quests--beloningen)
8. [Mob drops](#-mob-drops-balans)
9. [Configuratie aanpassen](#-configuratie-aanpassen)
10. [Updaten](#-updaten)
11. [Troubleshooting](#-troubleshooting)
12. [Bestandsstructuur](#-bestandsstructuur)

---

## ✨ Features

- **Automatische eiland-generatie** — elke speler krijgt bij zijn eerste join een uniek eiland in een grid (1024 blokken uit elkaar)
- **Multi-player ondersteuning** — onbeperkt aantal spelers, elk met eigen eiland
- **Starter chest** — ice, lava bucket, saplings, seeds om mee te beginnen
- **Daily bonus islands** — elke Minecraft-zonsopkomst een nieuw themed eiland erbij, gekoppeld in een keten rond je hoofdbasis (Forest, Tundra, Desert, Jungle, Mushroom, Cherry, Nether)
- **Void respawn** — val je in de void? Geen probleem, je respawnt op je hoofdeiland
- **Quest-systeem** — 6 challenges met progressie-tracking en beloningen
- **Custom mob drops** — iron, diamond, emerald, redstone uit mobs (essentieel voor skyblock balans)
- **Slash commands** — `/island`, `/home`, `/quests`, `/reset`, etc. (met autocomplete in chat)
- **UI menu** — mooi grafisch menu via in-game forms (incl. "My Islands" lijst voor bonus-eilanden)
- **Persistent data** — alles wordt opgeslagen via dynamic properties (overleeft restarts)

---

## 🔧 Vereisten

| Item | Versie / spec |
|------|---------------|
| Minecraft Bedrock Server (BDS) | 1.21.0 of hoger |
| Server-OS | Linux of Windows (BDS executable) |
| Cheats / commands | **Aan** in world settings |
| Scripting / Beta APIs | **Niet nodig** — alleen stable APIs |
| Vrije schijfruimte | < 1 MB voor het pack zelf |

---

## 📦 Installatie (stap voor stap)

> 💡 **Snelle installatie:** als je dit project als git-repo hebt staan, gebruik dan het meegeleverde `deploy.sh` script vanuit de repo root:
> ```bash
> ./deploy.sh /path/to/bedrock_server YourWorldName
> ```
> Dit kopieert het pack en update `world_behavior_packs.json` automatisch (idempotent — meerdere keren draaien = veilig). Onderstaande handmatige stappen zijn alleen nodig als je 't liever zelf doet of geen toegang hebt tot het script.

### Stap 1 — Pack op je server plaatsen

1. Pak het pack uit (als je `skyblock_bp.mcpack` hebt: hernoem naar `.zip` en unzip, of unzip direct).
2. Zorg dat je een map hebt genaamd `skyblock_bp/` met daarin `manifest.json` en de `scripts/` map.
3. Kopieer de hele `skyblock_bp/` map naar de `behavior_packs/` map van je BDS:

```
bedrock_server/
├── bedrock_server (executable)
├── server.properties
├── behavior_packs/
│   └── skyblock_bp/         ← HIER plaatsen
│       ├── manifest.json
│       └── scripts/
│           ├── main.js
│           ├── island_manager.js
│           ├── quests.js
│           ├── balance.js
│           └── commands.js
├── resource_packs/
└── worlds/
    └── <jouw-wereld>/
```

### Stap 2 — Pack activeren in je wereld

Open `worlds/<jouw-wereld>/world_behavior_packs.json`. Bestaat het bestand niet? Maak hem aan met deze inhoud:

```json
[
  {
    "pack_id": "8a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
    "version": [1, 0, 0]
  }
]
```

> 💡 De `pack_id` is de UUID uit `manifest.json` → `header.uuid`. Als je hem aanpast (zie [Configuratie](#-configuratie-aanpassen)), update dan ook deze waarde.

Bestond het bestand al? Voeg het object toe aan de bestaande array.

### Stap 3 — Server settings checken

Open `server.properties` en controleer:

```properties
allow-cheats=true
```

Verder moet je world ook cheats hebben aanstaan. Als je een nieuwe wereld maakt staat dit standaard op `true` zolang `allow-cheats=true`.

### Stap 4 — Server starten

Start `bedrock_server` (Linux: `./bedrock_server`, Windows: `bedrock_server.exe`).

Je moet in de console iets zien als:
```
[INFO] Loading behavior pack Skyblock Addon...
[Scripting] [Skyblock] Addon loaded successfully.
```

✅ Klaar!

---

## 🌍 Wereld aanmaken (void wereld)

Voor de échte skyblock-ervaring wil je een **lege wereld** waar de eilanden in het niets zweven. Sinds Bedrock **1.21.100** heeft Mojang officieel een **"The Void"** preset toegevoegd — dit is verreweg de beste optie omdat je geen extra addons nodig hebt.

### ✅ Aanbevolen: Vanilla "The Void" preset (Bedrock 1.21.100+)

**Wat je krijgt:** een 33×33 platform met één cobblestone block in het midden, op Y=-61. Daarbuiten alleen oneindige lucht/void. Geen structuren, geen mobs (behalve phantoms), geen terrein.

#### Stap 1 — Check je server-versie

```bash
# Linux
./bedrock_server --version

# Of bij start van de server, kijk naar de eerste regel in de console:
# [INFO] Starting Server  Version 1.21.x
```

Als je versie **lager is dan 1.21.100**: download de nieuwste BDS van [minecraft.net/download/server/bedrock](https://www.minecraft.net/en-us/download/server/bedrock) en update eerst.

#### Stap 2 — Wereld lokaal aanmaken (BDS heeft geen GUI)

Een Bedrock Dedicated Server kan niet zelf een Void wereld genereren via `server.properties` — je moet de wereld lokaal in de Minecraft client maken en uploaden.

1. Open **Minecraft Bedrock** op je PC, Xbox, of Switch.
2. Klik **Create New World**.
3. Bij **Game** tab:
   - **Game Mode**: Creative (zet later op Survival)
   - **Cheats**: AAN
4. Bij **World** tab:
   - **World Type**: klik tot je **Flat** krijgt
   - Klik op **Edit Flat World** (of het potlood-icoon)
   - Selecteer preset **"The Void"** 🕳️
5. Geef de wereld een naam (bv. `Skyblock`).
6. Klik **Create**.
7. Spawn je in op de cobblestone platform? ✅ Sluit de wereld weer af.

#### Stap 3 — Wereld vinden op je computer

| Platform | Locatie |
|----------|---------|
| **Windows 10/11** | `%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\minecraftWorlds\` |
| **Android** | `/storage/emulated/0/Android/data/com.mojang.minecraftpe/files/games/com.mojang/minecraftWorlds/` |
| **iOS** | Files app → On My iPhone → Minecraft → games/com.mojang/minecraftWorlds |
| **Xbox / PS / Switch** | Niet direct toegankelijk — gebruik Realms export of een PC |

In die map vind je submappen met cryptische namen (bv. `aBcDeFg12345=`). Zoek de juiste door `levelname.txt` in elke map te openen — die bevat de wereld-naam.

#### Stap 4 — Wereld uploaden naar je server

1. Stop je BDS (`stop` in de console).
2. Kopieer de hele wereld-map naar `bedrock_server/worlds/` op je server.
3. Hernoem hem indien gewenst (bv. `Skyblock`).
4. Open `server.properties` en zet:
   ```properties
   level-name=Skyblock
   level-type=FLAT
   allow-cheats=true
   gamemode=survival
   force-gamemode=false
   ```
5. Voeg je behavior pack toe aan `worlds/Skyblock/world_behavior_packs.json` (zie [Stap 2 hierboven](#stap-2--pack-activeren-in-je-wereld)).
6. Start de server. Klaar! 🎉

> 💡 **Tip:** zet de world-spawn met `/setworldspawn` zodat nieuwe spelers niet op de cobblestone landen — jouw addon teleporteert ze sowieso meteen naar hun eiland, maar het voelt strakker als ze niet eerst op die platform "flikkeren".

### Alternatief: oudere BDS (< 1.21.100)

Geen "The Void" preset beschikbaar? Twee minder ideale opties:

**Optie A — "Bottomless Pit" preset:** geeft een cobblestone+stone platform zonder bedrock floor. Maak hem aan zoals hierboven, maar kies **Bottomless Pit** in plaats van **The Void**. Spelers kunnen door het platform graven naar de void. Werkt vanaf Bedrock 1.21.80.

**Optie B — Normale wereld, eilanden op y=80:** doe gewoon niets speciaals. Eilanden worden op hoogte 80 boven normaal terrein geplaatst. Met 1024 blokken spacing zien spelers elkaars terrein nooit. Voelt minder "skyblock", maar werkt op elke versie.

### ❌ Wat niet werkt

- **VoidWNO, VoidWorldGenerator, EmptyWorldGenerator** op SpigotMC/BuiltByBit — dit zijn Java/Spigot plugins, **werken niet op Bedrock**.
- **RR One Block** op CurseForge — wel Bedrock, maar conflicteert met deze addon (andere gameplay mode).
- **MCPEDL "void" addons** — vaak verouderd of werken alleen voor singleplayer client, niet voor BDS.

> 🌐 **Locatie/regelgeving:** als je server publiek draait vanuit Nederland, let op AVG voor speler-data. Het pack slaat alleen player-IDs en posities op via dynamic properties — niets persoonlijks. Geen extra actie nodig.

---

## 🧪 Eerste keer testen

1. Join je eigen server.
2. Bij eerste join zie je in chat:
   ```
   [Skyblock] Welcome! Generating your private island...
   ```
3. Na ~3 seconden word je geteleporteerd naar je eiland (5×5 grass, boom, chest met items).
4. Type `/island` in chat → het menu opent (autocomplete suggereert het).
5. Type `/quests` → quest-overzicht.
6. Mine een paar cobblestone (gebruik je lava + ice voor een generator) → na 32 stuks zie je `Miner I: 32/64`.

Als dit allemaal werkt: de addon draait correct. 🎉

---

## 👥 Spelers-handleiding

Geef deze sectie aan je spelers (kopieer naar je Discord/wiki/etc).

### Hoe begin ik?

Bij je eerste join krijg je automatisch een eiland. Je vindt:
- Een **5×5 grass platform**
- Een **boom** (oak)
- Een **chest** met starter items: ice, lava bucket, saplings, seeds, bones

### Cobblestone generator maken

Dit is de basis van skyblock. Vanilla mechanic:

```
Plaatje van bovenaf:

[L] [_] [W]    L = lava bucket leeggegooid
                W = water (smelt eerst je ice met de zon of plaats hem in zonlicht)
                _ = hier verschijnt cobblestone
```

**Stappen:**
1. Plaats je **ice block** ergens in zonlicht zodat hij smelt naar water — of plaats hem direct als source block.
2. Graaf een rij van 4 blokken in je grass.
3. Plaats water aan één kant, lava aan de andere kant. Waar ze elkaar raken: cobblestone!
4. Mine de cobblestone, hij respawnt automatisch.

### Chat commands

| Command | Namespaced (fallback) | Wat het doet |
|---------|----------------------|--------------|
| `/island` | `/skyblock:island` | Open het hoofdmenu |
| `/home` | `/skyblock:home` | Teleporteer naar je hoofdeiland |
| `/quests` | `/skyblock:quests` | Bekijk je quest-progressie |
| `/reset` | `/skyblock:reset` | Reset quest-progressie (vraagt om bevestiging) |
| `/spawn` | `/skyblock:spawn` | Ga naar wereld-spawn |

> 💡 Bedrock toont je deze commands automatisch als je `/` typt — geen reden om alles uit je hoofd te leren.

### Het menu (`/island`)

Een grafisch menu met knoppen:
- **Teleport to my Island** — terug naar je eiland
- **View Quests** — quest-overzicht
- **Reset Island** — quest-progressie resetten
- **Help** — commands uitleg

### Tips

- Bewaar je **eerste boom** door saplings te planten voordat je hem helemaal omhakt
- Maak een **mob spawner** door een donkere kamer te bouwen op je eiland — mobs droppen iron, diamonds etc.
- Plant je **seeds** zo snel mogelijk voor voedsel
- Bewaar je **lava bucket** voor de cobblestone generator (je hebt er maar één!)

---

## 🌅 Daily bonus islands

Elke keer dat een Minecraft-nacht voorbij is (zonsopkomst — `world.getDay()` ophoogt) krijg je automatisch een nieuw eiland erbij. ~20 real-time minuten actieve speeltijd per eiland — tijd loopt alleen door als er iemand online is.

### Hoe werkt het?

- Bij zonsopkomst krijg je een chat-melding: `§b[Skyblock] §6Een nieuwe Minecraft-dag is aangebroken!`
- Het nieuwe eiland verschijnt op **bouwbare afstand** (32-64 blokken) van je vorige eiland, op een variërende hoogte (Y 60-140)
- Je archipel groeit organisch outward — je kunt letterlijk bridges bouwen tussen je eilanden
- Maximaal 480 blokken horizontaal van je hoofdeiland → blijft binnen je territorium, geen botsingen met buren

### De 7 themes

Elk bonus-eiland heeft een willekeurig thema, met eigen blokken en chest-loot:

| Theme | Kleur | Blokken | Loot highlights |
|---|---|---|---|
| Forest 🌲 | Groen | grass + dirt + oak | starter mix (ice, lava, saplings, seeds) |
| Tundra ❄️ | Aqua | snow + packed_ice + spruce | ice ×4, snowball ×8, leather, beetroot |
| Desert 🏜️ | Geel | sand + sandstone + cactus | sand ×8, dried_kelp, deadbush |
| Jungle 🌴 | Donkergroen | grass + jungle log/leaves | jungle_sapling, melon, cocoa, bamboo |
| Mushroom 🍄 | Paars | mycelium + huge mushroom | red/brown mushrooms, mushroom_stem |
| Cherry 🌸 | Roze | grass + cherry log/leaves | cherry_sapling, sweet_berries |
| Nether 🔥 | Rood | netherrack + soul_sand + crimson | nether_wart, glowstone, blaze_powder |

Distributie: Forest 25%, Tundra/Desert/Jungle elk 15%, Mushroom/Cherry/Nether elk 10%.

### Naar je bonus-eilanden teleporteren

Geen typen nodig — alles via menu:

1. Type `/island` (of klik in het hoofdmenu)
2. Kies **My Islands**
3. Zie de lijst met al je eilanden, gekleurd per thema, met hoogte en kompasrichting
4. Klik op een eiland om er heen te teleporteren

### Edge cases

- **Lange tijd offline?** Bij terugkomst krijg je **één** bonus, niet één per gemiste dag (anti-stacking).
- **Geen ruimte gevonden?** Als je archipel zo dicht is dat het algoritme geen plek vindt, krijg je een melding "Geen ruimte gevonden — probeer later". De volgende zonsopkomst probeert opnieuw met andere random waardes.

---

## 🪦 Void respawn

Val je in de void of overlijd je op een andere manier? Je respawnt automatisch op je **hoofdeiland**, niet op world spawn. Dit gebeurt via een persoonlijk `/spawnpoint` dat we zetten zodra je hoofdeiland is gegenereerd.

- Werkt voor alle death-causes (void, mob, fall, drowning, etc)
- **Beds en respawn anchors blijven werken** — sleep je in een bed, dan respawn je daar (vanilla mechanic)
- **Bestaande spelers** (van vóór 1.1.0) krijgen hun spawnpoint gezet bij hun eerstvolgende join

---

## 🎯 Quests & beloningen

| Quest | Doel | Beloning |
|-------|------|----------|
| **Miner I** | Mine 64 cobblestone | 4× Iron Ingot |
| **Miner II** | Mine 512 cobblestone | 2× Diamond |
| **Lumberjack** | Hak 32 oak logs | Iron Axe |
| **Monster Hunter** | Kill 10 zombies | 2× Golden Apple |
| **Farmer** | Oogst 32 wheat | 8× Bread |
| **Hardcore** | Mine 1 obsidian | Diamond Pickaxe |

Voortgang wordt automatisch bijgehouden zodra je het bijbehorende blok mined of mob killt. Beloningen komen direct in je inventory.

---

## 🎲 Mob drops (balans)

Op een skyblock kun je sommige resources niet natuurlijk krijgen. Daarom hebben deze mobs **bonus drops**:

| Mob | Drops |
|-----|-------|
| 🧟 Zombie | Iron 10%, Potato 15%, Carrot 15% |
| 💀 Skeleton | Flint 20% |
| 💥 Creeper | Redstone 25% (1-3) |
| 🕷️ Spider | String 30% |
| 👁️ Enderman | Diamond 5%, Obsidian 10% |
| 🧙 Witch | Emerald 30% (1-2) |
| 🔥 Blaze | Gold 20% |
| 💧 Drowned | Iron 10%, Copper 20% |
| 🏜️ Husk | Iron 10% |

> 💡 Bouw een mob farm om dit te exploiten — dat is bedoeld!

---

## ⚙️ Configuratie aanpassen

### Eiland-instellingen

In `scripts/island_manager.js` bovenaan:

```js
const ISLAND_SPACING = 1024;     // afstand tussen eilanden (blokken)
const ISLAND_Y = 80;             // hoogte van eilanden
const ISLAND_DIM = "overworld";  // dimensie
```

### Quests aanpassen

In `scripts/quests.js`, de `QUESTS` array. Voorbeeld nieuwe quest:

```js
{
    id: "stone_128",
    name: "§eStone Crusher",
    desc: "Mine 128 stone",
    type: "break",
    block: "minecraft:stone",
    target: 128,
    reward: { item: "iron_pickaxe", count: 1, msg: "§7Iron Pickaxe" }
}
```

### Mob drops aanpassen

In `scripts/balance.js`, de `BONUS_DROPS` object:

```js
"minecraft:phantom": [
    { item: "feather", chance: 0.50, min: 1, max: 3 }
]
```

### UUID's veranderen

Als je het pack wilt bundelen met andere addons, **moet je de UUID's in `manifest.json` veranderen** (anders conflict). Genereer nieuwe UUID's via [uuidgenerator.net](https://www.uuidgenerator.net/) en update:
- `header.uuid`
- Beide `modules[*].uuid`
- En vervolgens je `world_behavior_packs.json`

---

## 🔄 Updaten

Wanneer je het pack updatet:

1. Verhoog `version` in `manifest.json` (bv. `[1, 0, 1]`).
2. Update ook `version` in `world_behavior_packs.json`.
3. Vervang de bestanden op de server.
4. Restart de server.

> ⚠️ Dynamic properties (eiland-locaties, quest-progressie) blijven behouden zolang je dezelfde UUID gebruikt.

---

## 🐛 Troubleshooting

### "Script error: cannot find module @minecraft/server"
Je BDS is te oud. Update naar minimaal **1.21.0**. Check `min_engine_version` in `manifest.json`.

### Eiland blokken verschijnen niet
Ticking area limiet bereikt. Verhoog in `server.properties`:
```properties
max-threads=8
```
Of verwijder oude ticking areas: `/tickingarea remove_all` (admin command).

### Spelers krijgen geen eiland bij join
- Check console op script errors
- Cheats moeten aan staan
- Het pack moet in `world_behavior_packs.json` staan

### Slash commands werken niet
- Cheats aan?
- Pack actief in de wereld?
- Check console: errors uit `commands.js`?

### "Permission denied" voor `/replaceitem` of `/give`
Spelers hebben geen op-permissions nodig — de scripts draaien als systeem. Maar cheats **moeten** aan staan op world-niveau.

### Eiland is te dichtbij andere speler
`ISLAND_SPACING` verhogen en de ticking area chunks reset. Bestaande eilanden blijven op hun oude positie tenzij je de dynamic properties wist.

### Quest-progressie resetten voor één speler
Als admin in chat: edit `dynamic_properties` direct (geavanceerd). Eenvoudigste: speler doet zelf `/reset`.

### Volledig resetten (alle eilanden, alle data)
Stop server → verwijder de wereld → maak nieuwe wereld met dezelfde behavior pack. Dynamic properties zijn world-gebonden.

---

## 📁 Bestandsstructuur

```
skyblock_bp/
├── manifest.json              ← Pack metadata, dependencies, UUIDs
├── README.md                  ← Dit bestand
└── scripts/
    ├── main.js                ← Entry point, importeert alle modules
    ├── island_manager.js      ← Eiland-generatie (main + bonus), grid + chain, teleport, spawnpoint
    ├── themes.js              ← Theme registry (7 themes) + focal-point builders
    ├── daily_islands.js       ← Day-rollover loop (Minecraft-zonsopkomst → bonus eiland)
    ├── quests.js              ← Quest definities + tracking via events
    ├── balance.js             ← Bonus mob drops
    └── commands.js            ← Chat commands + UI menu (incl. My Islands)
```

---

## 🆘 Hulp nodig?

- Bedrock scripting docs: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/
- Bedrock Wiki: https://wiki.bedrock.dev/
- Script API versies: zie `manifest.json` dependencies — gebruikt stable `@minecraft/server` 2.1.0 (vereist voor de Custom Commands API) en `@minecraft/server-ui` 1.3.0

Veel plezier met je skyblock server! 🏝️
