# Skyblock Addon Project

Minecraft Bedrock 1.21.x behavior pack voor een dedicated server (BDS) draaiend in NL.

## Stack
- @minecraft/server 2.1.0 (stable) — bevat Custom Commands API (`customCommandRegistry`)
- @minecraft/server-ui 1.3.0 (stable)
- Geen TypeScript, geen build-step — pure JS

## BDS versie
- `@minecraft/server` 2.1.0 vereist een recente Bedrock Dedicated Server (≥ Bedrock 1.21.50).
- Bij upgrade-issues: check `bedrock_server --version`.

## Conventies
- Alle persistent data via `world.getDynamicProperty` / `setDynamicProperty`
- Dynamic property keys: prefix `sb:` (bv. `sb:island:<playerId>`)
- Player commands: stable Custom Commands API (`/island`, `/home`, etc — namespace `skyblock:`). NIET `world.beforeEvents.chatSend` (zit in beta).
- Pack UUID's NIET wijzigen (bestaande worlds gebruiken ze)

## Server context
- Cheats moeten aan staan
- Vanilla "The Void" preset world (1.21.100+)
- Eilanden op Y=80, grid spacing 1024 blokken

## Niet meer toevoegen
- Beta APIs (alleen stable)
- TypeScript build (houden simpel)
