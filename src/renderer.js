import {
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
  CHUNK_WIDTH,
  CHUNK_HEIGHT,
} from "./constants.js";
import { terrainInfo } from "./terrain.js";
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

    // --- NEW FOV PROPERTIES ---
    this.visibleTiles = new Set();
    this.exploredTiles = new Set();
    const lightPasses = (x, y) => {
      const tile = this.game.world.getTileAt(x, y);
      return tile !== "#" && tile !== "=";
    };
    this.fov = new ROT.FOV.PreciseShadowcasting(lightPasses);
  }

  drawAll() {
    // --- NEW: COMPUTE FOV BEFORE DRAWING ---
    this.visibleTiles.clear();
    const { x, y } = this.game.player;
    this.fov.compute(x, y, 10, (vx, vy, r, visibility) => {
      if (visibility > 0) {
        const key = `${vx},${vy}`;
        this.visibleTiles.add(key);
        this.exploredTiles.add(key);
      }
    });

    this.display.clear();
    this._drawMap();
    this._drawEntities();
    this.updateUI();
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

        // --- UPDATED DRAW LOGIC FOR FOV ---
        const isVisible = this.visibleTiles.has(key);
        const isExplored = this.exploredTiles.has(key);

        if (!isVisible && !isExplored) continue;

        const tile = world.getTileAt(worldX, worldY);
        const info = terrainInfo[tile];
        const pixelX = x * this.cellWidth;
        const pixelY = y * this.cellHeight;
        if (!info) continue; // Should not happen
        let fgColor = info.color;
        let bgColor = terrainInfo["."].color;

        if (!isVisible) {
          // It's explored, but not visible
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
        this.bgCtx.fillRect(pixelX, pixelY, this.cellWidth, this.cellHeight);

        if (tile !== ".") {
          this.bgCtx.fillStyle = fgColor;
          this.bgCtx.fillText(
            tile,
            pixelX + this.cellWidth / 2,
            pixelY + this.cellHeight / 2,
          );
        }
      }
    }
    this._drawSplatters(world, topLeftX, topLeftY);
  }

  _drawEntities() {
    const { player, enemies } = this.game;

    // Only draw enemies if they are visible
    enemies.forEach((enemy) => {
      const key = `${enemy.x},${enemy.y}`;
      if (this.visibleTiles.has(key)) {
        const screenPos = this._worldToScreen(
          enemy.x,
          enemy.y,
          player.x - Math.floor(DISPLAY_WIDTH / 2),
          player.y - Math.floor(DISPLAY_HEIGHT / 2),
        );
        if (screenPos)
          this.display.draw(screenPos.x, screenPos.y, enemy.char, enemy.color);
      }
    });

    this.display.draw(
      Math.floor(DISPLAY_WIDTH / 2),
      Math.floor(DISPLAY_HEIGHT / 2),
      "@",
      "#773300",
    );
  }

  _drawSplatters(world, topLeftX, topLeftY) {
    for (const chunkKey in world.effects) {
      for (const tileKey in world.effects[chunkKey]) {
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
          world.effects[chunkKey][tileKey].forEach((droplet) => {
            this.bgCtx.fillStyle = droplet.color;
            this.bgCtx.fillRect(
              originX + droplet.dx,
              originY + droplet.dy,
              droplet.size,
              droplet.size,
            );
          });
        }
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
      this._animateParticles();
      requestAnimationFrame(loop);
    };
    loop();
  }

  _drawAimLines() {
    const { player, enemies } = this.game;
    if (player.isAiming) {
      const rad = player.aimAngle * (Math.PI / 180);
      const aimVector = { x: Math.cos(rad), y: Math.sin(rad) };
      const line = this.game.getLine(
        player.x,
        player.y,
        Math.round(player.x + aimVector.x * 20),
        Math.round(player.y + aimVector.y * 20),
      );

      const finalPoint = line[line.length - 1];
      this._drawAimLineOnCanvas(
        null,
        finalPoint,
        "rgba(255, 255, 0, 0.5)",
        [5, 5],
      );
    }

    enemies.forEach((enemy) => {
      if (enemy.isAiming && !enemy.isCorpse()) {
        this._drawAimLineOnCanvas(enemy, player, "rgba(255, 0, 0, 0.3)", []);
      }
    });
  }

  _drawAimLineOnCanvas(startActor, endActorOrPoint, color, dash) {
    const topLeftX = this.game.player.x - Math.floor(DISPLAY_WIDTH / 2);
    const topLeftY = this.game.player.y - Math.floor(DISPLAY_HEIGHT / 2);

    const startScreen = startActor
      ? this._worldToScreen(startActor.x, startActor.y, topLeftX, topLeftY)
      : { x: DISPLAY_WIDTH / 2, y: DISPLAY_HEIGHT / 2 };

    // --- AIM LINE FIX ---
    // This check is now simpler and we calculate pixel coordinates directly
    // without culling the line if the endpoint is off-screen.
    if (startScreen && endActorOrPoint) {
      const startPixelX = startScreen.x * this.cellWidth + this.cellWidth / 2;
      const startPixelY = startScreen.y * this.cellHeight + this.cellHeight / 2;

      // Calculate screen coordinates for the endpoint without boundary checks
      const endScreenX = endActorOrPoint.x - topLeftX;
      const endScreenY = endActorOrPoint.y - topLeftY;

      const endPixelX = endScreenX * this.cellWidth + this.cellWidth / 2;
      const endPixelY = endScreenY * this.cellHeight + this.cellHeight / 2;

      this.particleCtx.beginPath();
      this.particleCtx.setLineDash(dash);
      this.particleCtx.moveTo(startPixelX, startPixelY);
      this.particleCtx.lineTo(endPixelX, endPixelY);
      this.particleCtx.strokeStyle = color;
      this.particleCtx.lineWidth = dash.length > 0 ? 2 : 1;
      this.particleCtx.stroke();
      this.particleCtx.setLineDash([]);
    }
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
    if (this.game.world.getTileAt(landingX, landingY) !== ".") return;

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
      this.messageTimeout = null;
    }, 4000); // Message disappears after 4 seconds
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
    const ui = document.getElementById("game-ui");
    const aimingText = player.isAiming ? " [AIMING]" : "";
    ui.textContent = `HP: ${player.hp}/10 | Ammo: ${player.ammo}/6${aimingText}`;
  }
}
