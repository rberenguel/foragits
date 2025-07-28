import { Player } from "./actors/player.js";
import { Bandit } from "./actors/bandit.js";
import { NPC } from "./actors/npc.js";
import { Shopkeeper } from "./actors/shopkeeper.js";
import { World } from "./world.js";
import { Renderer } from "./renderer.js";
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from "./constants.js";
import { terrainInfo } from "./terrain.js";
import { rollDice } from "./utils.js";

class Game {
  constructor() {
    this.world = new World(this);
    this.renderer = new Renderer(this);
    this.player = new Player(this, 0, 0);
    this.enemies = [];
    this.npcs = [];
    this.scheduler = new ROT.Scheduler.Simple();
    this.engine = new ROT.Engine(this.scheduler);
    this.gameState = "playing";
    this.turn = 0; // Confirm ROT does not have this built-in
    this.helpContent = [];
    this.activeShopkeeper = null;
    this.previouslyVisibleEnemies = new Set();
  }

  async init() {
    await this._loadHelpContent();
    document
      .getElementById("help-button")
      .addEventListener("click", () => this.toggleHelp());
    // for (let i = 0; i < 5; i++) this._spawnEnemy(); // Removed initial spawn
    const turnManager = {
      act: () => {
        this.turn++;
        // Every 100 turns, check if we need to spawn a new bandit
        if (this.turn % 100 === 0) {
          if (this.enemies.length < 10) {
            // Max 10 bandits at a time
            this._spawnBanditAtEdge();
          }
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
        const rawLines = lines.slice(helpStartIndex + 1);
        let htmlContent = "";
        rawLines.forEach((line) => {
          line = line.replace(/`/g, "<code>");
          if (line.trim().startsWith("###")) {
            htmlContent += `<h3>${line.replace("###", "").trim()}</h3>`;
          } else if (line.trim().startsWith("##")) {
            htmlContent += `<h2>${line.replace("##", "").trim()}</h2>`;
          } else if (line.trim()) {
            htmlContent += `<p>${line.trim()}</p>`;
          }
        });
        document.getElementById("help-screen").innerHTML = htmlContent;
      }
    } catch (error) {
      console.error("Failed to load help content from README.md:", error);
      document.getElementById("help-screen").innerHTML =
        "<p>Error loading help.</p>";
    }
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
    const helpScreen = document.getElementById("help-screen");
    const isVisible = !helpScreen.classList.contains("hidden");

    if (isVisible) {
      helpScreen.classList.add("hidden");
      this.engine.unlock();
      window.removeEventListener("keydown", this.boundHelpKeyHandler);
    } else {
      helpScreen.classList.remove("hidden");
      this.engine.lock();
      this.boundHelpKeyHandler = this.handleHelpKeys.bind(this);
      window.addEventListener("keydown", this.boundHelpKeyHandler);
    }
  }

  handleHelpKeys(e) {
    if (e.key === "?" || e.key === "Escape") {
      e.preventDefault();
      this.toggleHelp();
    }
  }

  toggleInventory() {
    if (this.gameState === "playing") {
      this.gameState = "inventory";
    } else if (this.gameState === "inventory") {
      this.gameState = "playing";
    }
    this.renderer.drawAll(); // Redraw the screen with the correct view
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

  resolveShot(attacker, angleInDegrees) {
    const rad = angleInDegrees * (Math.PI / 180);
    const aimVector = { x: Math.cos(rad), y: Math.sin(rad) };
    const line = this.getLine(
      attacker.x,
      attacker.y,
      Math.round(attacker.x + aimVector.x * 20),
      Math.round(attacker.y + aimVector.y * 20),
    );

    for (let i = 1; i < line.length; i++) {
      const point = line[i];

      // Check for player
      if (
        this.player.x === point.x &&
        this.player.y === point.y &&
        attacker !== this.player
      ) {
        this.attack(attacker, this.player, aimVector);
        return; // Stop after hitting the first target
      }

      // Check for enemies
      const enemy = this.enemies.find(
        (e) => e.x === point.x && e.y === point.y && e.hp > 0,
      );
      if (enemy && attacker !== enemy) {
        this.attack(attacker, enemy, aimVector);
        return; // Stop after hitting the first target
      }

      // Check for NPCs (including shopkeepers)
      const npc = this.npcs.find(
        (n) => n.x === point.x && n.y === point.y && n.hp > 0,
      );
      if (npc && attacker !== npc) {
        this.attack(attacker, npc, aimVector);
        return; // Stop after hitting the first target
      }

      // Check for terrain collision
      const tile = this.world.getTileAt(point.x, point.y);
      const info = terrainInfo[tile];
      if (info && !info.isBulletPassable) {
        if (tile === "🌵") {
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
        return; // Stop after hitting terrain
      }
    }
  }

  attack(attacker, target, aimVector = null) {
    // The attack method now just applies damage and effects
    if (target.isDucking) {
      if (target instanceof Player) {
        this.renderer.displayMessage("The bandit's shot hits your cover!");
      } else {
        this.renderer.displayMessage("Your shot hits the bandit's cover!");
      }
      // Maybe add a ricochet effect on the cover tile later
      return;
    }

    const weapon = attacker.getEquippedWeapon();
    if (!weapon) return; // Should not happen if called from resolveShot

    let damage = rollDice(weapon.damage);

    // Special shopkeeper shotgun logic
    if (attacker instanceof Shopkeeper && weapon.templateId === "shotgun") {
      const distance = Math.hypot(target.x - attacker.x, target.y - attacker.y);
      if (distance < 5) {
        damage = 10; // Max damage at close range
      }
    }

    if (target instanceof Player) {
      this.renderer.displayMessage(`You are shot by ${attacker.name}!`);
      target.takeDamage(damage);
      if (attacker instanceof Shopkeeper && weapon.templateId === "shotgun") {
        this.renderer.createSplatterEffect(
          target.x,
          target.y,
          aimVector,
          "blood",
          40, // More blood for shotgun
        );
      }
    } else if (target instanceof Bandit || target instanceof Shopkeeper) {
      target.hp -= damage;
      this.renderer.displayMessage(
        `You hit ${target.name} for ${damage} damage!`,
      );

      if (target instanceof Shopkeeper) {
        target.isHostile = true;
      }

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
    } else if (target instanceof NPC) {
      target.hp -= damage;
      this.renderer.displayMessage(
        `You hit ${target.name} for ${damage} damage!`,
      );
      if (target.hp <= 0) this.killEnemy(target);
    }
  }

  killEnemy(enemy) {
    this.scheduler.remove(enemy);
    this.renderer.displayMessage(`You killed ${enemy.name}.`);
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
    this.player.char = "†";
    this.player.color = "#8B0000";
    this.renderer.createSplatterEffect(
      this.player.x,
      this.player.y,
      { x: 0, y: 0 },
      "corpse",
      15,
    );
    this.renderer.drawAll(); // Redraw to show the tombstone
    const ui = document.getElementById("game-ui");
    ui.textContent = "YOU DIED";
    ui.style.color = "red";
  }
}

const game = new Game();
game.init();
