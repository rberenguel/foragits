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
  constructor(game, x, y) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.hp = 10;
    this.ammo = 6;
    this.char = "@";
    this.color = "#773300";
    this.isAiming = false;
    this.aimAngle = 0;
    this.isDucking = false;
    this.aimError = 2; // Base accuracy

    this.money = 2;
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
  _getItems() {
    const itemKey = `${this.x},${this.y}`;
    const itemsOnTile = this.game.world.itemsOnGround.get(itemKey);

    if (!itemsOnTile || itemsOnTile.length === 0) {
      this.game.renderer.displayMessage("There is nothing here to pick up.");
      return false; // Does not take a turn
    }

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
      message += `${moneyFound}`;
    }
    message += ".";

    this.game.renderer.displayMessage(message);
    this.game.world.itemsOnGround.delete(itemKey);

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
      if (this.isAiming) {
        const building = this.game.world.getBuildingAt(this.x, this.y);
        if (building && building.isShop) {
          const shopkeeper = this.game.npcs.find(
            (n) =>
              n instanceof Shopkeeper &&
              n.homeSettlement.name === building.settlementName,
          );
          if (shopkeeper) {
            shopkeeper.isHostile = true;
            this.game.renderer.displayMessage(
              "The shopkeeper draws a shotgun!",
            );
          }
        }
      }
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
    if (this.game.gameState === "shopping") {
      if (code === ROT.KEYS.VK_ESCAPE) {
        this.game.stopShopping();
        return;
      }
      // TODO: Handle buying items
      return;
    }
    if (this.game.gameState === "announcement") {
      if (key === "f") {
        this.game.gameState = "playing";
      }
      // No turn taken, just acknowledging the message
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
    if (key === "u") {
      tookTurn = this._useItem();
    }
    if (key === "d") {
      tookTurn = this._toggleDuck();
    }
    if (key === "t") {
      tookTurn = this._talkToNPC();
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
    this.isDucking = false; // Moving cancels ducking
    const actors = [...this.game.enemies, ...this.game.npcs];
    const corpse = actors.find(
      (e) => e.x === this.x && e.y === this.y && e.isCorpse(),
    );
    if (corpse) {
      const actorName = corpse.name || "an unnamed soul";
      const settlementName =
        corpse.baseSettlement?.name ||
        corpse.homeSettlement?.name ||
        "the dusty plains";
      const message = `Here lies ${actorName} from ${settlementName}.`;
      this.game.renderer.displayMessage(message);
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
    this.game.renderer.updateUI(); // Update immediately

    // Check for misfire
    if (Math.random() < (weapon.misfireChance || 0)) {
      this.game.renderer.displayMessage(`Your ${weapon.name} misfired!`);
      this.isAiming = false;
      this.game.renderer.drawAll();
      return true; // Misfire takes a turn
    }

    const wasDucking = this.isDucking;
    if (wasDucking) {
      this.isDucking = false;
      this.game.renderer.drawAll(); // Redraw to get the "glimpse"
    }

    // Calculate accuracy deviation
    const totalError = (this.aimError || 0) + (weapon.aimError || 0);
    const deviation = (Math.random() - 0.5) * totalError;
    const finalAngle = this.aimAngle + deviation;

    this.game.resolveShot(this, finalAngle);

    this.isAiming = false;

    if (wasDucking) {
      setTimeout(() => {
        this.isDucking = true;
        this.game.renderer.drawAll();
        this.game.renderer.updateUI();
      }, 100); // 100ms delay for the glimpse
    } else {
      // If not ducking, just redraw normally to remove aim line etc.
      this.game.renderer.drawAll();
    }

    return true; // A successful shot takes a turn
  }
  _talkToNPC() {
    let talked = false;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const tileX = this.x + dx;
        const tileY = this.y + dy;

        const npc = this.game.npcs.find((n) => n.x === tileX && n.y === tileY);
        if (npc) {
          if (npc instanceof Shopkeeper) {
            this.game.startShopping(npc);
          } else {
            this.game.renderer.displayMessage(
              `"${npc.getNextDialogue()}" -${npc.name}`,
            );
          }
          talked = true;
          break;
        }
      }
      if (talked) break;
    }

    if (!talked) {
      this.game.renderer.displayMessage("There's no one here to talk to.");
    }
    return talked; // Talking takes a turn if successful
  }
  _toggleDuck() {
    if (this.isDucking) {
      this.isDucking = false;
      this.game.renderer.displayMessage("You pop up from behind cover.");
      this.game.renderer.drawAll();
      return true; // Takes a turn to stand up
    }

    // Check for adjacent cover
    let hasCover = false;
    const coverTypes = [TILE_TYPE.ROCK];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const tileX = this.x + dx;
        const tileY = this.y + dy;
        const tile = this.game.world.getTileAt(tileX, tileY);
        if (coverTypes.includes(tile)) {
          hasCover = true;
          break;
        }
      }
      if (hasCover) break;
    }

    if (hasCover) {
      this.isDucking = true;
      this.isAiming = false; // Can't aim while fully ducked
      this.game.renderer.displayMessage("You duck behind cover.");
      this.game.renderer.drawAll();
      return true; // Takes a turn
    } else {
      this.game.renderer.displayMessage("There is no cover here.");
      return false; // No turn
    }
  }
  _useItem() {
    // 1. Find adjacent fire pit
    let firePitCoords = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const tileX = this.x + dx;
        const tileY = this.y + dy;
        const tile = this.game.world.getTileAt(tileX, tileY);
        if (tile === TILE_TYPE.FIRE_PIT_INACTIVE) {
          firePitCoords = { x: tileX, y: tileY };
          break;
        }
      }
      if (firePitCoords) break;
    }

    if (!firePitCoords) {
      this.game.renderer.displayMessage("You are not near a fire pit.");
      return false; // No turn taken
    }

    // 2. Find beans in inventory
    const beanIndex = this.inventory.findIndex(
      (i) => i.templateId === "can_of_beans",
    );
    const beans = this.inventory[beanIndex];

    if (!beans) {
      this.game.renderer.displayMessage(
        "You have nothing to cook on the fire.",
      );
      return false;
    }

    // NEW: Check if player is already at full health
    if (this.hp >= 10) {
      this.game.renderer.displayMessage("You are already at full health.");
      return false; // No turn taken
    }

    // 3. Use the item
    this.hp = Math.min(10, this.hp + beans.heals); // Assuming max HP is 10

    // 4. Decrement or remove item
    if (beans.quantity > 1) {
      beans.quantity--;
    } else {
      this.inventory.splice(beanIndex, 1);
    }

    // 5. Give feedback
    this.game.renderer.displayMessage(
      "You warm a can of beans by the fire. You feel better.",
    );
    this.game.renderer.updateUI();

    return true; // Turn taken
  }
}
