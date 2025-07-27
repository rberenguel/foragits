import { Player } from "./actors/player.js";
import { Bandit } from "./actors/bandit.js";
import { World } from "./world.js";
import { Renderer } from "./renderer.js";
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from "./constants.js";

class Game {
  constructor() {
    this.world = new World();
    this.renderer = new Renderer(this);
    this.player = new Player(this, 0, 0);
    this.enemies = [];
    this.scheduler = new ROT.Scheduler.Simple();
    this.engine = new ROT.Engine(this.scheduler);
  }

  init() {
    this.scheduler.add(this.player, true);
    for (let i = 0; i < 3; i++) this._spawnEnemy();

    this.renderer.drawAll();
    this.renderer.startAnimationLoop();
    this.engine.start();
  }

  _spawnEnemy() {
    let x, y;
    do {
      x = this.player.x + Math.floor((Math.random() - 0.5) * DISPLAY_WIDTH);
      y = this.player.y + Math.floor((Math.random() - 0.5) * DISPLAY_HEIGHT);
    } while (this.world.getTileAt(x, y) !== ".");

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
      target.takeDamage(1);
      // could add tracer logic here
    } else if (target instanceof Bandit) {
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
    enemy.looted = false;
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
