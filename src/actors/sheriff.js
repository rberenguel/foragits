import { NPC } from "./npc.js";
import { createItem } from "../items.js";
import { terrainInfo, TILE_TYPE } from "../terrain.js";
import { DISPLAY_WIDTH } from "../constants.js";

export class Sheriff extends NPC {
  constructor(game, x, y, homeSettlement) {
    super(game, x, y, homeSettlement);
    this.name = "Sheriff";
    this.char = "S"; // Unique character for Sheriff
    this.color = "#00008B"; // Dark blue color
    this.dialogues = [
      "Howdy, stranger. Keep your nose clean.",
      "Trouble? I'll handle it.",
      "This town's under my protection.",
    ];
    this.inventory = [
      createItem("revolver"),
      createItem("ammo_bullet", { quantity: 24 }),
    ];
    this.hp = 15; // Sheriffs are tougher
    this.aimError = 5; // Sheriffs are more accurate
    this.lastKnownPlayerPosition = null; // For combat AI
    this.combatStance = "standing"; // 'standing', 'ducking', 'challenging'

    const lightPasses = (x, y) => {
      const tileChar = this.game.world.getTileAt(x, y);
      return terrainInfo[tileChar]?.isTransparent ?? false;
    };
    this.fov = new ROT.FOV.PreciseShadowcasting(lightPasses);
  }

  getEquippedWeapon() {
    return this.inventory.find((i) => i.type === "weapon");
  }

  takeDamage(amount) {
    this.hp -= amount;
        window.sampler(`shouts-${1+Math.floor(Math.random()*5)}`, 0.5, {
          pan: window.calculatePanFromPosition(this, this.game.player, DISPLAY_WIDTH),
        });
    this.isHostile = true; // Attacking a sheriff makes them hostile
    this.combatStance = "standing"; // Getting hit forces you out of cover
    if (this.hp <= 0) {
      this.game.killEnemy(this);
    }
  }

  act() {
    if (this.isCorpse() || this.game.player.hp <= 0) {
      return;
    }

    if (!this.isHostile) {
      // Sheriffs are generally stationary unless hostile or patrolling
      return; // No action if not hostile
    }

    // --- Combat Logic (similar to Bandit) ---
    let isPlayerInLOS = false;
    this.fov.compute(this.x, this.y, 10, (x, y, r, v) => {
      if (x === this.game.player.x && y === this.game.player.y && v > 0)
        isPlayerInLOS = true;
    });
    const playerIsVisible =
      isPlayerInLOS && this.game.player.combatStance !== "ducking";
    if (playerIsVisible) {
      this.lastKnownPlayerPosition = {
        x: this.game.player.x,
        y: this.game.player.y,
      };
    }

    const weapon = this.getEquippedWeapon();
    if (this.combatStance === "challenging" || this.combatStance === "aiming") {
      if (weapon && weapon.loaded > 0) {
        weapon.loaded--;
        window.sampler("revolver-shot-1", 0.5, {
          pan: window.calculatePanFromPosition(this, this.game.player, DISPLAY_WIDTH),
        });
        this.game.resolveShot(this, this._getAngleToPlayer());
        this.combatStance = this._isAdjacentToCover() ? "ducking" : "standing";
      } else {
        if (this._reloadWeapon()) {
          this.game.renderer.displayMessage(`${this.name} reloads!`);
        }
        this.combatStance = "standing";
      }
      return;
    }

    if (this.lastKnownPlayerPosition) {
      if (!weapon || weapon.loaded <= 0) {
        if (this._reloadWeapon()) {
          this.game.renderer.displayMessage(`${this.name} reloads!`);
          this.combatStance = "ducking";
        } else {
          // No ammo, maybe flee or just stand there for now
          this.combatStance = "standing";
        }
        return;
      }

      if (playerIsVisible) {
        this.combatStance = this._isAdjacentToCover()
          ? "challenging"
          : "aiming";
      } else {
        // Move towards last known position if player not visible
        this._moveTowards(this.lastKnownPlayerPosition);
      }
    }
  }

  _reloadWeapon() {
    const weapon = this.getEquippedWeapon();
    if (!weapon) return false;
    const ammoNeeded = weapon.capacity - weapon.loaded;
    if (ammoNeeded === 0) return false;

    const ammoPouch = this.inventory.find((i) => i.type === "ammo");
    if (!ammoPouch || ammoPouch.quantity <= 0) {
      return false;
    }
if(weapon.kind === "revolver"){
      window.sampler(`revolver-reload`, 0.5, {
          pan: window.calculatePanFromPosition(this, this.game.player, DISPLAY_WIDTH),
        });
    }
    const ammoToTransfer = Math.min(ammoNeeded, ammoPouch.quantity);
    weapon.loaded += ammoToTransfer;
    ammoPouch.quantity -= ammoToTransfer;

    return true;
  }

  _getAngleToPlayer() {
    const dx = this.game.player.x - this.x;
    const dy = this.game.player.y - this.y;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  _isAdjacentToCover() {
    const coverTypes = [
      TILE_TYPE.ROCK,
      TILE_TYPE.WALL,
      TILE_TYPE.CACTUS,
      TILE_TYPE.CACTUS_2,
      TILE_TYPE.CACTUS_3,
      TILE_TYPE.WATER_TROUGH,
      TILE_TYPE.CRATE,
      TILE_TYPE.BARREL,
      TILE_TYPE.SETTLEMENT_WALL,
    ];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const tile = this.game.world.getTileAt(this.x + dx, this.y + dy);
        if (coverTypes.includes(tile)) return true;
      }
    }
    return false;
  }

  _moveTowards(target) {
    const distanceToTarget = Math.hypot(this.x - target.x, this.y - target.y);
    if (distanceToTarget <= 5) {
      if (!this._isAdjacentToCover()) {
        this.combatStance = "standing";
      }
      return;
    }

    const passableCallback = (x, y) => {
      const tile = this.game.world.getTileAt(x, y);
      if (!terrainInfo[tile]?.isPassable) return false;
      if (x === target.x && y === target.y) return true;
      return !this.game.isTileOccupied(x, y, this);
    };
    const astar = new ROT.Path.AStar(target.x, target.y, passableCallback, {
      topology: 8,
    });
    const path = [];
    astar.compute(this.x, this.y, (x, y) => path.push({ x, y }));

    if (path.length > 1) {
      const nextStep = path[1];
      if (!this.game.isTileOccupied(nextStep.x, nextStep.y, this)) {
        this.x = nextStep.x;
        this.y = nextStep.y;
        this.combatStance = "standing";
      }
    }
  }
}
