import { terrainInfo } from "../terrain.js";
import { createItem } from '../items.js';
// --- NEW: BANDIT NAME GENERATOR ---
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

// LAST NAMES (Hard-sounding, descriptive, or famous outlaw surnames)
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

// EPITHETS (Based on skill, a notable kill, appearance, or vice)
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
    this.hp = 1.0;
    this.char = "Č";
    this.color = "#654321";
    this.isAiming = false;
    this.lastKnownPlayerPosition = null;
    this.baseSettlement = baseSettlement;

    // --- ASSIGN NAME ON CREATION ---
    this.name = generateBanditName();
    this.inventory = [
        createItem('revolver_rusty'),
        createItem('ammo_bullet', { quantity: Math.floor(Math.random() * 6) + 1 })
    ];
    if (Math.random() < 0.15) {
        this.inventory.push(createItem('can_of_beans'));
    }
    const lightPasses = (x, y) => {
      const tileChar = this.game.world.getTileAt(x, y);
      return terrainInfo[tileChar]?.isTransparent ?? false;
    };
    this.fov = new ROT.FOV.PreciseShadowcasting(lightPasses);
  }
getEquippedWeapon() {
      return this.inventory.find(i => i.type === 'weapon');
  }
  act() {
    if (this.game.player.hp <= 0) return;

    // 1. PERCEPTION
    let playerIsVisible = false;
    this.fov.compute(this.x, this.y, 8, (x, y, r, visibility) => {
      if (x === this.game.player.x && y === this.game.player.y) {
        playerIsVisible = true;
      }
    });

    if (playerIsVisible) {
      this.lastKnownPlayerPosition = { x: this.game.player.x, y: this.game.player.y };
    }

    // 2. DECISION MAKING
    const target = this.lastKnownPlayerPosition;
    
    if (target) {
      const distance = Math.hypot(this.x - target.x, this.y - target.y);
      const weapon = this.getEquippedWeapon();

      // UPDATED: Check for ammo before deciding to shoot
      if (playerIsVisible && distance <= 12 && weapon && weapon.loaded > 0) {
        if (this.isAiming) {
          this.isAiming = false;
          this.game.attack(this, this.game.player);
        } else {
          this.isAiming = true;
        }
        return;
      }

      // If not shooting, move towards the target
      this.isAiming = false;
      this._moveAlongPathTo(target);

      if (this.x === target.x && this.y === target.y) {
        this.lastKnownPlayerPosition = null;
      }
    } else {
      this.isAiming = false;
      this._pathfindToGoal();
    }
  }

  _moveAlongPathTo(target) {
    const passableCallback = (x, y) => {
        const tile = this.game.world.getTileAt(x, y);
        if (!terrainInfo[tile]?.isPassable) return false;
        
        // The target tile (e.g., player's position) should be considered passable for pathfinding.
        if (x === target.x && y === target.y) return true;

        // Don't path through other actors.
        return !this.game.isTileOccupied(x, y, this);
    };
    const astar = new ROT.Path.AStar(target.x, target.y, passableCallback, {topology: 8});
    const path = [];
    astar.compute(this.x, this.y, (x, y) => path.push({ x, y }));

    if (path.length > 1) {
        const nextStep = path[1];
        // Final check before moving to prevent collisions if actors move simultaneously.
        if (!this.game.isTileOccupied(nextStep.x, nextStep.y, this)) {
            this.x = nextStep.x;
            this.y = nextStep.y;
        }
    }
  }

  _pathfindToGoal() {
    const target = this.baseSettlement;

    if (target) {
      const distance = Math.hypot(this.x - target.x, this.y - target.y);
      if (distance > 200) {
          this._wanderRandomly();
          return;
      }
      // Pathfind towards the assigned base settlement
      this._moveAlongPathTo(target);
    } else {
      // No base settlement, so wander randomly
      this._wanderRandomly();
    }
  }

  _wanderRandomly() {
    const moves = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];
    const validMoves = [];

    for (const move of moves) {
      const newX = this.x + move[0];
      const newY = this.y + move[1];
      const tile = this.game.world.getTileAt(newX, newY);
      if (terrainInfo[tile]?.isPassable && !this.game.isTileOccupied(newX, newY, this)) {
        validMoves.push(move);
      }
    }

    if (validMoves.length > 0) {
      const randomMove =
        validMoves[Math.floor(Math.random() * validMoves.length)];
      this.x += randomMove[0];
      this.y += randomMove[1];
    }
  }

  isCorpse() {
    return this.hp <= 0;
  }
}
