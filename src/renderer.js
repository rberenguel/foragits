import {
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
  CHUNK_WIDTH,
  CHUNK_HEIGHT,
  SETTLEMENT_RADIUS,
} from "./constants.js";
import { terrainInfo, TILE_TYPE } from "./terrain.js";
import { Bandit } from "./actors/bandit.js";

export class Renderer {
  constructor(game) {
    this.game = game;
    this.display = new ROT.Display({
      width: DISPLAY_WIDTH,
      height: DISPLAY_HEIGHT,
      fontSize: 20,
      forceSquareRatio: true,
      bg: "transparent",
    });

    const gameContainer = document.getElementById("game-container");
    const rotCanvas = this.display.getContainer();
    rotCanvas.style.zIndex = "2";
    gameContainer.prepend(rotCanvas);
    gameContainer.style.width = `${rotCanvas.width}px`;
    gameContainer.style.height = `${rotCanvas.height}px`;

    this.backgroundCanvas = document.getElementById("background-canvas");
    this.particleCanvas = document.getElementById("particle-canvas");
    [this.backgroundCanvas.width, this.backgroundCanvas.height] = [
      rotCanvas.width,
      rotCanvas.height,
    ];
    [this.particleCanvas.width, this.particleCanvas.height] = [
      rotCanvas.width,
      rotCanvas.height,
    ];
    this.bgCtx = this.backgroundCanvas.getContext("2d");
    this.particleCtx = this.particleCanvas.getContext("2d");
    this.cellWidth = this.particleCanvas.width / DISPLAY_WIDTH;
    this.cellHeight = this.particleCanvas.height / DISPLAY_HEIGHT;
    this.particles = [];
    this.messageTimeout = null;
    this.visibleTiles = new Set();
    this.exploredTiles = new Set();

    // --- RE-IMPLEMENTED lightPasses with cover check ---
    const lightPasses = (x, y) => {
      const player = this.game.player;
      const tile = this.game.world.getTileAt(x, y);
      const info = terrainInfo[tile];

      if (player.combatStance === "ducking") {
        const dx = Math.abs(x - player.x);
        const dy = Math.abs(y - player.y);
        // Check if the tile is adjacent to the player
        if (dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0)) {
          const coverTypes = [
            TILE_TYPE.ROCK,
            TILE_TYPE.WALL,
            TILE_TYPE.CACTUS,
            TILE_TYPE.CACTUS_2,
            TILE_TYPE.CACTUS_3,
            TILE_TYPE.SETTLEMENT_WALL,
            TILE_TYPE.WATER_TROUGH,
            TILE_TYPE.CRATE,
            TILE_TYPE.BARREL,
          ];
          // If it's a cover tile, it blocks vision while ducking
          if (coverTypes.includes(tile)) {
            return false;
          }
        }
      }
      return info?.isTransparent ?? false;
    };
    this.fov = new ROT.FOV.PreciseShadowcasting(lightPasses);

    rotCanvas.addEventListener("click", (e) => {
      const player = this.game.player;
      const rect = rotCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (this.game.gameState === "info") {
        const tileX = Math.floor(clickX / this.cellWidth);
        const tileY = Math.floor(clickY / this.cellHeight);
        
        const topLeftX = player.x - Math.floor(DISPLAY_WIDTH / 2);
        const topLeftY = player.y - Math.floor(DISPLAY_HEIGHT / 2);

        this.game.infoCursor.x = topLeftX + tileX;
        this.game.infoCursor.y = topLeftY + tileY;
        
        return;
      }

      if (player.combatStance === "aiming" || player.combatStance === "challenging") {
        // --- AIMING LOGIC ---
        const playerScreenX = Math.floor(DISPLAY_WIDTH / 2);
        const playerScreenY = Math.floor(DISPLAY_HEIGHT / 2);
        const playerPixelX = playerScreenX * this.cellWidth + this.cellWidth / 2;
        const playerPixelY = playerScreenY * this.cellHeight + this.cellHeight / 2;
        const deltaX = clickX - playerPixelX;
        const deltaY = clickY - playerPixelY;
        let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        angle = Math.round(angle / 5) * 5; // Snap to nearest 5 degrees
        player.aimAngle = (angle + 360) % 360;
        this.drawAll(); // Redraw to show new aim line immediately
      } else {
        // --- MOVEMENT LOGIC ---
        const normalizedX = clickX / rect.width;
        const normalizedY = clickY / rect.height;
        const distX = Math.abs(normalizedX - 0.5);
        const distY = Math.abs(normalizedY - 0.5);

        // Dead zone in the center (40% of the screen)
        if (distX < 0.2 && distY < 0.2) {
          return;
        }

        let key;
        if (distX > distY) { // Prioritize horizontal movement
          if (normalizedX < 0.3) key = "ArrowLeft";
          else if (normalizedX > 0.7) key = "ArrowRight";
        } else { // Prioritize vertical movement
          if (normalizedY < 0.3) key = "ArrowUp";
          else if (normalizedY > 0.7) key = "ArrowDown";
        }

        if (key) {
          const event = new KeyboardEvent("keydown", { key: key });
          player.handleEvent(event);
        }
      }
    });
  }
  _drawShopScreen() {
    // Placeholder for shop UI
    this.display.clear();
    this.display.drawText(2, 1, "SHOP IS OPEN - WIP");
  }
  drawAll() {
    if (this.game.gameState === "inventory") {
      this._drawInventoryScreen();
      return;
    }
    if (this.game.gameState === "map") {
      this._drawMapScreen();
      return;
    }
    if (this.game.gameState === "shopping") {
      this._drawShopScreen();
      return;
    }

    const player = this.game.player;
    const currentlyVisibleEnemies = new Set();
    this.visibleTiles.clear();
    const fovRadius = player.combatStance === "ducking" ? 5.5 : 15.5; // Reduced vision when ducking

    this.fov.compute(player.x, player.y, fovRadius, (vx, vy, r, visibility) => {
      const distance = Math.hypot(vx - player.x, vy - player.y);
      if (visibility > 0 && distance <= fovRadius) {
        const key = `${vx},${vy}`;
        this.visibleTiles.add(key);
        this.exploredTiles.add(key);
      }
    });

    this.display.clear();
    this._drawMap();
    this._drawEntities(currentlyVisibleEnemies);
    // --- DELEGATE SIGHTING LOGIC TO MAIN.JS ---
    this.game.handleEnemySightings(currentlyVisibleEnemies);
    this.updateUI();
  }
  // --- NEW METHOD TO DRAW THE INVENTORY SCREEN ---
  _drawInventoryScreen() {
    this.display.clear();
    this.display.drawText(2, 1, "%c{#fff}%b{#333}--- INVENTORY ---");
    let y = 3;
    this.game.player.inventory.forEach((item, index) => {
      const letter = String.fromCharCode("a".charCodeAt(0) + index);
      let itemText = `${letter}) ${item.name}`;
      if (item.quantity) itemText += ` (x${item.quantity})`;
      if (item.equipped) itemText += " (equipped)";
      this.display.drawText(2, y, itemText);
      y++;
    });
    y += 2;
    this.display.drawText(2, y, `Money: $${this.game.player.money}`);
    const closeText = "([i] or [esc] to close)";
    this.display.drawText(
      DISPLAY_WIDTH - closeText.length - 1,
      DISPLAY_HEIGHT - 2,
      closeText,
    );
  }

  _drawMap() {
    const { player, world } = this.game;
    const topLeftX = player.x - Math.floor(DISPLAY_WIDTH / 2);
    const topLeftY = player.y - Math.floor(DISPLAY_HEIGHT / 2);
    this.bgCtx.clearRect(
      0,
      0,
      this.backgroundCanvas.width,
      this.backgroundCanvas.height,
    );
    this.bgCtx.font = `${this.display.getOptions().fontSize}px monospace`;
    this.bgCtx.textAlign = "center";
    this.bgCtx.textBaseline = "middle";

    for (let y = 0; y < DISPLAY_HEIGHT; y++) {
      for (let x = 0; x < DISPLAY_WIDTH; x++) {
        const worldX = topLeftX + x;
        const worldY = topLeftY + y;
        const key = `${worldX},${worldY}`;
        const isVisible = this.visibleTiles.has(key);
        const isExplored = this.exploredTiles.has(key);
        if (!isVisible && !isExplored) continue;
        const tile = world.getTileAt(worldX, worldY);
        const info = terrainInfo[tile];
        if (!info) continue;
        let fgColor = info.color;
        let bgColor = terrainInfo["."].color;
        if (!isVisible) {
          fgColor = ROT.Color.toRGB(
            ROT.Color.interpolate(
              ROT.Color.fromString(fgColor),
              [0, 0, 0],
              0.6,
            ),
          );
          bgColor = "#423e37";
        }
        this.bgCtx.fillStyle = bgColor;
        this.bgCtx.fillRect(
          x * this.cellWidth,
          y * this.cellHeight,
          this.cellWidth,
          this.cellHeight,
        );
        if (tile !== ".") {
          this.bgCtx.fillStyle = fgColor;
          this.bgCtx.fillText(
            tile,
            x * this.cellWidth + this.cellWidth / 2,
            y * this.cellHeight + this.cellHeight / 2,
          );
        }
      }
    }
    this._drawSplatters(world, topLeftX, topLeftY);
  }

  _drawEntities(currentlyVisibleEnemies) {
    const { player, enemies, npcs, world } = this.game;
    const topLeftX = player.x - Math.floor(DISPLAY_WIDTH / 2);
    const topLeftY = player.y - Math.floor(DISPLAY_HEIGHT / 2);

    for (const [key, items] of world.itemsOnGround.entries()) {
      if (this.visibleTiles.has(key) && items.length > 0) {
        const [x, y] = key.split(",").map(Number);
        const screenPos = this._worldToScreen(x, y, topLeftX, topLeftY);
        if (screenPos)
          this.display.draw(
            screenPos.x,
            screenPos.y,
            items[0].char,
            items[0].color,
          );
      }
    }
    const allActors = [...enemies, ...npcs];
    allActors.forEach((actor) => {
      const isVisible = this.visibleTiles.has(`${actor.x},${actor.y}`);
      if (isVisible) {
        if (actor instanceof Bandit && currentlyVisibleEnemies)
          currentlyVisibleEnemies.add(actor);
        const screenPos = this._worldToScreen(
          actor.x,
          actor.y,
          topLeftX,
          topLeftY,
        );
        if (screenPos)
          this.display.draw(screenPos.x, screenPos.y, actor.char, actor.color);
      }
    });
    this.display.draw(
      Math.floor(DISPLAY_WIDTH / 2),
      Math.floor(DISPLAY_HEIGHT / 2),
      player.char,
      player.color,
    );
  }

  _drawSplatters(world, topLeftX, topLeftY) {
    const LIFESPAN = 1000;
    const DARK_AGE = 300;
    const FADE_AGE = 700;

    // Use for...of for easier modification/deletion
    for (const chunkKey of Object.keys(world.effects)) {
      for (const tileKey of Object.keys(world.effects[chunkKey])) {
        const droplets = world.effects[chunkKey][tileKey];

        // 1. Filter out expired droplets (garbage collection)
        const remainingDroplets = droplets.filter(
          (d) => this.game.turn - d.createdAt < LIFESPAN,
        );
        if (remainingDroplets.length === 0) {
          delete world.effects[chunkKey][tileKey];
          continue; // Move to the next tileKey
        }
        world.effects[chunkKey][tileKey] = remainingDroplets;

        // 2. Draw the remaining droplets with aged colors
        const [chunkX, chunkY] = chunkKey.split(",").map(Number);
        const [localX, localY] = tileKey.split(",").map(Number);
        const worldX = chunkX * CHUNK_WIDTH + localX;
        const worldY = chunkY * CHUNK_HEIGHT + localY;
        const screenPos = this._worldToScreen(
          worldX,
          worldY,
          topLeftX,
          topLeftY,
        );

        if (screenPos) {
          const originX = screenPos.x * this.cellWidth + this.cellWidth / 2;
          const originY = screenPos.y * this.cellHeight + this.cellHeight / 2;

          for (const droplet of remainingDroplets) {
            const age = this.game.turn - droplet.createdAt;
            let color = droplet.color;

            if (age >= FADE_AGE) {
              // Phase 3: Fading
              const baseColor = ROT.Color.fromString(color);
              const darkColor = ROT.Color.interpolate(
                baseColor,
                [0, 0, 0],
                0.5,
              );
              const alpha = 1.0 - (age - FADE_AGE) / (LIFESPAN - FADE_AGE);
              color = `rgba(${darkColor.join(",")},${alpha})`;
            } else if (age >= DARK_AGE) {
              // Phase 2: Darkened
              const baseColor = ROT.Color.fromString(color);
              const darkening = (age - DARK_AGE) / (LIFESPAN - DARK_AGE);
              const darkColor = ROT.Color.interpolate(
                baseColor,
                [0, 0, 0],
                darkening,
              );
              color = ROT.Color.toRGB(darkColor);
            }
            // Phase 1 (age < DARK_AGE) uses the original color

            this.bgCtx.fillStyle = color;
            this.bgCtx.fillRect(
              originX + droplet.dx,
              originY + droplet.dy,
              droplet.size,
              droplet.size,
            );
          }
        }
      }
      // Clean up empty chunk keys
      if (Object.keys(world.effects[chunkKey]).length === 0) {
        delete world.effects[chunkKey];
      }
    }
  }

  startAnimationLoop() {
    const loop = () => {
      this.particleCtx.clearRect(
        0,
        0,
        this.particleCanvas.width,
        this.particleCanvas.height,
      );
      this._drawAimLines();
      if (this.game.gameState === "info") {
        this._drawInfoCursor();
      }
      this._animateParticles();
      requestAnimationFrame(loop);
    };
    loop();
  }

  _drawInfoCursor() {
    const { infoCursor } = this.game;
    if (!infoCursor) return;

    const player = this.game.player;
    const topLeftX = player.x - Math.floor(DISPLAY_WIDTH / 2);
    const topLeftY = player.y - Math.floor(DISPLAY_HEIGHT / 2);

    const screenPos = this._worldToScreen(infoCursor.x, infoCursor.y, topLeftX, topLeftY);

    if (screenPos) {
        const x = screenPos.x * this.cellWidth;
        const y = screenPos.y * this.cellHeight;
        this.particleCtx.strokeStyle = '#FFFF00';
        this.particleCtx.lineWidth = 2;
        this.particleCtx.strokeRect(x, y, this.cellWidth, this.cellHeight);

        const infoText = this._getInfoForTile(infoCursor.x, infoCursor.y);
        this.displayMessage(infoText);
    } else {
        this.displayMessage("Cursor is outside the visible area.");
    }
  }

  _getInfoForTile(x, y) {
    const key = `${x},${y}`;
    if (!this.visibleTiles.has(key) && !this.exploredTiles.has(key)) {
      return "You don't know what is there.";
    }

    // Check for actors
    const actors = [this.game.player, ...this.game.enemies, ...this.game.npcs];
    const actor = actors.find(a => a.x === x && a.y === y && !a.isCorpse());
    if (actor) {
      return `You see ${actor.name}.`;
    }
    const corpse = actors.find(a => a.x === x && a.y === y && a.isCorpse());
    if (corpse) {
        return `The corpse of ${corpse.name}.`;
    }

    // Check for items
    const items = this.game.world.itemsOnGround.get(key);
    if (items && items.length > 0) {
      return `You see ${items.map(i => i.name).join(", ")}.`;
    }

    // Check for terrain
    const tile = this.game.world.getTileAt(x, y);
    const info = terrainInfo[tile];
    if (info) {
      return `You see ${info.name}.`;
    }

    return "You see nothing special.";
  }

  _drawAimLines() {
    // --- ROBUST AIM LINE LOGIC ---
    const actors = [this.game.player, ...this.game.enemies];
    actors.forEach((actor) => {
      if (
        (actor.combatStance === "challenging" ||
          actor.combatStance === "aiming") &&
        !actor.isCorpse()
      ) {
        // Check hp > 0
        const angle = actor._getAngleToPlayer(); // Use the standardized method
        const rad = angle * (Math.PI / 180);
        const aimVector = { x: Math.cos(rad), y: Math.sin(rad) };
        const endPoint = {
          x: Math.round(actor.x + aimVector.x * 20),
          y: Math.round(actor.y + aimVector.y * 20),
        };
        const color =
          actor instanceof this.game.player.constructor
            ? "rgba(255, 255, 0, 0.5)"
            : "rgba(255, 0, 0, 0.4)";
        this._drawAimLineOnCanvas(
          actor,
          endPoint,
          color,
          actor === this.game.player ? [5, 5] : [],
        );
      }
    });
  }

  _drawMapScreen() {
    this.display.clear();
    this.bgCtx.clearRect(
      0,
      0,
      this.backgroundCanvas.width,
      this.backgroundCanvas.height,
    );

    this.display.drawText(2, 1, "%c{#fff}%b{#333}--- WORLD MAP ---");

    const player = this.game.player;
    const centerX = Math.floor(DISPLAY_WIDTH / 2);
    const centerY = Math.floor(DISPLAY_HEIGHT / 2);
    const zoom = 4; // Each map character represents a 4x4 area
    const drawnCoords = new Set();

    // Draw explored tiles
    for (const coord of this.exploredTiles) {
      const [worldX, worldY] = coord.split(",").map(Number);
      const relX = worldX - player.x;
      const relY = worldY - player.y;

      const mapX = centerX + Math.floor(relX / zoom);
      const mapY = centerY + Math.floor(relY / zoom);

      const mapKey = `${mapX},${mapY}`;
      if (drawnCoords.has(mapKey)) continue;

      if (
        mapX >= 0 &&
        mapX < DISPLAY_WIDTH &&
        mapY >= 0 &&
        mapY < DISPLAY_HEIGHT
      ) {
        const tileChar = this.game.world.getTileAt(worldX, worldY);
        const info = terrainInfo[tileChar];

        let char = "·";
        let color = "#555";

        // --- UPDATED LOGIC TO HIGHLIGHT SETTLEMENTS ---
        if (tileChar === TILE_TYPE.FIRE_PIT_INACTIVE) {
          char = "~";
          color = "#ff6600"; // Orange for fire pit
        } else if (this.game.world.isSettlementTile(worldX, worldY)) {
          color = "#a39a78"; // Tan color for settlement areas
          char = !info.isPassable ? "#" : "░";
        } else if (!info.isPassable) {
          char = "#";
        }

        this.display.draw(mapX, mapY, char, color);
        drawnCoords.add(mapKey);
      }
    }

    // Draw player on top
    this.display.draw(centerX, centerY, "@", "#ffc107"); // Bright yellow player icon

    const closeText = "([m] or [esc] to close)";
    this.display.drawText(
      DISPLAY_WIDTH - closeText.length - 1,
      DISPLAY_HEIGHT - 2,
      closeText,
    );
  }
  _drawAimLineOnCanvas(startActor, endActorOrPoint, color, dash) {
    const topLeftX = this.game.player.x - Math.floor(DISPLAY_WIDTH / 2);
    const topLeftY = this.game.player.y - Math.floor(DISPLAY_HEIGHT / 2);
    const startScreen = this._worldToScreen(
      startActor.x,
      startActor.y,
      topLeftX,
      topLeftY,
    );
    if (!startScreen) return;
    const startPixelX = startScreen.x * this.cellWidth + this.cellWidth / 2;
    const startPixelY = startScreen.y * this.cellHeight + this.cellHeight / 2;
    const endScreenX = endActorOrPoint.x - topLeftX;
    const endScreenY = endActorOrPoint.y - topLeftY;
    const endPixelX = endScreenX * this.cellWidth + this.cellWidth / 2;
    const endPixelY = endScreenY * this.cellHeight + this.cellHeight / 2;

    this.particleCtx.beginPath();
    this.particleCtx.setLineDash(dash);
    this.particleCtx.moveTo(startPixelX, startPixelY);
    this.particleCtx.lineTo(endPixelX, endPixelY);
    this.particleCtx.strokeStyle = color;
    this.particleCtx.lineWidth = 2;
    this.particleCtx.stroke();
    this.particleCtx.setLineDash([]);
  }

  _animateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.lifespan--;
      if (p.lifespan <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      this.particleCtx.fillStyle = p.color;
      this.particleCtx.fillRect(p.x, p.y, p.size, p.size);
    }
  }

  _worldToScreen(worldX, worldY, topLeftX, topLeftY) {
    const screenX = worldX - topLeftX;
    const screenY = worldY - topLeftY;
    if (
      screenX < 0 ||
      screenX >= DISPLAY_WIDTH ||
      screenY < 0 ||
      screenY >= DISPLAY_HEIGHT
    )
      return null;
    return { x: screenX, y: screenY };
  }

  createRicochetEffect(worldX, worldY, shotVector) {
    const screenPos = this._worldToScreen(
      worldX,
      worldY,
      this.game.player.x - Math.floor(DISPLAY_WIDTH / 2),
      this.game.player.y - Math.floor(DISPLAY_HEIGHT / 2),
    );
    if (!screenPos) return;

    const originX = screenPos.x * this.cellWidth + this.cellWidth / 2;
    const originY = screenPos.y * this.cellHeight + this.cellHeight / 2;
    const baseAngle = Math.atan2(-shotVector.y, -shotVector.x);

    for (let i = 0; i < 15; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * (Math.PI / 2);
      const speed = Math.random() * 2 + 0.5;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifespan: Math.random() * 20 + 15,
        color: ["#8B4513", "#A0522D", "#696969"][Math.floor(Math.random() * 3)],
        size: Math.random() * 2 + 1,
      });
    }
  }

  createSplatterEffect(worldX, worldY, shotVector, type, particleCount) {
    const landingX =
      type === "corpse"
        ? worldX
        : worldX + Math.round(shotVector.x * (Math.random() * 1.5 + 1));
    const landingY =
      type === "corpse"
        ? worldY
        : worldY + Math.round(shotVector.y * (Math.random() * 1.5 + 1));
    //if (this.game.world.getTileAt(landingX, landingY) !== ".") return;

    const chunkX = Math.floor(landingX / CHUNK_WIDTH);
    const chunkY = Math.floor(landingY / CHUNK_HEIGHT);
    const chunkKey = `${chunkX},${chunkY}`;
    if (!this.game.world.effects[chunkKey])
      this.game.world.effects[chunkKey] = {};
    const localX = ((landingX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const localY = ((landingY % CHUNK_HEIGHT) + CHUNK_HEIGHT) % CHUNK_HEIGHT;
    const tileKey = `${localX},${localY}`;

    const colors =
      type === "blood" || type === "corpse"
        ? ["#8B0000", "#DC143C", "#B22222"]
        : ["#2E8B57", "#3CB371", "#006400"];
    const droplets = this.game.world.effects[chunkKey][tileKey] || [];
    for (let i = 0; i < particleCount; i++) {
      droplets.push({
        dx: (Math.random() - 0.5) * this.cellWidth,
        dy: (Math.random() - 0.5) * this.cellHeight,
        size: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        createdAt: this.game.turn,
      });
    }
    this.game.world.effects[chunkKey][tileKey] = droplets;
  }

  displayMessage(message) {
    const log = document.getElementById("message-log");
    log.textContent = message;
    if (this.messageTimeout) clearTimeout(this.messageTimeout);
    this.messageTimeout = setTimeout(() => {
      log.textContent = "";
    }, 4000);
  }
  flashScreen() {
    const flash = document.getElementById("flash-overlay");
    flash.style.display = "block";
    setTimeout(() => {
      flash.style.display = "none";
    }, 100);
  }

  updateUI() {
    const { player } = this.game;
    const weapon = player.getEquippedWeapon();
    const ammoText = weapon ? `${weapon.loaded}/${weapon.capacity}` : "N/A";
    const ui = document.getElementById("game-ui");
    // --- UPDATED to show stance ---
    const stanceText = `[${player.combatStance.toUpperCase()}]`;
    ui.textContent = `HP: ${player.hp}/10 | Ammo: ${ammoText} | ${stanceText}`;
  }
}