import { terrainInfo, TILE_TYPE } from "../terrain.js";

export class Player {
  constructor(game, x, y) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.hp = 10;
    this.ammo = 6;
    this.isAiming = false;
    this.aimAngle = 0;
  }

  act() {
    this.game.engine.lock();
    window.addEventListener("keydown", this);
  }

  handleEvent(e) {
    e.preventDefault();
    const code = e.keyCode;

    if (code === ROT.KEYS.VK_A) {
      this.isAiming = !this.isAiming;
      this.game.renderer.drawAll();
      return;
    }

    let tookTurn = false;
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

  takeDamage(amount) {
    this.hp -= amount;
    this.game.renderer.updateUI();
    this.game.renderer.flashScreen();
    if (this.hp <= 0) this.game.gameOver();
  }

  _handleAimingInput(code) {
    if (code === ROT.KEYS.VK_F) {
      this._fireShot();
      return true;
    }
    let change = 0;
    if (code === ROT.KEYS.VK_LEFT) change = -5;
    if (code === ROT.KEYS.VK_RIGHT) change = 5;

    if (change !== 0) {
      this.aimAngle = (this.aimAngle + change + 360) % 360;
      this.game.renderer.drawAll();
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

    const targetEnemy = this.game.enemies.find(
      (e) => e.x === newX && e.y === newY,
    );
    if (targetEnemy && targetEnemy.isCorpse() && !targetEnemy.looted) {
      this.ammo = Math.min(6, this.ammo + 2);
      targetEnemy.looted = true;
      targetEnemy.color = "#4a0101";

      const banditName = targetEnemy.name || "an unnamed outlaw";
      const settlementName =
        targetEnemy.baseSettlement?.name || "the dusty plains";
      const message = `Here lies ${banditName} from ${settlementName}.`;
      this.game.renderer.displayMessage(message);
    }

    const tileChar = this.game.world.getTileAt(newX, newY);
    const info = terrainInfo[tileChar];
    if (!info?.isPassable) return false;

    this.x = newX;
    this.y = newY;

    this._checkForPlacard();

    this.game.renderer.drawAll();
    this.game.renderer.updateUI();
    return true;
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
    if (this.ammo <= 0) return;
    this.ammo--;

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

      // --- CORRECTED BULLET COLLISION LOGIC ---
      if (info && !info.isBulletPassable) {
        // Bullet is stopped by terrain. Now, determine the effect.
        if (tile === TILE_TYPE.CACTUS) {
          this.game.renderer.createSplatterEffect(
            point.x,
            point.y,
            aimVector,
            "cactus",
            10,
          );
        } else {
          // All other non-passable things (walls) cause a ricochet.
          this.game.renderer.createRicochetEffect(point.x, point.y, aimVector);
        }
        break;
      }
    }
    this.isAiming = false;
    this.game.renderer.drawAll();
    this.game.renderer.updateUI();
  }
}
