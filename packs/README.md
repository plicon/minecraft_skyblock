# Extra Packs

Drop unzipped Bedrock addon folders here and `./deploy.sh` syncs them to
the BDS automatically. The script auto-detects whether each pack is a
behavior or resource pack via its `manifest.json`, and registers it in
the right `world_*_packs.json`.

## ⭐ Aanbevolen packs voor onze Skyblock

| Pack | Link | Waarom |
|---|---|---|
| **Lucky Blocks** door Effect99 | [CurseForge](https://www.curseforge.com/minecraft-bedrock/addons/lucky-blocks-effect99-addon) | Goed onderhouden, 1.21.20–1.21.90+, 157k+ downloads, kindvriendelijk |
| **TNT Addon** door Diamondhead24 | [CurseForge](https://www.curseforge.com/minecraft-bedrock/addons/tnt-addon) | 5 TNTs + 2 bonus, sferische explosies, super tof voor kids |

Optioneel:
- **Trolling TNT** voor 100% schadeloze prank-TNTs (water/slijm/kippen)
- **Realistic Lucky Block Addon** als alternatief voor Effect99

## 🚀 Workflow (3 commando's)

```bash
# 1. Download de .mcaddon files via de bovenstaande CurseForge-links.
#    Klik 'Download' → bestand belandt in ~/Downloads.

# 2. Pak ze uit naar packs/ met onze helper:
./tools/install-mcaddon.sh ~/Downloads/lucky-blocks-effect99-*.mcaddon
./tools/install-mcaddon.sh ~/Downloads/tnt-addon-*.mcaddon

# 3. Vraag de helper welke item-IDs hij detecteert:
./tools/detect-ids.sh
# → print de exacte regels voor skyblock_bp/scripts/integrations.js

# 4. Plak die regels in skyblock_bp/scripts/integrations.js
#    en deploy:
./deploy.sh /pad/naar/bedrock_server JouwWereld
```

Klaar. Vanaf de eerstvolgende zonsopkomst zit er kans op Lucky Blocks en
fancy TNT in elke nieuwe bonus-eiland chest.

## 🛠 Hoe het werkt

`./deploy.sh` scant `packs/*` voor mappen met een `manifest.json`, leest
`modules[*].type` om te bepalen of het een **behavior** of **resource**
pack is, en routeert het naar `<BDS>/behavior_packs/` of
`<BDS>/resource_packs/`. Vervolgens wordt de pack-UUID + versie
**idempotent** toegevoegd aan respectievelijk `world_behavior_packs.json`
of `world_resource_packs.json`.

Re-deployen is veilig: bestaande entries worden ge-update, geen
duplicates.

## Privacy

`packs/*` staat in `.gitignore` — third-party addons blijven lokaal en
worden niet meegecommit. Alleen deze README is in git.
