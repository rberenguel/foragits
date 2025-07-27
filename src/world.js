import { CHUNK_WIDTH, CHUNK_HEIGHT, SETTLEMENT_RADIUS } from "./constants.js";
import { Settlement } from "./features/settlement.js";
import { TILE_TYPE } from "./terrain.js";

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
      this.settlements.set(metaKey, null);
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

    const cellular = new ROT.Map.Cellular(CHUNK_WIDTH, CHUNK_HEIGHT, {
      connected: true,
    });
    cellular.randomize(0.45);
    for (let i = 0; i < 4; i++) cellular.create();

    cellular.create((x, y, value) => {
      this.chunks[key][`${x},${y}`] = value
        ? TILE_TYPE.WALL
        : ROT.RNG.getUniform() < 0.02
          ? TILE_TYPE.CACTUS
          : ROT.RNG.getUniform() < 0.0005
            ? TILE_TYPE.FIRE_PIT_INACTIVE
            : TILE_TYPE.FLOOR;
    });

    const settlement = this._getSettlementForChunk(chunkX, chunkY);
    if (settlement) {
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
      const SETTLEMENT_RADIUS = 25;
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

          if (
            Math.hypot(worldX - settlement.x, worldY - settlement.y) <
            SETTLEMENT_RADIUS
          ) {
            let tileType = TILE_TYPE.FLOOR;
            for (const b of settlement.buildings) {
              if (worldX === b.door.x && worldY === b.door.y) {
                tileType = TILE_TYPE.DOOR;
                break;
              }
              const isTopOrBottom =
                (worldY === b.y || worldY === b.y + b.height - 1) &&
                worldX >= b.x &&
                worldX < b.x + b.width;
              const isLeftOrRight =
                (worldX === b.x || worldX === b.x + b.width - 1) &&
                worldY >= b.y &&
                worldY < b.y + b.height;
              if (isTopOrBottom || isLeftOrRight) {
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
}
