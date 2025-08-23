// src/actors/shopkeeper.js
import { createItem } from "../items.js";
import { DISPLAY_WIDTH } from "../constants.js";
const firstNames = [
  "Silas",
  "Bartholomew",
  "Jedediah",
  "Phineas",
  "Beauregard",
  "Cornelius",
];
const lastNames = [
  "Blackwood",
  "Grumble",
  "Stonewall",
  "Copperpot",
  "Silverman",
  "Ironhand",
];

function generateShopkeeperName() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

export class Shopkeeper {
  constructor(game, x, y, homeSettlement) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.hp = 5; // Tougher than a regular person
    this.char = "P";
    this.color = "#f1c40f"; // Gold color
    this.name = generateShopkeeperName();
    this.homeSettlement = homeSettlement;
    this.dialogues = [
      "Looking to buy or sell?",
      "Got some fine wares, stranger.",
      "Don't cause any trouble in my shop.",
    ];
    this.dialogueIndex = 0;
    this.isHostile = false;
    this.money = 100; // Shopkeeper starts with 100 money
    this.inventory = [
      createItem("shotgun", { equipped: true }),
      createItem("revolver"),
      createItem("ammo_bullet", { quantity: 50 }),
      createItem("can_of_beans", { quantity: 10 }),
    ];
  }

  isUnarmed() {
    return false;
  }

  getEquippedWeapon() {
    return this.inventory.find((i) => i.type === "weapon" && i.equipped);
  }

  getNextDialogue() {
    const dialogue = this.dialogues[this.dialogueIndex];
    this.dialogueIndex = (this.dialogueIndex + 1) % this.dialogues.length;
    return dialogue;
  }

  // Shopkeepers are stationary unless hostile
  act() {
    if (!this.isHostile) return;

    const player = this.game.player;
    const weapon = this.getEquippedWeapon();
    if (!weapon || weapon.loaded <= 0) return;

    // Fire at the player
    window.sampler("shotgun-shot", 0.5, {
              pan: window.calculatePanFromPosition(this, this.game.player, DISPLAY_WIDTH),
            });
    weapon.loaded--;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const angleToTarget = Math.atan2(dy, dx) * (180 / Math.PI);
    this.game.resolveShot(this, angleToTarget);
  }

  isCorpse() {
    return this.hp <= 0;
  }

  takeDamage(amount) {
    this.hp -= amount;
        window.sampler(`shouts-${1+Math.floor(Math.random()*5)}`, 0.5, {
              pan: window.calculatePanFromPosition(this, this.game.player, DISPLAY_WIDTH),
            });
    this.isHostile = true; // Fight back!
    if (this.hp <= 0) {
      this.game.killEnemy(this);
    }
  }
}
