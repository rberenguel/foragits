// src/actors/player.js
import { terrainInfo, TILE_TYPE } from "../terrain.js";
import { createItem } from "../items.js";
import { Shopkeeper } from "./shopkeeper.js";

function getDirectionName(dx, dy) {
  if (dx === 0 && dy === 0) return "here";
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  if (angle > -22.5 && angle <= 22.5) return "east";
  if (angle > 22.5 && angle <= 67.5) return "south-east";
  if (angle > 67.5 && angle <= 112.5) return "south";
  if (angle > 112.5 && angle <= 157.5) return "south-west";
  if (angle > 157.5 || angle <= -157.5) return "west";
  if (angle > -157.5 && angle <= -112.5) return "north-west";
  if (angle > -112.5 && angle <= -67.5) return "north";
  if (angle > -67.5 && angle <= -22.5) return "north-east";
  return "a strange direction";
}

export class Player {
  constructor(game, x, y, onStateChange = () => {}) {
    this.name = "You";
    this.game = game;
    this.x = x;
    this.y = y;
    this.hp = 10;
    this.char = "@";
    this.color = "#773300";
    this.aimAngle = 0; // Still needed for direction
    this.money = 2;
    this.onStateChange = onStateChange;

    // --- NEW STATE MACHINE ---
    this._combatStance = "standing"; // 'standing', 'ducking', 'challenging'
    Object.defineProperty(this, "combatStance", {
      get: () => this._combatStance,
      set: (value) => {
        if (this._combatStance !== value) {
          this._combatStance = value;
          this.onStateChange();
        }
      },
    });

    this.inventory = [
      createItem("revolver_rusty", { equipped: true }),
      createItem("ammo_bullet", { quantity: 18 }),
      createItem("can_of_beans", { quantity: 2 }),
      createItem("belt_rusty", { equipped: true }),
      createItem("hat_fedora", { equipped: true }),
      createItem("boots_worn", { equipped: true }),
    ];
  }

  getEquippedWeapon() {
    return this.inventory.find((i) => i.type === "weapon" && i.equipped);
  }

  act() {
    this.game.engine.lock();
    window.addEventListener("keydown", this);
  }
  isCorpse() {
    return this.hp <= 0;
  }
  handleEvent(e) {
    e.preventDefault();
    let tookTurn = false;
    const key = e.key;

    // --- ANNOUNCEMENT / UI SCREENS (NO CHANGE) ---
    if (this.game.gameState === "announcement") {
      if (key === "f") this.game.gameState = "playing";
      return;
    }
    if (this.game.gameState === "inventory") {
      if (key === "i" || key === "Escape") this.game.toggleInventory();
      return;
    }
    if (this.game.gameState === "map") {
      if (key === "m" || key === "Escape") this.game.toggleMap();
      return;
    }
    if (this.game.gameState === "shopping") {
      if (key === "Escape") this.game.stopShopping();
      return;
    }
    if (key === "?") {
      this.game.toggleHelp();
      return;
    }
    const isAimingStance =
      this.combatStance === "aiming" || this.combatStance === "challenging";
    // --- COMBAT AND MOVEMENT LOGIC ---
    switch (key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        if (isAimingStance) {
          this._updateAimAngle(key);
          tookTurn = false; // Aiming adjustment does not take a turn
        } else {
          tookTurn = this._handleMovement(key);
        }
        break;
      case "a":
        tookTurn = this._toggleAim();
        break;
      case "d":
        tookTurn = this._toggleDuck();
        break;
      case "f":
        if (isAimingStance) {
          tookTurn = this.game.playerFire(this);
        }
        break;
      // ... (other keys like 'r', 'g', 't', 'u', 'l' are fine)
      case "r":
        tookTurn = this._reloadWeapon();
        break;
      case "g":
        tookTurn = this._getItems();
        break;
      case "t":
        tookTurn = this._talkToNPC();
        break;
      case "u":
        tookTurn = this._useItem();
        break;
      case "l":
        tookTurn = this._surveyArea();
        break;
      case "i":
        this.game.toggleInventory();
        break;
      case "m":
        this.game.toggleMap();
        break;
    }

    if (tookTurn) {
      this.game.renderer.drawAll(); // Draw at the end of a successful turn
      window.removeEventListener("keydown", this);
      this.game.engine.unlock();
    } else if (isAimingStance) {
      this.game.renderer.drawAll(); // Redraw for non-turn actions like aiming
    }
  }
  _updateAimAngle(key) {
    const keyMap = {
      ArrowLeft: -5,
      ArrowRight: 5,
      ArrowUp: 0,
      ArrowDown: 0, // Or handle up/down as fine-tuning if desired
    };
    let change = 0;
    if (key === "ArrowLeft") change = -5;
    if (key === "ArrowRight") change = 5;
    this.aimAngle = (this.aimAngle + change + 360) % 360;
    return this.aimAngle;
  }
  _toggleDuck() {
    if (this.combatStance === "standing" || this.combatStance === "aiming") {
      if (this._isAdjacentToCover()) {
        this.combatStance = "ducking";
        this.game.renderer.displayMessage("You duck behind cover.");
        return true;
      } else {
        this.game.renderer.displayMessage("There is no cover here.");
        return false;
      }
    } else {
      // Was ducking or challenging
      this.combatStance = "standing";
      this.game.renderer.displayMessage("You stand up.");
      return true;
    }
  }
  _toggleAim() {
    switch (this.combatStance) {
      case "standing":
        this.combatStance = "aiming";
        this.game.renderer.displayMessage("You raise your weapon.");
        break;
      case "aiming":
        this.combatStance = "standing";
        this.game.renderer.displayMessage("You lower your weapon.");
        break;
      case "ducking":
        this.combatStance = "challenging";
        this.game.renderer.displayMessage("You take aim from behind cover...");
        break;
      case "challenging":
        this.combatStance = "ducking";
        this.game.renderer.displayMessage("You stand down.");
        break;
    }
    return true; // Toggling aim always takes a turn
  }
  _toggleCover() {
    if (this.combatStance === "standing") {
      const hasCover = this._isAdjacentToCover();
      if (hasCover) {
        this.combatStance = "ducking";
        this.game.renderer.displayMessage("You duck behind cover.");
      } else {
        this.game.renderer.displayMessage("There is no cover here.");
        return false;
      }
    } else {
      // Was 'ducking' or 'challenging'
      this.combatStance = "standing";
      this.game.renderer.displayMessage("You stand up.");
    }
    this.game.renderer.drawAll();
    return true;
  }

  _toggleChallenge() {
    if (this.combatStance === "ducking") {
      this.combatStance = "challenging";
      this.game.renderer.displayMessage(
        "You take aim from behind your cover...",
      );
    } else if (this.combatStance === "challenging") {
      this.combatStance = "ducking";
      this.game.renderer.displayMessage("You stand down.");
    } else {
      return false; // Can't challenge from 'standing'
    }
    this.game.renderer.drawAll();
    return true; // Taking a stance takes a turn
  }
  _getAngleToPlayer() {
    // For the player, this is just their current aim angle.
    // This provides a consistent interface for the renderer.
    return this.aimAngle;
  }

  _handleMovement(key) {
    const keyMap = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    if (!(key in keyMap)) return false;

    const { x: dx, y: dy } = keyMap[key];
    const newX = this.x + dx;
    const newY = this.y + dy;

    const tileChar = this.game.world.getTileAt(newX, newY);
    if (!terrainInfo[tileChar]?.isPassable) return false;

    this.x = newX;
    this.y = newY;
    this.combatStance = "standing"; // Moving always makes you stand
    this._checkForGroundMessages();
    this.game.renderer.drawAll();
    return true;
  }

  _isAdjacentToCover() {
    const coverTypes = [
      TILE_TYPE.ROCK,
      TILE_TYPE.WALL,
      TILE_TYPE.CACTUS,
      TILE_TYPE.CACTUS_2,
      TILE_TYPE.CACTUS_3,
      TILE_TYPE.SETTLEMENT_WALL,
      TILE_TYPE.WATER_TROUGH,
      TILE_TYPE.CRATE,
      TILE_TYPE.BARREL,
    ];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const checkX = this.x + dx;
        const checkY = this.y + dy;
        const tile = this.game.world.getTileAt(checkX, checkY);

        if (coverTypes.includes(tile)) {
          // If it's a destructible type, make sure it's not already destroyed
          const info = terrainInfo[tile];
          if (info && info.health) {
            const health = this.game.world.terrainHealth.get(
              `${checkX},${checkY}`,
            );
            if (health !== undefined && health <= 0) {
              continue; // This specific object is destroyed, so it's not cover.
            }
          }
          return true; // It's valid cover
        }
      }
    }
    return false;
  }

  _checkForGroundMessages() {
    // Check for corpses, items, and placards
    const actors = [...this.game.enemies, ...this.game.npcs];
    const corpse = actors.find(
      (a) => a.x === this.x && a.y === this.y && a.isCorpse(),
    );
    if (corpse) {
      const settlementName =
        corpse.baseSettlement?.name ||
        corpse.homeSettlement?.name ||
        "the dusty plains";
      this.game.renderer.displayMessage(
        `Here lies ${corpse.name} from ${settlementName}.`,
      );
      return;
    }

    const itemKey = `${this.x},${this.y}`;
    const items = this.game.world.itemsOnGround.get(itemKey);
    if (items && items.length > 0) {
      this.game.renderer.displayMessage(
        `You see here ${items.map((i) => i.name).join(", ")}.`,
      );
      return;
    }

    const placard = this.game.world.placardMap.get(itemKey);
    if (placard) {
      this.game.renderer.displayMessage(`You see a sign: "${placard.name}"`);
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.combatStance = "standing"; // Getting hit makes you stand up
    this.game.renderer.flashScreen();
    this.game.renderer.drawAll();
    if (this.hp <= 0) this.game.gameOver();
  }

  // Other methods like _reloadWeapon, _getItems, _talkToNPC, _useItem, _surveyArea are mostly unchanged
  // but ensure they return true/false correctly. Example:
  _reloadWeapon() {
    const weapon = this.getEquippedWeapon();
    if (!weapon) {
      this.game.renderer.displayMessage("You don't have a weapon equipped.");
      return false;
    }
    const ammoNeeded = weapon.capacity - weapon.loaded;
    if (ammoNeeded === 0) {
      this.game.renderer.displayMessage(
        `${weapon.name} is already fully loaded.`,
      );
      return false;
    }
    const ammoPouch = this.inventory.find((i) => i.type === "ammo");
    const ammoAvailable = ammoPouch ? ammoPouch.quantity : 0;
    if (ammoAvailable === 0) {
      this.game.renderer.displayMessage("You have no ammunition.");
      return false;
    }
    const ammoToTransfer = Math.min(ammoNeeded, ammoAvailable);
    weapon.loaded += ammoToTransfer;
    ammoPouch.quantity -= ammoToTransfer;
    this.game.renderer.displayMessage(`You reload the ${weapon.name}.`);
    this.game.renderer.drawAll();
    return true;
  }

  _getItems() {
    const itemKey = `${this.x},${this.y}`;
    const itemsOnTile = this.game.world.itemsOnGround.get(itemKey);
    if (!itemsOnTile || itemsOnTile.length === 0) {
      this.game.renderer.displayMessage("There is nothing here to pick up.");
      return false;
    }
    // ... (rest of the logic is fine)
    let itemsPickedUp = [];
    let moneyFound = 0;
    for (const item of itemsOnTile) {
      if (item.type === "money") {
        moneyFound += item.quantity;
        this.money += item.quantity;
      } else if (item.isStackable) {
        const existingStack = this.inventory.find((i) => i.name === item.name);
        if (existingStack) {
          existingStack.quantity += item.quantity;
        } else {
          this.inventory.push(item);
        }
        itemsPickedUp.push(item.name);
      } else {
        this.inventory.push(item);
        itemsPickedUp.push(item.name);
      }
    }
    let message = "You pick up ";
    if (itemsPickedUp.length > 0) {
      message += `the ${itemsPickedUp.join(", ")}`;
    }
    if (moneyFound > 0) {
      if (itemsPickedUp.length > 0) {
        message += " and ";
      }
      message += `$${moneyFound}`;
    }
    message += ".";
    this.game.renderer.displayMessage(message);
    this.game.world.itemsOnGround.delete(itemKey);
    this.game.renderer.drawAll();
    return true;
  }

  _talkToNPC() {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const npc = this.game.npcs.find(
          (n) => n.x === this.x + dx && n.y === this.y + dy,
        );
        if (npc) {
          if (npc instanceof Shopkeeper) {
            this.game.startShopping(npc);
          } else {
            this.game.renderer.displayMessage(
              `"${npc.getNextDialogue()}" -${npc.name}`,
            );
          }
          return true;
        }
      }
    }
    this.game.renderer.displayMessage("There's no one here to talk to.");
    return false;
  }
  _useItem() {
    let firePitCoords = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const tileX = this.x + dx;
        const tileY = this.y + dy;
        if (
          this.game.world.getTileAt(tileX, tileY) ===
          TILE_TYPE.FIRE_PIT_INACTIVE
        ) {
          firePitCoords = { x: tileX, y: tileY };
          break;
        }
      }
      if (firePitCoords) break;
    }
    if (!firePitCoords) {
      this.game.renderer.displayMessage("You are not near a fire pit.");
      return false;
    }
    const beanIndex = this.inventory.findIndex(
      (i) => i.templateId === "can_of_beans",
    );
    if (beanIndex === -1) {
      this.game.renderer.displayMessage("You have nothing to cook.");
      return false;
    }
    if (this.hp >= 10) {
      this.game.renderer.displayMessage("You are already at full health.");
      return false;
    }
    const beans = this.inventory[beanIndex];
    this.hp = Math.min(10, this.hp + beans.heals);
    if (beans.quantity > 1) {
      beans.quantity--;
    } else {
      this.inventory.splice(beanIndex, 1);
    }
    //window.sampler("eat", 0.5, { pan: 0 });
    this.game.renderer.displayMessage(
      "You warm a can of beans by the fire. You feel better.",
    );
    this.game.renderer.drawAll();
    return true;
  }
  _surveyArea() {
    const nearbySettlements = this.game.world.findNearbySettlements(
      this.x,
      this.y,
      1,
    );
    if (nearbySettlements.length > 0 && nearbySettlements[0].distance < 250) {
      const nearest = nearbySettlements[0];
      const dx = nearest.x - this.x;
      const dy = nearest.y - this.y;
      const direction = getDirectionName(dx, dy);
      const distance = Math.hypot(dx, dy) > 100 ? "far" : "near";
      this.game.renderer.displayMessage(
        `You scan the horizon. You glimpse what looks like a settlement ${distance} to the ${direction}.`,
      );
    } else {
      this.game.renderer.displayMessage(
        "You see nothing but endless desert in all directions.",
      );
    }
    return true;
  }
}
