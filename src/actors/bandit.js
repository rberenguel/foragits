import { terrainInfo } from "../terrain.js";

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

    const lightPasses = (x, y) => {
      const tileChar = this.game.world.getTileAt(x, y);
      return terrainInfo[tileChar]?.isTransparent ?? false;
    };
    this.fov = new ROT.FOV.PreciseShadowcasting(lightPasses);
  }

  act() {
    if (this.game.player.hp <= 0) return; // Player is dead, do nothing.

    // 1. PERCEPTION: Can I see the player right now?
    let playerIsVisible = false;
    this.fov.compute(this.x, this.y, 8, (x, y, r, visibility) => {
      if (x === this.game.player.x && y === this.game.player.y) {
        playerIsVisible = true;
      }
    });

    if (playerIsVisible) {
      this.lastKnownPlayerPosition = {
        x: this.game.player.x,
        y: this.game.player.y,
      };
    }

    // 2. DECISION MAKING
    const target = this.lastKnownPlayerPosition;

    // A. If I have a target (current or previous)
    if (target) {
      const distance = Math.hypot(this.x - target.x, this.y - target.y);

      // A.1: Try to shoot if the player is currently visible and close enough
      if (playerIsVisible && distance <= 12) {
        this.isAiming = true; // For now, just aim. Next turn, we can shoot.
        return; // Aiming is a full turn action
      }

      // A.2: If not shooting, move towards the target
      this.isAiming = false; // Can't aim and move
      const passableCallback = (x, y) => {
        const tile = this.game.world.getTileAt(x, y);
        return terrainInfo[tile]?.isPassable ?? false;
      };
      const astar = new ROT.Path.AStar(target.x, target.y, passableCallback);
      const path = [];
      astar.compute(this.x, this.y, (x, y) => path.push({ x, y }));

      if (path.length > 1) {
        this.x = path[1].x;
        this.y = path[1].y;
      }

      // If I've reached my target destination, forget about it.
      if (this.x === target.x && this.y === target.y) {
        this.lastKnownPlayerPosition = null;
      }
    }
    // B. If I have no target, just wander
    else {
      this.isAiming = false;
      this._pathfindToGoal();
    }
  }

  _pathfindToGoal() {
    const target = this.baseSettlement;

    if (target) {
      // Pathfind towards the assigned base settlement
      const passableCallback = (x, y) =>
        terrainInfo[this.game.world.getTileAt(x, y)]?.isPassable ?? false;
      const astar = new ROT.Path.AStar(target.x, target.y, passableCallback);
      const path = [];
      astar.compute(this.x, this.y, (x, y) => path.push({ x, y }));
      if (path.length > 1) {
        this.x = path[1].x;
        this.y = path[1].y;
      }
    } else {
      // No base settlement, so wander randomly
      this._wanderRandomly();
    }
  }

  _wander() {
    const moves = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    const validMoves = [];

    for (const move of moves) {
      const newX = this.x + move[0];
      const newY = this.y + move[1];
      const tile = this.game.world.getTileAt(newX, newY);
      if (terrainInfo[tile]?.isPassable) {
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
