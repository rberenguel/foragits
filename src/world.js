import { CHUNK_WIDTH, CHUNK_HEIGHT } from "./constants.js";
import { Settlement } from "./features/settlement.js";
import { TILE_TYPE } from "./terrain.js";

const META_CHUNK_SIZE = 10; // A settlement can appear in a 10x10 chunk area
const SETTLEMENT_CHANCE = 0.4; // 40% chance of a settlement in a meta-chunk

export class World {
  constructor() {
    this.chunks = {};
    this.effects = {};
    this.settlements = new Map();
    this.placardMap = new Map();
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

    const buildings = [];
    const numBuildings = ROT.RNG.getUniformInt(2, 3);
    for (let i = 0; i < numBuildings; i++) {
      buildings.push({
        x: centerX + ROT.RNG.getUniformInt(-15, 15),
        y: centerY + ROT.RNG.getUniformInt(-15, 15),
        width: ROT.RNG.getUniformInt(5, 9),
        height: ROT.RNG.getUniformInt(5, 9),
      });
    }

    // --- ADDED THIS LINE FOR DEBUGGING ---
    console.log(
      `Settlement generated at world coordinates near: x=${centerX}, y=${centerY}`,
    );

    const settlement = new Settlement(centerX, centerY, this);
    this.placardMap.set(
      `${settlement.placard.x},${settlement.placard.y}`,
      settlement,
    );
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
          : TILE_TYPE.FLOOR;
    });

    const settlement = this._getSettlementForChunk(chunkX, chunkY);
    if (settlement) {
      const SETTLEMENT_RADIUS = 25;
      const localTilesToOverwrite = {};

      // 2. Clear ground, define walls and doors
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_WIDTH; x++) {
          const worldX = chunkX * CHUNK_WIDTH + x;
          const worldY = chunkY * CHUNK_HEIGHT + y;

          if (
            Math.hypot(worldX - settlement.x, worldY - settlement.y) <
            SETTLEMENT_RADIUS
          ) {
            let tileType = "."; // Default to cleared ground
            for (const b of settlement.buildings) {
              if (worldX === b.door.x && worldY === b.door.y) {
                tileType = "+";
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
                tileType = "=";
                break;
              }
            }
            if (tileType !== this.chunks[key][`${x},${y}`]) {
              localTilesToOverwrite[`${x},${y}`] = tileType;
            }
          }
        }
      }

      // 3. Place placard in a guaranteed open spot
      if (!this.placardMap.has(`${settlement.x},${settlement.y}`)) {
        // Quick check to only do this once
        let placardPlaced = false;
        for (let i = 0; i < 30; i++) {
          // Try 30 times
          const placX = settlement.x + ROT.RNG.getUniformInt(-12, 12);
          const placY = settlement.y + ROT.RNG.getUniformInt(-12, 12);
          if (this.getTileAt(placX, placY) === ".") {
            const placChunkX = Math.floor(placX / CHUNK_WIDTH);
            if (placChunkX === chunkX) {
              // Only write if it's in *this* chunk
              const localX =
                ((placX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
              const localY =
                ((placY % CHUNK_HEIGHT) + CHUNK_HEIGHT) % CHUNK_HEIGHT;
              localTilesToOverwrite[`${localX},${localY}`] = "팻";
            }
            settlement.placard = { x: placX, y: placY };
            this.placardMap.set(`${placX},${placY}`, settlement);
            this.placardMap.set(`${settlement.x},${settlement.y}`, true); // Mark as placed
            placardPlaced = true;
            break;
          }
        }
      }

      // 4. Apply all changes to the chunk
      Object.assign(this.chunks[key], localTilesToOverwrite);
    }
  }
}
