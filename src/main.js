import { Player } from "./actors/player.js";
import { Bandit } from "./actors/bandit.js";
import { World } from "./world.js";
import { Renderer } from "./renderer.js";
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from "./constants.js";
import { terrainInfo } from "./terrain.js";

class Game {
  constructor() {
    this.world = new World(this);
    this.renderer = new Renderer(this);
    this.player = new Player(this, 0, 0);
    this.enemies = [];
    this.scheduler = new ROT.Scheduler.Simple();
    this.engine = new ROT.Engine(this.scheduler);
    this.gameState = "playing";
    this.turn = 0 // Confirm ROT does not have this built-in
  }

  init() {
    document
      .getElementById("help-button")
      .addEventListener("click", () => this.toggleHelp());
    for (let i = 0; i < 5; i++) this._spawnEnemy();
const turnManager = {
        act: () => {
            this.turn++;
        }
    };
    this.scheduler.add(turnManager, true);
        this.scheduler.add(this.player, true);
    this.renderer.drawAll();
    this.renderer.startAnimationLoop();
    this.engine.start();
  }
  toggleMap() {
    if (this.gameState !== "map") {
      this.gameState = "map";
    } else {
      this.gameState = "playing";
    }
    this.renderer.drawAll();
  }
  toggleHelp() {
    if (this.gameState !== "help") {
      this.gameState = "help";
    } else {
      this.gameState = "playing";
    }
    this.renderer.drawAll();
  }
  toggleInventory() {
    if (this.gameState === "playing") {
      this.gameState = "inventory";
    } else if (this.gameState === "inventory") {
      this.gameState = "playing";
    }
    this.renderer.drawAll(); // Redraw the screen with the correct view
  }
  isTileOccupied(x, y, actorToIgnore = null) {
    if (this.player.x === x && this.player.y === y && this.player !== actorToIgnore) return true;

    for (const enemy of this.enemies) {
      if (enemy === actorToIgnore) continue;
      if (enemy.x === x && enemy.y === y) return true;
    }

    return false;
  }
  _spawnEnemy() {
    let x, y;
    let maxAttempts = 1000;
    let attempts = 0;
    do {
      x = this.player.x + Math.floor((Math.random() - 0.5) * DISPLAY_WIDTH);
      y = this.player.y + Math.floor((Math.random() - 0.5) * DISPLAY_HEIGHT);
      attempts++;
    } while (this.world.getTileAt(x, y) !== "." && attempts < maxAttempts);

    // If the loop failed, log an error and don't spawn the enemy
    if (attempts >= maxAttempts) {
      console.error(
        "Failed to find a valid spawn point for an enemy after 1000 attempts.",
      );
      return;
    }
    let baseSettlement;
    const nearbySettlements = this.world.findNearbySettlements(x, y, 3);
    if (nearbySettlements.length > 0) {
      baseSettlement =
        nearbySettlements[Math.floor(Math.random() * nearbySettlements.length)];
    }

    const enemy = new Bandit(this, x, y, baseSettlement);

    this.enemies.push(enemy);
    this.scheduler.add(enemy, true);
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

  attack(attacker, target, aimVector = null) {
    if (target instanceof Player) {
      // Bandit is attacking the player
      const weapon = attacker.getEquippedWeapon();
      if (weapon && weapon.loaded > 0) {
        weapon.loaded--;
        target.takeDamage(1);
      }
    } else if (target instanceof Bandit) {
      // Player is attacking the bandit
      const damage = Math.random() * 0.6 + 0.5;
      target.hp -= damage;
      const distance = Math.hypot(target.x - attacker.x, target.y - attacker.y);
      const particleCount = Math.max(5, Math.floor(25 - distance));
      this.renderer.createSplatterEffect(
        target.x,
        target.y,
        aimVector,
        "blood",
        particleCount,
      );

      if (target.hp <= 0) this.killEnemy(target);
    }
  }

  killEnemy(enemy) {
    this.scheduler.remove(enemy);
    enemy.char = "†";
    enemy.color = "#8B0000";
    if (enemy.inventory.length > 0) {
      const dropCoords = { x: enemy.x, y: enemy.y };
      const validDropTiles = [];
      // Find adjacent passable tiles
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const x = dropCoords.x + dx;
          const y = dropCoords.y + dy;
          const tileChar = this.world.getTileAt(x, y);
          if (terrainInfo[tileChar]?.isPassable) {
            validDropTiles.push({ x, y });
          }
        }
      }

      // Drop each item
      for (const item of enemy.inventory) {
        let tileToDropOn = dropCoords; // Default to corpse tile
        if (validDropTiles.length > 0) {
          // Pick a random valid tile and remove it from the list
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
    const ui = document.getElementById("game-ui");
    ui.textContent = "YOU DIED";
    ui.style.color = "red";
  }
}

const game = new Game();
game.init();
