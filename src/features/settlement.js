// src/features/settlement.js
import { TILE_TYPE } from "../terrain.js";

const adjectives = [
  "Dusty",
  "Stony",
  "Red",
  "Black",
  "Dry",
  "Dead",
  "Last",
  "New",
  "Broken",
  "Crooked",
  "Lost",
  "Whispering",
  "Winding",
];
const nounsNatural = [
  "Creek",
  "Gulch",
  "Mesa",
  "Ridge",
  "Springs",
  "Canyon",
  "Rock",
  "River",
  "Hollow",
  "Valley",
  "Pass",
  "Butte",
];
const nounsManmade = [
  "Crossing",
  "Fort",
  "Junction",
  "Post",
  "Station",
  "Ranch",
  "Claim",
  "Glory",
  "Hope",
  "End",
];
const surnames = [
  "Miller",
  "Jackson",
  "Cooper",
  "Harris",
  "Blackwood",
  "Shane",
];
const standalone = [
  "Redemption",
  "Salvation",
  "Eternity",
  "Purgatory",
  "Prospect",
];
const spanishPrefixes = ["Rio", "Agua", "Santa", "El", "Las"];
const spanishSuffixes = ["Bravo", "Dorado", "Cruz", "Fe", "Negro", "Piedra"];

const getRandomElement = (arr) =>
  arr[Math.floor(ROT.RNG.getUniform() * arr.length)];

const patterns = [
  () => `${getRandomElement(adjectives)} ${getRandomElement(nounsNatural)}`,
  () => `${getRandomElement(nounsNatural)} ${getRandomElement(nounsManmade)}`,
  () => `${getRandomElement(adjectives)} ${getRandomElement(nounsManmade)}`,
  () => `${getRandomElement(surnames)}'s ${getRandomElement(nounsManmade)}`,
  () => `${getRandomElement(surnames)}'s ${getRandomElement(nounsNatural)}`,
  () =>
    `${getRandomElement(spanishPrefixes)} ${getRandomElement(spanishSuffixes)}`,
  () => getRandomElement(standalone),
];

function generateSettlementName() {
  const randomPattern = getRandomElement(patterns);
  return randomPattern();
}

export class Settlement {
  constructor(centerX, centerY) {
    this.x = centerX;
    this.y = centerY;
    this.name = generateSettlementName();
    this.buildings = this._generateBuildings();
    this.placard = { x: 0, y: 0 }; // Will be placed by the World generator
    this.isPopulated = false;
    this.areDetailsGenerated = false;
  }

  generateDetails(world) {
    this._generateCratesAndBarrels(world);
    this._generateWaterTrough(world);
  }

  _generateFences(world) {
    const building = this.buildings[0];
    const fenceX = building.x - 5;
    const fenceY = building.y - 5;
    const fenceWidth = building.width + 10;
    const fenceHeight = building.height + 10;

    for (let i = 0; i < fenceWidth; i++) {
      world.setTile(fenceX + i, fenceY, TILE_TYPE.FENCE_H);
      world.setTile(fenceX + i, fenceY + fenceHeight - 1, TILE_TYPE.FENCE_H);
    }
    for (let i = 0; i < fenceHeight; i++) {
      world.setTile(fenceX, fenceY + i, TILE_TYPE.FENCE_V);
      world.setTile(fenceX + fenceWidth - 1, fenceY + i, TILE_TYPE.FENCE_V);
    }

    world.setTile(fenceX, fenceY, TILE_TYPE.FENCE_POST);
    world.setTile(fenceX + fenceWidth - 1, fenceY, TILE_TYPE.FENCE_POST);
    world.setTile(fenceX, fenceY + fenceHeight - 1, TILE_TYPE.FENCE_POST);
    world.setTile(
      fenceX + fenceWidth - 1,
      fenceY + fenceHeight - 1,
      TILE_TYPE.FENCE_POST,
    );
  }

  _generateCratesAndBarrels(world) {
    const totalItems = ROT.RNG.getUniformInt(5, 15);
    for (let i = 0; i < totalItems; i++) {
      const x = this.x + ROT.RNG.getUniformInt(-20, 20);
      const y = this.y + ROT.RNG.getUniformInt(-20, 20);

      if (world.getTileAt(x, y) === TILE_TYPE.FLOOR) {
        const type =
          ROT.RNG.getUniform() > 0.5 ? TILE_TYPE.CRATE : TILE_TYPE.BARREL;
        world.setTile(x, y, type);
      }
    }
  }

  _generateWaterTrough(world) {
    const troughCount = ROT.RNG.getUniformInt(1, 2);
    for (let i = 0; i < troughCount; i++) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 50) {
        const x = this.x + ROT.RNG.getUniformInt(-20, 20);
        const y = this.y + ROT.RNG.getUniformInt(-20, 20);
        if (world.getTileAt(x, y) === TILE_TYPE.FLOOR) {
          world.setTile(x, y, TILE_TYPE.WATER_TROUGH);
          placed = true;
        }
        attempts++;
      }
    }
  }

  _generateBuildings() {
    const buildings = [];
    const numBuildings = ROT.RNG.getUniformInt(4, 7); // Increased number of buildings
    console.log(`Settlement ${this.name}: Attempting to generate ${numBuildings} buildings.`);
    const shopIndex = ROT.RNG.getUniformInt(0, numBuildings - 1);

    const doesOverlap = (b1, b2) => {
      const buffer = 1; // Reduced minimum space between buildings
      return (
        b1.x < b2.x + b2.width + buffer &&
        b1.x + b1.width + buffer > b2.x &&
        b1.y < b2.y + b2.height + buffer &&
        b1.y + b1.height + buffer > b2.y
      );
    };

    for (let i = 0; i < numBuildings; i++) {
      let building;
      let overlaps;
      let attempts = 0;
      do {
        overlaps = false;
        building = {
          x: this.x + ROT.RNG.getUniformInt(-25, 25), // Increased placement range
          y: this.y + ROT.RNG.getUniformInt(-25, 25), // Increased placement range
          width: ROT.RNG.getUniformInt(4, 7),
          height: ROT.RNG.getUniformInt(4, 7),
          isShop: i === shopIndex,
          settlementName: this.name,
        };
        for (const existing of buildings) {
          if (doesOverlap(building, existing)) {
            overlaps = true;
            break;
          }
        }
        attempts++;
        if (attempts >= 500) {
          console.warn(`Settlement ${this.name}: Failed to place building ${i} after ${attempts} attempts due to persistent overlaps.`);
          break; // Exit loop if too many attempts
        }
      } while (overlaps);

      if (!overlaps) {
        building.door = this._createDoorForBuilding(building);
        buildings.push(building);
        console.log(`Settlement ${this.name}: Placed building ${i} at (${building.x},${building.y}) with size ${building.width}x${building.height}, isShop: ${building.isShop}. Total buildings: ${buildings.length}`);
      }
    }
    console.log(`Settlement ${this.name}: Final count of generated buildings: ${buildings.length}.`);
    return buildings;
  }

  _createDoorForBuilding(building) {
    const side = ROT.RNG.getUniformInt(0, 3); // 0: top, 1: right, 2: bottom, 3: left
    let doorX, doorY;

    if (side === 0 || side === 2) {
      // Top or Bottom wall
      doorX = building.x + ROT.RNG.getUniformInt(1, building.width - 2);
      doorY = side === 0 ? building.y : building.y + building.height - 1;
    } else {
      // Left or Right wall
      doorX = side === 3 ? building.x : building.x + building.width - 1;
      doorY = building.y + ROT.RNG.getUniformInt(1, building.height - 2);
    }
    return { x: doorX, y: doorY };
  }
}
