import { terrainInfo, TILE_TYPE } from "../terrain.js";
import { createItem } from "../items.js";

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
  constructor(game, x, y) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.hp = 10;
    this.ammo = 6;
    this.isAiming = false;
    this.aimAngle = 0;

    this.money = 2;
    this.inventory = [
      createItem("revolver_rusty", { equipped: true }),
      createItem("ammo_bullet", { quantity: 18 }),
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
  _getItems() {
    const itemKey = `${this.x},${this.y}`;
    const itemsOnTile = this.game.world.itemsOnGround.get(itemKey);

    if (!itemsOnTile || itemsOnTile.length === 0) {
      this.game.renderer.displayMessage("There is nothing here to pick up.");
      return false; // Does not take a turn
    }

    for (const item of itemsOnTile) {
      if (item.isStackable) {
        const existingStack = this.inventory.find((i) => i.name === item.name);
        if (existingStack) {
          existingStack.quantity += item.quantity;
        } else {
          this.inventory.push(item);
        }
      } else {
        this.inventory.push(item);
      }
    }
    this.game.world.itemsOnGround.delete(itemKey);
    this.game.renderer.displayMessage(
      `You pick up the ${itemsOnTile.map((i) => i.name).join(", ")}.`,
    );

    // Redraw immediately to remove items from map
    this.game.renderer.drawAll();
    return true; // Takes a turn
  }
  handleEvent(e) {
    e.preventDefault();
    let tookTurn = false;
    const code = e.keyCode;
    const key = e.key;
    if (code === ROT.KEYS.VK_R) {
      return this._reloadWeapon();
    }
    if (code === ROT.KEYS.VK_G) {
      return this._getItems();
    }
    if (code === ROT.KEYS.VK_A) {
      this.isAiming = !this.isAiming;
      this.game.renderer.drawAll();
      return;
    }
    if (code === ROT.KEYS.VK_L) {
      this._surveyArea();
      tookTurn = true;
    }
    if (this.gameState === "map") {
      if (code === ROT.KEYS.VK_M || code === ROT.KEYS.VK_ESCAPE)
        this.game.toggleMap();
      return;
    }
    if (this.game.gameState === "inventory") {
      if (code === ROT.KEYS.VK_I || code === ROT.KEYS.VK_ESCAPE) {
        this.game.toggleInventory();
      }
      return; // Do nothing else while in inventory
    }
    if (this.game.gameState === "help") {
      if (e.key === "?" || code === ROT.KEYS.VK_ESCAPE) this.game.toggleHelp();
      return;
    }
    // Somehow ROT.KEYS.VK_QUESTION_MARK does not match this
    if (e.key === "?") {
      this.game.toggleHelp();
      return;
    }
    // --- REGULAR 'PLAYING' STATE INPUT ---
    if (key === "?" || code === ROT.KEYS.VK_I || code === ROT.KEYS.VK_M) {
      if (key === "?") this.game.toggleHelp();
      if (code === ROT.KEYS.VK_I) this.game.toggleInventory();
      if (code === ROT.KEYS.VK_M) this.game.toggleMap();
      return;
    }

    if (this.isAiming) {
      tookTurn = this._handleAimingInput(code);
    } else {
      tookTurn = this._handleMovementInput(code);
    }

    if (tookTurn) {
      window.removeEventListener("keydown", this);
      this.game.engine.unlock();
    }
  }
  _surveyArea() {
    const surveyRadius = 250; // How far the player can "see" settlements
    // We only need the single nearest settlement for the message
    const nearbySettlements = this.game.world.findNearbySettlements(
      this.x,
      this.y,
      1,
    );

    if (
      nearbySettlements.length > 0 &&
      nearbySettlements[0].distance < surveyRadius
    ) {
      const nearest = nearbySettlements[0];
      const dx = nearest.x - this.x;
      const dy = nearest.y - this.y;
      const direction = getDirectionName(dx, dy);
      const distance = Math.abs(dx) + Math.abs(dy) > 100 ? "far" : "near";
      this.game.renderer.displayMessage(
        `You scan the horizon. You glimpse what looks like a settlement ${distance} to the ${direction}.`,
      );
    } else {
      this.game.renderer.displayMessage(
        "You see nothing but endless desert in all directions.",
      );
    }

    return true; // Surveying takes a turn
  }
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
    this.game.renderer.updateUI(); // Immediately show updated ammo
    return true; // Reloading takes a turn
  }
  takeDamage(amount) {
    this.hp -= amount;
    this.game.renderer.updateUI();
    this.game.renderer.flashScreen();
    if (this.hp <= 0) this.game.gameOver();
  }

  _handleAimingInput(code) {
    // Aiming adjustment does not take a turn
    if (code === ROT.KEYS.VK_LEFT || code === ROT.KEYS.VK_RIGHT) {
      let change = code === ROT.KEYS.VK_LEFT ? -5 : 5;
      this.aimAngle = (this.aimAngle + change + 360) % 360;
      this.game.renderer.drawAll();
      return false;
    }
    // Firing takes a turn (or fails)
    if (code === ROT.KEYS.VK_F) {
      return this._fireShot();
    }
    return false;
  }

  _handleMovementInput(code) {
    const keyMap = {
      [ROT.KEYS.VK_UP]: { x: 0, y: -1 },
      [ROT.KEYS.VK_DOWN]: { x: 0, y: 1 },
      [ROT.KEYS.VK_LEFT]: { x: -1, y: 0 },
      [ROT.KEYS.VK_RIGHT]: { x: 1, y: 0 },
    };
    if (!(code in keyMap)) return false;

    const { x: dx, y: dy } = keyMap[code];
    const newX = this.x + dx;
    const newY = this.y + dy;

    const tileChar = this.game.world.getTileAt(newX, newY);
    const info = terrainInfo[tileChar];
    if (!info?.isPassable) return false;

    this.x = newX;
    this.y = newY;
    const corpse = this.game.enemies.find(
      (e) => e.x === this.x && e.y === this.y && e.isCorpse(),
    );
    if (corpse) {
      const banditName = corpse.name || "an unnamed outlaw";
      const settlementName = corpse.baseSettlement?.name || "the dusty plains";
      const message = `Here lies ${banditName} from ${settlementName}.`;
      this.game.renderer.displayMessage(message);
      // They are never marked as read, they an always be re-checked
    }
    this._checkForPlacard();
    this._checkForItemsOnGround();

    this.game.renderer.drawAll();
    this.game.renderer.updateUI();
    return true;
  }
  _checkForItemsOnGround() {
    const itemKey = `${this.x},${this.y}`;
    const itemsOnTile = this.game.world.itemsOnGround.get(itemKey);

    if (itemsOnTile && itemsOnTile.length > 0) {
      this.game.renderer.displayMessage(
        `You see here ${itemsOnTile.map((i) => i.name).join(", ")}.`,
      );
    }
  }
  _checkForPlacard() {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const tileX = this.x + dx;
        const tileY = this.y + dy;
        const tile = this.game.world.getTileAt(tileX, tileY);

        if (tile === "팻") {
          const settlement = this.game.world.placardMap.get(
            `${tileX},${tileY}`,
          );
          if (settlement) {
            this.game.renderer.displayMessage(
              `You see a sign: "${settlement.name}"`,
            );
          }
        }
      }
    }
  }

  _fireShot() {
    const weapon = this.getEquippedWeapon();
    if (!weapon || weapon.loaded <= 0) {
      this.game.renderer.displayMessage("Click.");
      return false; // Firing with no ammo does NOT take a turn
    }

    weapon.loaded--; // Consume one round

    const rad = this.aimAngle * (Math.PI / 180);
    const aimVector = { x: Math.cos(rad), y: Math.sin(rad) };
    const line = this.game.getLine(
      this.x,
      this.y,
      Math.round(this.x + aimVector.x * 20),
      Math.round(this.y + aimVector.y * 20),
    );

    for (let i = 1; i < line.length; i++) {
      const point = line[i];
      const enemy = this.game.enemies.find(
        (e) => e.x === point.x && e.y === point.y && e.hp > 0,
      );
      if (enemy) {
        this.game.attack(this, enemy, aimVector);
        break;
      }
      const tile = this.game.world.getTileAt(point.x, point.y);
      const info = terrainInfo[tile];
      if (info && !info.isBulletPassable) {
        if (tile === TILE_TYPE.CACTUS) {
          this.game.renderer.createSplatterEffect(
            point.x,
            point.y,
            aimVector,
            "cactus",
            10,
          );
        } else {
          this.game.renderer.createRicochetEffect(point.x, point.y, aimVector);
        }
        break;
      }
    }

    this.isAiming = false;
    this.game.renderer.drawAll();
    this.game.renderer.updateUI();
    return true; // A successful shot takes a turn
  }
}
