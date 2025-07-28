// src/features/settlement.js
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
  }

  _generateBuildings() {
    const buildings = [];
    const numBuildings = ROT.RNG.getUniformInt(2, 3);
    const shopIndex = ROT.RNG.getUniformInt(0, numBuildings - 1);

    for (let i = 0; i < numBuildings; i++) {
      const building = {
        x: this.x + ROT.RNG.getUniformInt(-15, 15),
        y: this.y + ROT.RNG.getUniformInt(-15, 15),
        width: ROT.RNG.getUniformInt(5, 9),
        height: ROT.RNG.getUniformInt(5, 9),
        isShop: i === shopIndex, // Designate one building as the shop
        settlementName: this.name,
      };
      building.door = this._createDoorForBuilding(building);
      buildings.push(building);
    }
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
