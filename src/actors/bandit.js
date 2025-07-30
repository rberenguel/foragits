// src/actors/bandit.js
import { terrainInfo, TILE_TYPE } from "../terrain.js";
import { createItem } from "../items.js";
// --- (Name generation code is unchanged) ---
const firstNames = [
  "Jed",
  "Silas",
  "Cletus",
  "Beau",
  "Otis",
  "Bartholomew",
  "Hank",
  "Gus",
  "Clay",
  "Wyatt",
  "Jesse",
  "Butch",
  "Josiah",
  "Levi",
  "Dutch",
  "Zeke",
  "Roscoe",
  "Rufus",
  "Amos",
  "Abel",
  "Malachi",
  "Phineas",
  "Virgil",
  "Doc",
  "Billy",
  "Jeb",
  "Floyd",
  "Luther",
  "Forrest",
  "Cole",
  "Wade",
  "Sterling",
  "Ike",
  "Elijah",
  "Finn",
];
const lastNames = [
  "Blackwood",
  "Stone",
  "Harkness",
  "McCoy",
  "Slade",
  "Kane",
  "Dalton",
  "Cassidy",
  "James",
  "Morgan",
  "Callahan",
  "Shaw",
  "Graves",
  "Cutter",
  "Reed",
  "Younger",
  "Grimm",
  "Thorne",
  "Flint",
  "Crow",
  "Garrett",
  "Hardin",
  "Hickok",
  "Ringo",
  "Carver",
  "Dunn",
  "Bishop",
  "Pike",
  "Brand",
  "Pickett",
  "Finch",
  "Hayes",
  "Barlow",
  "Cobb",
];
const epithets = [
  "'One-Eye'",
  "'Scar'",
  "'Dust-Devil'",
  "'Deadeye'",
  "'Whiskey'",
  "'Mad Dog'",
  "'The Kid'",
  "'Quickdraw'",
  "'Lefty'",
  "'Grizzly'",
  "'Three-Fingers'",
  "'Rattlesnake'",
  "'The Butcher'",
  "'Noose'",
  "'Two-Shot'",
];

function generateBanditName() {
  const hasEpithet = Math.random() < 0.3;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  if (hasEpithet) {
    const epithet = epithets[Math.floor(Math.random() * epithets.length)];
    return `${firstName} ${epithet} ${lastName}`;
  }
  return `${firstName} ${lastName}`;
}

export class Bandit {
  constructor(game, x, y, baseSettlement = null) {
    this.game = game;
    this.x = x;
    this.y = y;
    this.hp = 2.0;
    this.char = "Č";
    this.color = "#654321";
    this.lastKnownPlayerPosition = null;
    this.baseSettlement = baseSettlement;
    this.name = generateBanditName();
    this.aimError = 8;

    // --- NEW STATE MACHINE ---
    this.combatStance = "standing"; // 'standing', 'ducking', 'challenging'

    this.inventory = [
      createItem("revolver_rusty"),
      createItem("ammo_bullet", {
        quantity: Math.floor(Math.random() * 6) + 18,
      }),
      createItem("money", { quantity: Math.floor(Math.random() * 5) + 1 }),
    ];
    if (Math.random() < 0.15) {
      this.inventory.push(createItem("can_of_beans"));
    }
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
    this.combatStance = "standing"; // Getting hit forces you out of cover
    if (this.hp <= 0) {
      this.game.killEnemy(this);
    }
  }

  // src/actors/bandit.js

  act() {
    if (this.isCorpse() || this.game.player.hp <= 0) {
      return;
    }

    // --- 1. Perception (No change) ---
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

    // --- 2. Execute Committed Action or Reload ---
    const weapon = this.getEquippedWeapon();
    if (this.combatStance === "challenging" || this.combatStance === "aiming") {
      if (weapon && weapon.loaded > 0) {
        weapon.loaded--;
        this.game.resolveShot(this, this._getAngleToPlayer());
        this.combatStance = this._isAdjacentToCover() ? "ducking" : "standing";
      } else {
        // Was aiming but ran out of ammo, must reload or flee.
        if (this._reloadWeapon()) {
          this.game.renderer.displayMessage(`${this.name} reloads!`);
        }
        this.combatStance = "standing";
      }
      return; // Turn is over.
    }

    // --- 3. Decide Next Action ---
    if (this.lastKnownPlayerPosition) {
      // Check for ammo before engaging
      if (!weapon || weapon.loaded <= 0) {
        if (this._reloadWeapon()) {
          this.game.renderer.displayMessage(`${this.name} reloads!`);
          this.combatStance = "ducking"; // Reloading is safest in cover
        } else {
          // No ammo to reload, must flee.
          this.combatStance = "standing";
          this._pathfindToGoal();
        }
        return;
      }

      if (playerIsVisible) {
        this.combatStance = this._isAdjacentToCover()
          ? "challenging"
          : "aiming";
      } else {
        this.combatStance = "standing";
        this._moveTowards(this.lastKnownPlayerPosition);
      }
    } else {
      this.combatStance = "standing";
      this._pathfindToGoal();
    }
  }

  // --- NEW METHOD ---
  _reloadWeapon() {
    const weapon = this.getEquippedWeapon();
    if (!weapon) return false;

    const ammoNeeded = weapon.capacity - weapon.loaded;
    if (ammoNeeded === 0) return false;

    const ammoPouch = this.inventory.find((i) => i.type === "ammo");
    if (!ammoPouch || ammoPouch.quantity <= 0) {
      // Out of ammo entirely
      return false;
    }

    const ammoToTransfer = Math.min(ammoNeeded, ammoPouch.quantity);
    weapon.loaded += ammoToTransfer;
    ammoPouch.quantity -= ammoToTransfer;

    return true; // Successfully reloaded
  }

  respondToChallenge() {
    // This is the player-initiated path.
    // If the bandit is ducking, it decides whether to accept the Quickdraw.
    if (this.combatStance === "ducking" && Math.random() > 0.3) {
      this.combatStance = "challenging";
    }
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
      // TODO: Should be for all actors
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
    // --- THIS IS THE KEY CHANGE ---
    // Stop moving if we are already at a good distance (5 tiles or closer).
    if (distanceToTarget <= 5) {
      // If we're not in cover, we'll just hold our ground for a turn before re-evaluating.
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
    } else if (this.x === target.x && this.y === target.y) {
      this.lastKnownPlayerPosition = null;
    }
  }
  _pathfindToGoal() {
    // This logic for non-combat movement remains the same
    const target = this.baseSettlement;
    if (target && Math.hypot(this.x - target.x, this.y - target.y) < 200) {
      this._moveTowards(target);
    } else {
      this._wanderRandomly();
    }
  }

  _wanderRandomly() {
    const moves = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    const move = moves[Math.floor(Math.random() * moves.length)];
    const newX = this.x + move[0];
    const newY = this.y + move[1];
    const tile = this.game.world.getTileAt(newX, newY);
    if (
      terrainInfo[tile]?.isPassable &&
      !this.game.isTileOccupied(newX, newY, this)
    ) {
      this.x = newX;
      this.y = newY;
    }
  }

  isCorpse() {
    return this.hp <= 0;
  }
}
