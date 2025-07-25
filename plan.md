# Project Status & Next Steps

## What's Done

- **Core Engine**: A turn-based game loop using `rot-js`'s scheduler is implemented.
- **World**: An infinite, chunk-based world is generated procedurally.
- **Player Actions**: The player can move, aim a weapon in 15-degree increments, and fire. An ammo system is in place.
- **Enemies**: A single enemy type exists with basic A\* pathfinding to pursue the player.
- **Combat**: A health and damage system is functional. Enemies can be killed and leave corpses.
- **Visuals**: A secondary canvas layer handles particle effects (ricochets) and persistent pixel-based splatters (blood, cactus).
- **Gameplay Loop**: A simple loop of combat and looting corpses for ammo exists.

## Potential Next Steps

This is a list of features we could work on, based on the project goals.

- **World Generation**
  - Implement different biomes (badlands, sparse forests) to break up the desert.
  - Add Points of Interest (POIs) like ponds, bandit camps, or abandoned cabins.
- **Gameplay & Roles**
  - Add small settlements with neutral NPCs.
  - Introduce a simple "Wanted" system to differentiate between an Outlaw and a Bounty Hunter role based on player actions.
- **Major Features**
  - Design and generate key buildings for heists (Banks, Trains).
  - Create AI for guards or lawmen to defend these locations.
- **Companions**
  - Implement logic for a friendly NPC that can follow the player and assist in combat.
