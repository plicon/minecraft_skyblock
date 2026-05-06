# Extra Packs

Drop unzipped Bedrock addon folders here and they'll be auto-deployed
alongside `skyblock_bp/` when you run `./deploy.sh`.

## How it works

`deploy.sh` scans this directory for any subfolder containing a
`manifest.json`, reads the manifest to determine whether it's a behavior
pack or resource pack (via `modules[*].type`), then:

- copies it to `<BDS>/behavior_packs/` or `<BDS>/resource_packs/`
- adds an entry to `world_behavior_packs.json` or `world_resource_packs.json`

Idempotent — re-running just bumps the version on existing entries.

## How to install an addon (e.g., Lucky Blocks)

1. Download the `.mcaddon` file from MCPEDL or wherever
2. Rename it to `.zip` and unzip
3. Inside, you typically get `something_bp/` and `something_rp/` folders
4. Move both into this `packs/` directory:

   ```
   packs/
     lucky_block_bp/
       manifest.json
       blocks/
       scripts/
     lucky_block_rp/
       manifest.json
       textures/
       models/
   ```

5. Run `./deploy.sh /path/to/bds Skyblock` — the new packs are picked up automatically

## Recommended addons for this Skyblock setup

- **Lucky Blocks**: <https://mcpedl.com/lucky-block-addon/>
- **More TNT (Too Much TNT)**: <https://mcpedl.com/too-much-tnt-mod/>
- **Trolling TNT** (kid-friendly, no damage): <https://mcpedl.com/trolling-tnt-addon/>

## Privacy note

This directory is `.gitignore`-d — third-party addons stay on your machine
and aren't committed to the repo (most are not redistributable anyway).
