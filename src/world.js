import { CHUNK_WIDTH, CHUNK_HEIGHT, SETTLEMENT_RADIUS } from "./constants.js";
import { Settlement } from "./features/settlement.js";
import { terrainInfo, TILE_TYPE } from "./terrain.js";
import { NPC } from "./actors/npc.js";
import { Shopkeeper } from "./actors/shopkeeper.js";
import { Sheriff } from "./actors/sheriff.js";

const META_CHUNK_SIZE = 10; // A settlement can appear in a 10x10 chunk area
const SETTLEMENT_CHANCE = 0.4; // 40% chance of a settlement in a meta-chunk

export class World {
  constructor(game) {
    this.game = game;
    this.chunks = {};
    this.effects = {};
    this.settlements = new Map();
    this.placardMap = new Map();
    this.itemsOnGround = new Map();
    this.terrainHealth = new Map();
  }
  isSettlementTile(x, y) {
    const metaX = Math.floor(x / (CHUNK_WIDTH * META_CHUNK_SIZE));
    const metaY = Math.floor(y / (CHUNK_HEIGHT * META_CHUNK_SIZE));
    const settlement = this.settlements.get(`${metaX},${metaY}`);
    if (
      settlement &&
      Math.hypot(x - settlement.x, y - settlement.y) < SETTLEMENT_RADIUS
    ) {
      return true;
    }
    return false;
  }
  findNearestSettlement(x, y) {
    const allSettlements = Array.from(this.settlements.values()).filter(
      (s) => s !== null,
    );
    if (allSettlements.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;
    for (const settlement of allSettlements) {
      const distance = Math.hypot(x - settlement.x, y - settlement.y);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = settlement;
      }
    }
    return nearest;
  }

  findNearbySettlements(x, y, count = 3) {
    const allSettlements = Array.from(this.settlements.values()).filter(
      (s) => s !== null,
    );
    if (allSettlements.length === 0) return [];

    // Calculate distance for each settlement
    const settlementsWithDistance = allSettlements.map((s) => ({
      ...s,
      distance: Math.hypot(x - s.x, y - s.y),
    }));

    // Sort by distance and take the top 'count'
    settlementsWithDistance.sort((a, b) => a.distance - b.distance);
    return settlementsWithDistance.slice(0, count);
  }

  _getSettlementForChunk(chunkX, chunkY) {
    const metaX = Math.floor(chunkX / META_CHUNK_SIZE);
    const metaY = Math.floor(chunkY / META_CHUNK_SIZE);
    const metaKey = `${metaX},${metaY}`;

    if (this.settlements.has(metaKey)) {
      return this.settlements.get(metaKey);
    }

    if (metaX === 0 && metaY === 0) {
      this.settlements.set(metaKey, null);
      return null;
    }

    const rngSeed = metaX * 1009 + metaY * 4003;
    ROT.RNG.setSeed(rngSeed);

    if (ROT.RNG.getUniform() > SETTLEMENT_CHANCE) {
      //this.settlements.set(metaKey, null); // DO NOT CACHE FAILURES
      return null;
    }

    const worldX = metaX * META_CHUNK_SIZE * CHUNK_WIDTH;
    const worldY = metaY * META_CHUNK_SIZE * CHUNK_HEIGHT;
    const size = META_CHUNK_SIZE * CHUNK_WIDTH;

    const centerX = worldX + Math.floor(ROT.RNG.getUniform() * size);
    const centerY = worldY + Math.floor(ROT.RNG.getUniform() * size);

    const settlement = new Settlement(centerX, centerY);
    this.settlements.set(metaKey, settlement);
    return settlement;
  }

  getTileAt(worldX, worldY) {
    const chunkX = Math.floor(worldX / CHUNK_WIDTH);
    const chunkY = Math.floor(worldY / CHUNK_HEIGHT);
    const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const localY = ((worldY % CHUNK_HEIGHT) + CHUNK_HEIGHT) % CHUNK_HEIGHT;
    const chunkKey = `${chunkX},${chunkY}`;

    if (!this.chunks[chunkKey]) {
      this._generateChunk(chunkX, chunkY);
    }
    return this.chunks[chunkKey][`${localX},${localY}`];
  }

  _generateChunk(chunkX, chunkY) {
    const key = `${chunkX},${chunkY}`;
    this.chunks[key] = {};
    const seed = chunkX * 10007 + chunkY * 30011;
    ROT.RNG.setSeed(seed);

    const settlement = this._getSettlementForChunk(chunkX, chunkY); // Moved this line up

    const cellular = new ROT.Map.Cellular(CHUNK_WIDTH, CHUNK_HEIGHT, {
      connected: true,
    });
    cellular.randomize(0.45);
    for (let i = 0; i < 4; i++) cellular.create();

    cellular.create((x, y, value) => {
      const worldX = chunkX * CHUNK_WIDTH + x;
      const worldY = chunkY * CHUNK_HEIGHT + y;

      let tile = TILE_TYPE.FLOOR;
      let isSettlementTile = false;

      // Check if this tile is part of a settlement building
      if (settlement) {
        for (const b of settlement.buildings) {
          // Check if inside the building's outer rectangle
          const isInsideOuterRect =
            worldX >= b.x &&
            worldX < b.x + b.width &&
            worldY >= b.y &&
            worldY < b.y + b.height;

          // Check if it's a door
          if (worldX === b.door.x && worldY === b.door.y) {
            isSettlementTile = true;
            tile = TILE_TYPE.DOOR; // Temporarily set to door, will be overwritten later
            break;
          }
          // Check if it's a wall (outer rect but not inner rect)
          const isInsideInnerRect =
            worldX > b.x &&
            worldX < b.x + b.width - 1 &&
            worldY > b.y &&
            worldY < b.y + b.height - 1;

          if (isInsideOuterRect && !isInsideInnerRect) {
            isSettlementTile = true;
            tile = TILE_TYPE.SETTLEMENT_WALL; // Temporarily set to wall
            break;
          }
          // Check if it's inside the building (floor)
          if (isInsideOuterRect && isInsideInnerRect) {
            isSettlementTile = true;
            tile = TILE_TYPE.FLOOR;
            break;
          }
        }
      }

      if (isSettlementTile) {
        this.chunks[key][`${x},${y}`] = tile;
      } else {
        // Original terrain generation logic for non-settlement areas
        const tileRoll = ROT.RNG.getUniform();
        if (value) {
          tile = TILE_TYPE.WALL;
        } else if (tileRoll < 0.02) {
          const cactusType = ROT.RNG.getUniformInt(1, 3);
          if (cactusType === 1) tile = TILE_TYPE.CACTUS;
          else if (cactusType === 2) tile = TILE_TYPE.CACTUS_2;
          else tile = TILE_TYPE.CACTUS_3;
        } else if (tileRoll < 0.025) {
          tile = TILE_TYPE.ROCK;
        } else if (tileRoll < 0.0255) {
          tile = TILE_TYPE.FIRE_PIT_INACTIVE;
        } else if (tileRoll < 0.04) {
          const shrubType = ROT.RNG.getUniformInt(1, 3);
          if (shrubType === 1) tile = TILE_TYPE.SHRUB;
          else if (shrubType === 2) tile = TILE_TYPE.SHRUB_2;
          else tile = TILE_TYPE.SHRUB_3;
        }
        this.chunks[key][`${x},${y}`] = tile;
      }
    });

    // const settlement = this._getSettlementForChunk(chunkX, chunkY); // This line is now commented out
    if (settlement) {
      if (!settlement.isPopulated) {
        this._populateSettlement(settlement);
      }
      if (!settlement.areDetailsGenerated) {
        settlement.generateDetails(this);
        settlement.areDetailsGenerated = true;
      }
      // --- REVISED PLACARD AND SETTLEMENT LOGIC ---

      // 1. Determine placard location ONCE for the whole settlement
      if (settlement.placard.x === 0 && settlement.placard.y === 0) {
        const possiblePlacardLocations = [];
        const radius = 20;
        for (let y = settlement.y - radius; y <= settlement.y + radius; y++) {
          for (let x = settlement.x - radius; x <= settlement.x + radius; x++) {
            if (Math.hypot(x - settlement.x, y - settlement.y) > radius)
              continue;

            let isWallOrDoor = false;
            for (const b of settlement.buildings) {
              if (x === b.door.x && y === b.door.y) {
                isWallOrDoor = true;
                break;
              }
              const isTopOrBottom =
                (y === b.y || y === b.y + b.height - 1) &&
                x >= b.x &&
                x < b.x + b.width;
              const isLeftOrRight =
                (x === b.x || x === b.x + b.width - 1) &&
                y >= b.y &&
                y < b.y + b.height;
              if (isTopOrBottom || isLeftOrRight) {
                isWallOrDoor = true;
                break;
              }
            }
            if (!isWallOrDoor) {
              possiblePlacardLocations.push({ x, y });
            }
          }
        }
        if (possiblePlacardLocations.length > 0) {
          const loc =
            possiblePlacardLocations[
              ROT.RNG.getUniformInt(0, possiblePlacardLocations.length - 1)
            ];
          settlement.placard = { x: loc.x, y: loc.y };
          this.placardMap.set(`${loc.x},${loc.y}`, settlement);
        }
      }

      // 2. Draw this chunk based on the complete settlement layout
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_WIDTH; x++) {
          const worldX = chunkX * CHUNK_WIDTH + x;
          const worldY = chunkY * CHUNK_HEIGHT + y;

          // Check if an actor is here before overwriting the tile
          if (this.game.isTileOccupied(worldX, worldY)) continue;

          if (
            worldX === settlement.placard.x &&
            worldY === settlement.placard.y
          ) {
            this.chunks[key][`${x},${y}`] = TILE_TYPE.PLACARD;
            continue;
          }

          const distance =
            Math.abs(worldX - settlement.x) + Math.abs(worldY - settlement.y);
          if (distance <= SETTLEMENT_RADIUS) {
            let tileType = TILE_TYPE.FLOOR;
            for (const b of settlement.buildings) {
              if (worldX === b.door.x && worldY === b.door.y) {
                tileType = TILE_TYPE.DOOR;
                break;
              }
              // This logic correctly draws a full, closed rectangle without gaps.
              const isInsideOuterRect =
                worldX >= b.x &&
                worldX < b.x + b.width &&
                worldY >= b.y &&
                worldY < b.y + b.height;

              // This defines the "hollow" area inside the walls
              const isInsideInnerRect =
                worldX > b.x &&
                worldX < b.x + b.width - 1 &&
                worldY > b.y &&
                worldY < b.y + b.height - 1;

              // A tile is a wall if it's in the outer box but not the inner box.
              if (isInsideOuterRect && !isInsideInnerRect) {
                tileType = TILE_TYPE.SETTLEMENT_WALL;
                break;
              }
            }
            this.chunks[key][`${x},${y}`] = tileType;
          }
        }
      }
    }
  }
    _populateSettlement(settlement) {
    console.log(`Populating settlement: ${settlement.name} with ${settlement.buildings.length} buildings.`);
    // First, find the shop and create the shopkeeper
    const shopBuilding = settlement.buildings.find((b) => b.isShop);
    if (shopBuilding) {
      console.log(`Shop building found for ${settlement.name}.`);
      let x,
        y,
        attempts = 0;
      do {
        x =
          shopBuilding.x +
          1 +
          Math.floor(Math.random() * (shopBuilding.width - 2));
        y =
          shopBuilding.y +
          1 +
          Math.floor(Math.random() * (shopBuilding.height - 2));
        attempts++;
      } while (this.game.isTileOccupied(x, y) && attempts < 200);

      if (attempts < 200) {
        const shopkeeper = new Shopkeeper(this.game, x, y, settlement);
        this.game.npcs.push(shopkeeper); // Add to npcs list for now
        this.game.scheduler.add(shopkeeper, true);
        console.log(`Shopkeeper placed at ${x},${y} in ${settlement.name} after ${attempts} attempts.`);
      } else {
        console.warn(`Failed to place shopkeeper in ${settlement.name} after ${attempts} attempts. Last attempted: ${x},${y}. Tile occupied: ${this.game.isTileOccupied(x, y)}`);
      }
    } else {
      console.warn(`No shop building found for settlement: ${settlement.name}.`);
    }

    // Add Sheriff if settlement has more than 3 buildings
    if (settlement.buildings.length >= 5) {
      let sheriffPlaced = false;
      for (const building of settlement.buildings) {
        if (!building.isShop) { // Try to place sheriff in a non-shop building
          let x, y, attempts = 0;
          do {
            x = building.x + 1 + Math.floor(Math.random() * (building.width - 2));
            y = building.y + 1 + Math.floor(Math.random() * (building.height - 2));
            attempts++;
          } while (this.game.isTileOccupied(x, y) && attempts < 200);

          if (attempts < 200) {
            const sheriff = new Sheriff(this.game, x, y, settlement);
            this.game.npcs.push(sheriff);
            this.game.scheduler.add(sheriff, true);
            console.log(`Sheriff placed at ${x},${y} in ${settlement.name} after ${attempts} attempts.`);
            sheriffPlaced = true;
            break; // Sheriff placed, exit loop
          } else {
            console.warn(`Failed to place Sheriff in building at ${building.x},${building.y} after ${attempts} attempts.`);
          }
        }
      }
      if (!sheriffPlaced) {
        console.warn(`Could not find a suitable building to place Sheriff in ${settlement.name}.`);
      }
    }

    // Then, populate other buildings with regular NPCs
    const otherBuildings = settlement.buildings.filter((b) => !b.isShop);
    const npcPerSettlement = 1; // 1 regular NPC + 1 shopkeeper
    for (let i = 0; i < npcPerSettlement; i++) {
      if (otherBuildings.length === 0) break;
      const building = otherBuildings[i % otherBuildings.length];

      let x,
        y,
        attempts = 0;
      do {
        x = building.x + 1 + Math.floor(Math.random() * (building.width - 2));
        y = building.y + 1 + Math.floor(Math.random() * (building.height - 2));
        attempts++;
        if (attempts >= 50) {
          console.warn(`Failed to place NPC in ${settlement.name} after ${attempts} attempts. Last attempted: ${x},${y}. Tile occupied: ${this.game.isTileOccupied(x, y)}`);
          break; // Exit loop if too many attempts
        }
      } while (this.game.isTileOccupied(x, y));

      if (attempts < 50) {
        const npc = new NPC(this.game, x, y, settlement);
        this.game.npcs.push(npc);
        this.game.scheduler.add(npc, true);
        console.log(`NPC placed at ${x},${y} in ${settlement.name} after ${attempts} attempts.`);
      }
    }
    settlement.isPopulated = true;
  }

  getBuildingAt(x, y) {
    const settlement = this.findNearestSettlement(x, y);
    if (
      !settlement ||
      Math.hypot(x - settlement.x, y - settlement.y) > SETTLEMENT_RADIUS
    ) {
      return null;
    }

    for (const building of settlement.buildings) {
      if (
        x >= building.x &&
        x < building.x + building.width &&
        y >= building.y &&
        y < building.y + building.height
      ) {
        return building;
      }
    }
    return null;
  }

  isPassable(x, y) {
    const tile = this.getTileAt(x, y);
    return terrainInfo[tile].isPassable;
  }

  setTile(worldX, worldY, tile) {
    const chunkX = Math.floor(worldX / CHUNK_WIDTH);
    const chunkY = Math.floor(worldY / CHUNK_HEIGHT);
    const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const localY = ((worldY % CHUNK_HEIGHT) + CHUNK_HEIGHT) % CHUNK_HEIGHT;
    const chunkKey = `${chunkX},${chunkY}`;

    if (!this.chunks[chunkKey]) {
      this._generateChunk(chunkX, chunkY);
    }
    this.chunks[chunkKey][`${localX},${localY}`] = tile;
  }

  damageTerrain(x, y, amount) {
    const key = `${x},${y}`;
    const tile = this.getTileAt(x, y);
    const info = terrainInfo[tile];

    if (!info || !info.health) {
      return; // Not destructible
    }

    let currentHealth = this.terrainHealth.get(key);
    if (currentHealth === undefined) {
      currentHealth = info.health;
    }

    currentHealth -= amount;
    this.terrainHealth.set(key, currentHealth);

    if (currentHealth <= 0) {
      this.setTile(x, y, TILE_TYPE.FLOOR);
      this.terrainHealth.delete(key);
    }
  }
}
