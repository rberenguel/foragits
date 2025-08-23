// src/actors/npc.js
import { terrainInfo } from "../terrain.js";
import { createItem } from "../items.js";

const firstNames = [
  "Bess",
  "Cora",
  "Elias",
  "Silas",
  "Martha",
  "Abner",
  "Walter",
  "Hattie",
];
const lastNames = [
  "Miller",
  "Wright",
  "Cooper",
  "Taylor",
  "Shaw",
  "Brown",
  "Jones",
];

// Dialogue sets for NPCs
const dialogueSets = [
  [
    "Howdy, stranger.",
    "Dusty day, ain't it?",
    "The desert is a harsh mistress.",
  ],
  [
    "Watch out for bandits on the trail.",
    "Heard they're building a new settlement over yonder.",
    "Some folks are best left alone.",
  ],
  [
    "You look like you've seen some things.",
    "Keep your wits about you out here.",
    "A man's gotta make his own luck.",
  ],
  [
    "Seen a man with a black hat pass through yesterday.",
    "The saloon's been quiet lately.",
    "Don't wander too far at night.",
  ],
  [
    "The sun's got a bite to it today.",
    "Another dusty day. What else is new?",
    "Wind's pickin' up. Could be a storm comin'.",
  ],
  [
    "Saw a coyote slinkin' around the edge of town last night.",
    "Don't get too close to the cacti. They're pricklier than old man Hemlock.",
    "Vultures are always watchin'. Always.",
  ],
  [
    "Heard some folks struck silver a few days west of here.",
    "That gang of bandits... they're gettin' bolder.",
    "Someone said they saw strange lights in the sky last week. Probably just heat shimmer.",
  ],
  [
    "A full canteen is worth more than a pocketful of gold out here.",
    "Travel light, and keep your eyes open.",
    "Some days you eat the bear, and some days, well, the bear eats you.",
  ],
  [
    "Howdy, partner. Keepin' out of trouble?",
    "Don't see many new faces around here.",
    "Mind your own business, and you'll live longer.",
  ],
];

function generateNpcName() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

export class NPC {
  constructor(game, x, y, homeSettlement) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.hp = 3;
    this.char = "P";
    this.color = "#3498db";
    this.name = generateNpcName();
    this.homeSettlement = homeSettlement;
    this.fleeing = false;
    this.fleeTarget = null;
    this.inventory = [
      createItem("money", {
        quantity: Math.floor(Math.random() * 10) + 5, // 5 to 14 dollars
      }),
    ];
    // Assign a random dialogue set
    this.dialogues =
      dialogueSets[Math.floor(Math.random() * dialogueSets.length)];
    this.dialogueIndex = 0;
  }

  isUnarmed() {
    return !this.inventory.some(item => item.kind === 'revolver' || item.kind === 'shotgun');
  }

  fleeFromGunshot(shotX, shotY) {
    this.fleeing = true;
    const currentBuilding = this.game.world.getBuildingAt(this.x, this.y);
    
    if (currentBuilding) {
      // Flee to the door if inside
      this.fleeTarget = { x: currentBuilding.door.x, y: currentBuilding.door.y };
      console.log(`${this.name} is inside, fleeing to door at (${this.fleeTarget.x}, ${this.fleeTarget.y})`);
    } else {
      // Flee to the nearest building if outside
      const settlement = this.game.world.findNearestSettlement(this.x, this.y);
      if (settlement && settlement.buildings.length > 0) {
        let nearestDoor = null;
        let minDistance = Infinity;
        for (const building of settlement.buildings) {
          const distance = Math.hypot(this.x - building.door.x, this.y - building.door.y);
          if (distance < minDistance) {
            minDistance = distance;
            nearestDoor = building.door;
          }
        }
        this.fleeTarget = nearestDoor;
        console.log(`${this.name} is outside, fleeing to nearest door at (${this.fleeTarget.x}, ${this.fleeTarget.y})`);
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.game.killEnemy(this); // Re-use the kill logic for bandits
    }
  }

  getNextDialogue() {
    const dialogue = this.dialogues[this.dialogueIndex];
    this.dialogueIndex = (this.dialogueIndex + 1) % this.dialogues.length;
    return dialogue;
  }

  act() {
    if (this.fleeing && this.fleeTarget) {
      if (this.x === this.fleeTarget.x && this.y === this.fleeTarget.y) {
        this.fleeing = false;
        this.fleeTarget = null;
        // If we reached the door from inside, step outside
        const currentBuilding = this.game.world.getBuildingAt(this.x, this.y);
        if(currentBuilding){
            // find a valid tile outside the door
            const moves = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const move of moves) {
                const newX = this.x + move[0];
                const newY = this.y + move[1];
                if (this.game.world.isPassable(newX, newY) && !this.game.isTileOccupied(newX, newY, this) && !this.game.world.getBuildingAt(newX, newY)) {
                    this.x = newX;
                    this.y = newY;
                    break;
                }
            }
        }

        return;
      }

      const astar = new ROT.Path.AStar(
        this.fleeTarget.x,
        this.fleeTarget.y,
        (x, y) => {
          const tile = this.game.world.getTileAt(x, y);
          return terrainInfo[tile]?.isPassable && !this.game.isTileOccupied(x, y, this);
        },
        { topology: 8 },
      );

      const path = [];
      astar.compute(this.x, this.y, (x, y) => {
        path.push({ x, y });
      });

      if (path.length > 1) {
        this.x = path[1].x;
        this.y = path[1].y;
      } else {
        // Cannot reach target, stop fleeing
        this.fleeing = false;
        this.fleeTarget = null;
      }
      return;
    }

    // NPCs only move about 30% of the time
    if (Math.random() > 0.3) {
      return;
    }
    this._wanderRandomly();
  }

  _wanderRandomly() {
    const moves = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
    const validMoves = [];

    for (const move of moves) {
      const newX = this.x + move[0];
      const newY = this.y + move[1];

      // Constrain movement to within the settlement radius
      if (
        this.homeSettlement &&
        Math.hypot(newX - this.homeSettlement.x, newY - this.homeSettlement.y) >
          25
      ) {
        continue;
      }

      const tile = this.game.world.getTileAt(newX, newY);
      if (
        terrainInfo[tile]?.isPassable &&
        !this.game.isTileOccupied(newX, newY, this)
      ) {
        validMoves.push(move);
      }
    }

    if (validMoves.length > 0) {
      const randomMove =
        validMoves[Math.floor(Math.random() * validMoves.length)];
      this.x += randomMove[0];
      this.y += randomMove[1];
    }
  }
  isCorpse() {
    return this.hp <= 0;
  }
}
