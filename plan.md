# Project Status & Next Steps

## What's Done

- **Modular Engine**: The game is refactored into a modular ES6 structure (`main`, `renderer`, `world`, actors, etc.). A turn-based game loop using `rot-js`'s scheduler is implemented.
- **Centralized Data**: Key game data is centralized in single-source-of-truth files (`terrain.js`, `items.js`) for easy modification.
- **Procedural World**: An infinite, chunk-based world is generated, featuring a meta-map system that places unique, named settlements with buildings, doors, and descriptive placards.
- **Advanced AI**: Bandits have a limited Field of View, pursue the player's last known position, and pathfind to their assigned "base settlement" when idle. They are assigned random names.
- **Field of View**: The player has a Field of View system with occlusion and memory for explored areas.
- **Item & Inventory System**:
  - A text-based inventory screen (toggled with 'i') is functional.
  - An item factory creates objects with specific properties (e.g., weapon stats).
  - Bandits have inventories, which are dropped upon death and can be picked up ('g') by the player.
- **Combat Mechanics**:
  - A health and damage system is in place.
  - A complete ammunition system is implemented, tracking loaded rounds vs. reserve ammo. A reload ('r') action is available.
  - Enemies can be killed, leaving corpses and scattering their loot on adjacent tiles.
- **UI & Flavor**: A message log provides contextual information for discovering settlements, reading corpse epitaphs ("Here lies..."), and seeing items on the ground.

## Potential Next Steps

Fix bug: sometimes the game hangs on start, as if a very hot loop started. The loop will still be hot for the first few turns (with visible Chrome logging violations of keydown handlers taking close to 5 seconds). Likely some of the act loops or tile generation loops are taking forever. After killing 1/2 bandits it fixes. Also, bandits can still be mushed together, making reading their tombstones impossible.

This is a list of features we could work on, based on the project goals.

- **World Generation & Interactivity**

  - Implement different biomes (badlands, sparse forests) to break up the desert.
  - Add Points of Interest (POIs) like ponds, bandit camps, or abandoned cabins.
  - Add interactive fire pits (active/inactive) with consumable items like bean cans that can restore health.
  - Add passable rocks that actors can use for cover.

- **Gameplay & AI**

  - Add small settlements with non-hostile, communicative NPCs.
  - Introduce a simple "Wanted" system to differentiate between an Outlaw and a Bounty Hunter role based on player actions.
  - Implement logic for a friendly NPC companion that can follow the player and assist in combat.

- **Combat & Balance**

  - Implement a precision stat for players and bandits, so even a clear shot can miss, especially at range.
  - Add a hand-to-hand combat system (fists or knives) for situations without ammo.
  - Rebalance player health.
  - Create an item quality system (e.g., rusty, standard, quality) affecting stats.

- **Visuals & UI**

  - Implement a circular Field of View instead of the current square one.
  - Use a new or different glyph for bandits to make them more distinct.

- **Controls & Platforms**

  - Add mobile-friendly controls for landscape play on phones.

- **Major Features**
  - Design and generate key buildings for heists (Banks, Trains).
  - Create AI for guards or lawmen to defend these locations.
