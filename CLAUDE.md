# Skyblock Addon Project

Minecraft Bedrock 1.21.x behavior pack voor een dedicated server (BDS) draaiend in NL.

## Stack
- @minecraft/server 1.17.0 (stable)
- @minecraft/server-ui 1.3.0 (stable)
- Geen TypeScript, geen build-step — pure JS

## Conventies
- Alle persistent data via `world.getDynamicProperty` / `setDynamicProperty`
- Dynamic property keys: prefix `sb:` (bv. `sb:island:<playerId>`)
- Chat commands prefix: `!`
- Pack UUID's NIET wijzigen (bestaande worlds gebruiken ze)

## Server context
- Cheats moeten aan staan
- Vanilla "The Void" preset world (1.21.100+)
- Eilanden op Y=80, grid spacing 1024 blokken

## Niet meer toevoegen
- Beta APIs (alleen stable)
- TypeScript build (houden simpel)
