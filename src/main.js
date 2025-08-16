import { Player } from "./actors/player.js";
import { Bandit } from "./actors/bandit.js";
import { NPC } from "./actors/npc.js";
import { Shopkeeper } from "./actors/shopkeeper.js";
import { World } from "./world.js";
import { Renderer } from "./renderer.js";
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from "./constants.js";
import { terrainInfo } from "./terrain.js";
import { rollDice } from "./utils.js";
import { TILE_TYPE } from "./terrain.js";
import { setupMobileControls } from "./mobile_controls.js";


class Game {
  constructor() {
    this.world = new World(this);
    this.renderer = new Renderer(this);
    this.player = new Player(this, 0, 0, () => setupMobileControls(this));
    this.enemies = [];
    this.npcs = [];
    this.scheduler = new ROT.Scheduler.Simple();
    this.engine = new ROT.Engine(this.scheduler);
    this.gameState = "playing";
    this.turn = 0;
    this.activeShopkeeper = null;
    this.seenEnemies = new Set();
  }

  async init() {
    await this._loadHelpContent();
    document
      .getElementById("help-button")
      .addEventListener("click", () => this.toggleHelp());
    setupMobileControls(this);

    const turnManager = {
      act: () => {
        this.turn++;
        if (this.turn % 100 === 0 && this.enemies.length < 10) {
          this._spawnBanditAtEdge();
        }
      },
    };
    this.scheduler.add(turnManager, true);
    this.scheduler.add(this.player, true);
    this.renderer.drawAll();
    this.renderer.startAnimationLoop();
    this.engine.start();
  }
  async _loadHelpContent() {
    try {
      const response = await fetch("README.md");
      const text = await response.text();
      const lines = text.split("\n");
      const helpStartIndex = lines.findIndex(
        (line) => line.trim() === "## Help",
      );
      if (helpStartIndex !== -1) {
        document.getElementById("help-screen").innerHTML = lines
          .slice(helpStartIndex + 1)
          .join("\n")
          .replace(/`/g, "<code>")
          .replace(/### (.*)/g, "<h3>$1</h3>")
          .replace(/## (.*)/g, "<h2>$1</h2>")
          .replace(/\n\n/g, "<p>");
      }
    } catch (error) {
      console.error("Failed to load help content:", error);
    }
  }
  toggleMap() {
    this.gameState = this.gameState === "map" ? "playing" : "map";
    this.renderer.drawAll();
  }
  toggleHelp() {
    const helpScreen = document.getElementById("help-screen");
    const isVisible = !helpScreen.classList.contains("hidden");
    helpScreen.classList.toggle("hidden");
    isVisible ? this.engine.unlock() : this.engine.lock();
  }
  handleEnemySightings(currentlyVisibleEnemies) {
    // If we're already paused, don't do anything.
    if (this.gameState === "announcement") return;

    let newEnemySpotted = false;
    for (const enemy of currentlyVisibleEnemies) {
      if (!this.seenEnemies.has(enemy)) {
        this.seenEnemies.add(enemy);
        this.renderer.displayMessage(
          `You spot ${enemy.name}! (Press [f] to continue)`,
        );
        newEnemySpotted = true;
      }
    }

    if (newEnemySpotted) {
      this.gameState = "announcement";
    }
  }
  handleHelpKeys(e) {
    if (e.key === "?" || e.key === "Escape") {
      e.preventDefault();
      this.toggleHelp();
    }
  }
  playerFire(player) {
    const weapon = player.getEquippedWeapon();
    if (!weapon || weapon.loaded <= 0) {
      this.renderer.displayMessage("Click.");
      return false; // Does not take a turn
    }
    window.sampler("revolver-shot-1", 0.5)

    weapon.loaded--; // Consume ammo

    // If challenging from cover, it's a Quickdraw situation
    if (player.combatStance === "challenging") {
      const target = this.enemies.find(
        (e) => !e.isCorpse() && this.renderer.visibleTiles.has(`${e.x},${e.y}`),
      );

      if (target) {
        target.respondToChallenge(); // Let the bandit react

        if (
          target.combatStance === "challenging" ||
          target.combatStance === "aiming"
        ) {
          this.renderer.displayMessage("A Quickdraw!");
          this.resolveQuickdraw(player, target);
        } else {
          // Bandit didn't challenge back, player's shot hits cover
          //this.renderer.displayMessage("Your shot hits the bandit's cover!");
          this.resolveShot(player, player.aimAngle);
        }
      } else {
        // No living target, just shoot at the environment
        this.renderer.displayMessage("You fire from cover.");
        this.resolveShot(player, player.aimAngle);
      }
      player.combatStance = "ducking"; // Return to ducking after the shot
    } else if (player.combatStance === "aiming") {
      // Standard shot from a standing position
      this.renderer.displayMessage("You fire!");
      this.resolveShot(player, player.aimAngle);
      player.combatStance = "standing"; // Return to standing after the shot
    }

    return true; // Firing always takes a turn
  }

  resolveQuickdraw(player, bandit) {
    this.renderer.displayMessage("A Quickdraw!");

    // The bandit also consumes its ammo and turn
    const banditWeapon = bandit.getEquippedWeapon();
    if (banditWeapon && banditWeapon.loaded > 0) {
      banditWeapon.loaded--;
    }

    const playerWins = Math.random() >= 0.5;
    const winner = playerWins ? player : bandit;
    const loser = playerWins ? bandit : player;

    this.renderer.displayMessage(`${winner.name} is faster!`);

    // Winner gets an accuracy bonus (negative error)
    // Loser gets a panic shot (large accuracy penalty)
    this.resolveShot(winner, winner._getAngleToPlayer(), -5); // -5 degree bonus
    this.resolveShot(loser, loser._getAngleToPlayer(), 20); // +20 degree penalty

    winner.combatStance = "ducking";
    loser.combatStance = "ducking";
  }
  toggleInventory() {
    window.sampler(
      this.gameState === "inventory" ? "ui-close" : "ui-open",
      0.2,
      { pan: 0 },
    );
    this.gameState = this.gameState === "inventory" ? "playing" : "inventory";
    this.renderer.drawAll();
  }
  startShopping(shopkeeper) {
    this.activeShopkeeper = shopkeeper;
    this.gameState = "shopping";
    this.renderer.drawAll();
  }
  stopShopping() {
    this.activeShopkeeper = null;
    this.gameState = "playing";
    this.renderer.drawAll();
  }

  buyItem(itemIndex) {
    if (this.gameState !== "shopping" || !this.activeShopkeeper) return;

    const shopkeeper = this.activeShopkeeper;
    const item = shopkeeper.inventory[itemIndex];

    if (!item || item.equipped) {
      this.renderer.displayMessage("You can't buy that.");
      return;
    }

    const prices = {
      revolver: 50,
      ammo_bullet: 1,
      can_of_beans: 2,
    };
    const price = prices[item.templateId] || 999;

    if (this.player.money < price) {
      this.renderer.displayMessage("You don't have enough money.");
      return;
    }

    this.player.money -= price;

    // Transfer item
    if (item.isStackable) {
      const existingStack = this.player.inventory.find(
        (i) => i.templateId === item.templateId,
      );
      if (existingStack) {
        existingStack.quantity++;
      } else {
        this.player.inventory.push({ ...item, quantity: 1 });
      }
      item.quantity--;
      if (item.quantity <= 0) {
        shopkeeper.inventory.splice(itemIndex, 1);
      }
    } else {
      this.player.inventory.push(item);
      shopkeeper.inventory.splice(itemIndex, 1);
    }

    this.renderer.displayMessage(`You bought a ${item.name}.`);
    this.renderer.drawAll(); // Redraw shop and UI
  }

  isTileOccupied(x, y, actorToIgnore = null) {
    if (
      this.player.x === x &&
      this.player.y === y &&
      this.player !== actorToIgnore
    )
      return true;

    for (const enemy of this.enemies) {
      if (enemy === actorToIgnore) continue;
      if (enemy.x === x && enemy.y === y) return true;
    }
    for (const npc of this.npcs) {
      if (npc === actorToIgnore) continue;
      if (npc.x === x && npc.y === y) return true;
    }

    return false;
  }

  _spawnBanditAtEdge() {
    let x, y;
    let maxAttempts = 50;
    let attempts = 0;
    const minDistance = Math.floor(DISPLAY_WIDTH / 2);
    const maxDistance = DISPLAY_WIDTH;

    do {
      const angle = Math.random() * 2 * Math.PI;
      const distance =
        minDistance + Math.random() * (maxDistance - minDistance);
      x = Math.round(this.player.x + Math.cos(angle) * distance);
      y = Math.round(this.player.y + Math.sin(angle) * distance);
      attempts++;
    } while (
      (this.world.getTileAt(x, y) !== "." || this.isTileOccupied(x, y)) &&
      attempts < maxAttempts
    );

    if (attempts < maxAttempts) {
      let baseSettlement;
      const nearbySettlements = this.world.findNearbySettlements(x, y, 1);
      if (nearbySettlements.length > 0) {
        baseSettlement = nearbySettlements[0];
      }
      const enemy = new Bandit(this, x, y, baseSettlement);
      this.enemies.push(enemy);
      this.scheduler.add(enemy, true);
      this.renderer.displayMessage(`${enemy.name} has moved into the area.`);
    }
  }

  getLine(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0),
      dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      points.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      let e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
    return points;
  }

  initiateQuickdraw(challenger) {
    const weapon = challenger.getEquippedWeapon();
    if (!weapon || weapon.loaded <= 0) {
      this.renderer.displayMessage("Click.");
      return false;
    }

    // Find target
    // For now, player's only target is the nearest visible enemy
    const target = this.enemies.find(
      (e) => !e.isCorpse() && this.renderer.visibleTiles.has(`${e.x},${e.y}`),
    );

    if (!target) {
      this.renderer.displayMessage("There is no one to shoot at.");
      return false;
    }

    // Announce the challenge and give target a chance to respond
    target.respondToChallenge();

    // Check for Quickdraw
    if (
      challenger.combatStance === "challenging" &&
      target.combatStance === "challenging"
    ) {
      this.renderer.displayMessage("A Quickdraw!");
      // Simple speed roll. Could be enhanced with weapon stats.
      const playerWins = Math.random() >= 0.5;
      const winner = playerWins ? challenger : target;
      const loser = playerWins ? target : challenger;

      this.renderer.displayMessage(`${winner.name} is faster!`);
      this.resolveShot(
        winner,
        winner._getAngleToPlayer ? winner._getAngleToPlayer() : winner.aimAngle,
      );
      loser.takeDamage(rollDice(winner.getEquippedWeapon().damage)); // Apply direct damage

      winner.combatStance = "ducking";
      loser.combatStance = "ducking";
    } else {
      // Standard shot against cover
      this.renderer.displayMessage("The shot rings out!");
      this.resolveShot(challenger, challenger.aimAngle);
      challenger.combatStance = "ducking";
    }

    challenger.getEquippedWeapon().loaded--;
    this.renderer.drawAll();
    return true; // The action took a turn
  }

  resolveShot(attacker, angleInDegrees, accuracyModifier = 0) {
    const weapon = attacker.getEquippedWeapon();
    const totalError =
      (weapon?.aimError || 0) + (attacker.aimError || 0) + accuracyModifier;
    const deviation = (Math.random() - 0.5) * Math.max(0, totalError); // Ensure error isn't negative
    const finalAngle = angleInDegrees + deviation;

    const rad = finalAngle * (Math.PI / 180);
    const aimVector = { x: Math.cos(rad), y: Math.sin(rad) };
    const line = this.getLine(
      attacker.x,
      attacker.y,
      Math.round(attacker.x + aimVector.x * 20),
      Math.round(attacker.y + aimVector.y * 20),
    );

    for (let i = 1; i < line.length; i++) {
      const point = line[i];
      const targetActor = [this.player, ...this.enemies, ...this.npcs].find(
        (actor) =>
          !actor.isCorpse() &&
          actor.x === point.x &&
          actor.y === point.y &&
          actor !== attacker,
      );

      if (targetActor) {
        // A 'challenging' actor is EXPOSED and can be hit directly.
        if (targetActor.combatStance === "ducking") {
          this.renderer.displayMessage(
            `The shot hits ${targetActor.name}'s cover!`,
          );
          this.renderer.createRicochetEffect(point.x, point.y, aimVector);
        } else {
          this.attack(attacker, targetActor, aimVector);
        }
        return;
      }

      const tile = this.world.getTileAt(point.x, point.y);
      const info = terrainInfo[tile];
      if (info && !info.isBulletPassable) {
        this.world.damageTerrain(point.x, point.y, 1); // Damage the terrain
        const cactusTypes = [
          TILE_TYPE.CACTUS,
          TILE_TYPE.CACTUS_2,
          TILE_TYPE.CACTUS_3,
        ];
        if (cactusTypes.includes(tile)) {
          this.renderer.createSplatterEffect(
            point.x,
            point.y,
            aimVector,
            "cactus",
            10,
          );
        } else {
          this.renderer.createRicochetEffect(point.x, point.y, aimVector);
        }
        return;
      }
    }
  }
  attack(attacker, target, aimVector, directDamage = null) {
    const weapon = attacker.getEquippedWeapon();
    if (!weapon) return;

    const damage = directDamage ?? rollDice(weapon.damage);
    this.renderer.displayMessage(`${target.name} is hit for ${damage} damage!`);
    if (aimVector) {
      this.renderer.createSplatterEffect(
        target.x,
        target.y,
        aimVector,
        "blood",
        15,
      );
    }
    target.takeDamage(damage);
  }

  killEnemy(enemy) {
    this.scheduler.remove(enemy);
    this.renderer.displayMessage(`You killed ${enemy.name}.`);
    enemy.char = "†";
    enemy.color = "#8B0000";
    // ... (rest of the logic is fine)
    if (enemy.inventory.length > 0) {
      const dropCoords = { x: enemy.x, y: enemy.y };
      const validDropTiles = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const x = dropCoords.x + dx;
          const y = dropCoords.y + dy;
          if (terrainInfo[this.world.getTileAt(x, y)]?.isPassable) {
            validDropTiles.push({ x, y });
          }
        }
      }
      for (const item of enemy.inventory) {
        let tileToDropOn = dropCoords;
        if (validDropTiles.length > 0) {
          const tileIndex = Math.floor(Math.random() * validDropTiles.length);
          tileToDropOn = validDropTiles.splice(tileIndex, 1)[0];
        }
        const itemKey = `${tileToDropOn.x},${tileToDropOn.y}`;
        const itemsOnTile = this.world.itemsOnGround.get(itemKey) || [];
        this.world.itemsOnGround.set(itemKey, [...itemsOnTile, item]);
      }
    }
    this.renderer.createSplatterEffect(
      enemy.x,
      enemy.y,
      { x: 0, y: 0 },
      "corpse",
      15,
    );
  }

  gameOver() {
    this.engine.lock();
    this.player.char = "†";
    this.player.color = "#8B0000";
    this.renderer.createSplatterEffect(
      this.player.x,
      this.player.y,
      { x: 0, y: 0 },
      "corpse",
      15,
    );
    this.renderer.drawAll();
    document.getElementById("game-ui").textContent = "YOU DIED";
  }
}

const game = new Game();
game.init();
