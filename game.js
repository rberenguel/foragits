const Game = {
  display: null,
  chunks: {},
  player: null,
  engine: null,
  scheduler: null,
  // At the top of the Game object
  particles: [],
  enemies: [],
  particleCanvas: null,
  particleCtx: null,
  effects: {},
  cellWidth: 0, // Add this
  cellHeight: 0, // Add this

  DISPLAY_WIDTH: 80,
  DISPLAY_HEIGHT: 40,
  CHUNK_WIDTH: 32,
  CHUNK_HEIGHT: 32,
  // in game.js
  _spawnEnemy: function () {
    // Find a random, empty, on-screen starting position
    let x, y;
    do {
      x =
        this.player.x + Math.floor((Math.random() - 0.5) * this.DISPLAY_WIDTH);
      y =
        this.player.y + Math.floor((Math.random() - 0.5) * this.DISPLAY_HEIGHT);
    } while (this._getTileAt(x, y) !== ".");

    const enemy = {
      x: x,
      y: y,
      hp: 1.0,
      char: "Č",
      color: "#654321", // Dark Brown
      game: this, // Give enemy a reference to the main game object

      act: function () {
        const player = this.game.player;

        // A* pathfinding
        const passableCallback = (x, y) => this.game._getTileAt(x, y) === ".";
        const astar = new ROT.Path.AStar(player.x, player.y, passableCallback, {
          topology: 8,
        });

        const path = [];
        astar.compute(this.x, this.y, (x, y) => {
          path.push({ x, y });
        });

        if (path.length > 1) {
          // Move to the first step on the path towards the player
          this.x = path[1].x;
          this.y = path[1].y;
        }
      },
    };
    this.enemies.push(enemy);
    this.scheduler.add(enemy, true);
  },
// in game.js
init: function() {
    this.display = new ROT.Display({ 
        width: this.DISPLAY_WIDTH, 
        height: this.DISPLAY_HEIGHT, 
        fontSize: 20,
        forceSquareRatio: true
    });
    const gameContainer = document.getElementById("game-container");
    const rotCanvas = this.display.getContainer();
    rotCanvas.style.zIndex = "1";
    gameContainer.prepend(rotCanvas);
    gameContainer.style.width = `${rotCanvas.width}px`;
    gameContainer.style.height = `${rotCanvas.height}px`;
    this.particleCanvas = document.getElementById("particle-canvas");
    this.particleCanvas.width = rotCanvas.width;
    this.particleCanvas.height = rotCanvas.height;
    this.particleCtx = this.particleCanvas.getContext("2d");
    this.cellWidth = this.particleCanvas.width / this.DISPLAY_WIDTH;
    this.cellHeight = this.particleCanvas.height / this.DISPLAY_HEIGHT;

    this.player = { 
        x: 0, y: 0, ammo: 6,
        isAiming: false, aimAngle: 0
    };

    // MOVED UP: Initialize the scheduler and engine first
    this.scheduler = new ROT.Scheduler.Simple();
    this.scheduler.add(this, true);
    this.engine = new ROT.Engine(this.scheduler);

    // NOW spawn the enemies, which adds them to the scheduler
    for (let i = 0; i < 5; i++) { this._spawnEnemy(); }

    this._drawAll();
    this._updateUI();
    
    // Start the game loop and animation loop
    this.engine.start();
    this._animationLoop();
},

  act: function () {
    this.engine.lock();
    window.addEventListener("keydown", this);
  },

  handleEvent: function (e) {
    e.preventDefault();
    const code = e.keyCode;

    // --- AIMING TOGGLE ---
    if (code === ROT.KEYS.VK_A) {
      this.player.isAiming = !this.player.isAiming;
      this._drawAll(); // Redraw to show/hide aim line
      return; // Does not consume a turn
    }

    if (this.player.isAiming) {
      this._handleAimingInput(code);
    } else {
      this._handleMovementInput(code);
    }
  },

  // In game.js
  _handleAimingInput: function (code) {
    if (code === ROT.KEYS.VK_F) {
      this._fireShot();
      return;
    }

    let change = 0;
    if (code === ROT.KEYS.VK_LEFT) {
      change = -15;
    }
    if (code === ROT.KEYS.VK_RIGHT) {
      change = 15;
    }

    if (change !== 0) {
      this.player.aimAngle = (this.player.aimAngle + change + 360) % 360;
      this._drawAll();
    }
  },

// in game.js
_fireShot: function() {
    if (this.player.ammo <= 0) { return; }
    
    this.player.ammo--;
    const p = this.player;
    const rad = p.aimAngle * (Math.PI / 180);
    const aimVector = { x: Math.cos(rad), y: Math.sin(rad) };

    const maxRange = 20;
    const endX = Math.round(p.x + aimVector.x * maxRange);
    const endY = Math.round(p.y + aimVector.y * maxRange);
    const line = this._getLine(p.x, p.y, endX, endY);

    for (let i = 1; i < line.length; i++) {
        const point = line[i];
        
        const enemy = this.enemies.find(e => e.x === point.x && e.y === point.y && e.hp > 0);
        if (enemy) {
            const damage = Math.random() * 0.6 + 0.5;
            enemy.hp -= damage;
            
            // More particles for closer enemies
            const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
            const particleCount = Math.max(5, Math.floor(25 - distance));
            this._createSplatterEffect(enemy.x, enemy.y, aimVector, 'blood', particleCount);

            if (enemy.hp <= 0) {
                this._killEnemy(enemy);
            }
            break;
        }

        const tile = this._getTileAt(point.x, point.y);
        if (tile === '#') {
            this._createRicochetEffect(point.x, point.y, aimVector);
            break;
        }
        if (tile === '🌵') {
            this._createSplatterEffect(point.x, point.y, aimVector, 'cactus', 10);
            break;
        }
    }
    
    this.player.isAiming = false;
    this._drawAll(); // FIXED: Redraw the screen immediately
    this._updateUI();
    window.removeEventListener("keydown", this);
    this.engine.unlock();
},

// in game.js
_createSplatterEffect: function(worldX, worldY, shotVector, type, particleCount) {
    let landingX, landingY;
    
    if (type === 'corpse') {
        // Corpse blood pool forms directly on the tile
        landingX = worldX;
        landingY = worldY;
    } else {
        // Other splatters land behind the target
        landingX = worldX + Math.round(shotVector.x * (Math.random() * 1.5 + 1));
        landingY = worldY + Math.round(shotVector.y * (Math.random() * 1.5 + 1));
    }

    if (this._getTileAt(landingX, landingY) !== '.') { return; }
    
    const chunkX = Math.floor(landingX / this.CHUNK_WIDTH);
    const chunkY = Math.floor(landingY / this.CHUNK_HEIGHT);
    const chunkKey = `${chunkX},${chunkY}`;
    if (!this.effects[chunkKey]) { this.effects[chunkKey] = {}; }

    const localX = (landingX % this.CHUNK_WIDTH + this.CHUNK_WIDTH) % this.CHUNK_WIDTH;
    const localY = (landingY % this.CHUNK_HEIGHT + this.CHUNK_HEIGHT) % this.CHUNK_HEIGHT;
    const tileKey = `${localX},${localY}`;

    const colors = type === 'blood' || type === 'corpse'
        ? ["#8B0000", "#DC143C", "#B22222"]
        : ["#2E8B57", "#3CB371", "#006400"];

    const droplets = this.effects[chunkKey][tileKey] || [];
    for (let i = 0; i < particleCount; i++) {
        droplets.push({
            dx: (Math.random() - 0.5) * this.cellWidth,
            dy: (Math.random() - 0.5) * this.cellHeight,
            size: Math.random() * 2 + 1,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
    this.effects[chunkKey][tileKey] = droplets;
},

 _handleMovementInput: function(code) {
    const keyMap = {
        [ROT.KEYS.VK_UP]:    {x: 0, y: -1},
        [ROT.KEYS.VK_DOWN]:  {x: 0, y: 1},
        [ROT.KEYS.VK_LEFT]:  {x: -1, y: 0},
        [ROT.KEYS.VK_RIGHT]: {x: 1, y: 0}
    };
    if (!(code in keyMap)) { return; }

    const diff = keyMap[code];
    const newX = this.player.x + diff.x;
    const newY = this.player.y + diff.y;

    // Check for corpse to loot before moving
    const targetEnemy = this.enemies.find(e => e.x === newX && e.y === newY);
    if (targetEnemy && targetEnemy.char === '†' && !targetEnemy.looted) {
        this.player.ammo = Math.min(6, this.player.ammo + 2); // Add 2 ammo, cap at 6
        targetEnemy.looted = true;
        targetEnemy.color = '#4a0101'; // Make corpse a duller red
    }

    const tile = this._getTileAt(newX, newY);
    if (tile === '#' || tile === '🌵') { return; }
    
    this.player.x = newX;
    this.player.y = newY;
    
    window.removeEventListener("keydown", this);
    this.engine.unlock();
    
    this._drawAll();
    this._updateUI();
},

  // ... (rest of the functions like _getTileAt, _generateChunk, etc. remain the same)

  _getTileAt: function (worldX, worldY) {
    const chunkX = Math.floor(worldX / this.CHUNK_WIDTH);
    const chunkY = Math.floor(worldY / this.CHUNK_HEIGHT);
    const localX =
      ((worldX % this.CHUNK_WIDTH) + this.CHUNK_WIDTH) % this.CHUNK_WIDTH;
    const localY =
      ((worldY % this.CHUNK_HEIGHT) + this.CHUNK_HEIGHT) % this.CHUNK_HEIGHT;
    const chunkKey = `${chunkX},${chunkY}`;
    if (!this.chunks[chunkKey]) {
      this._generateChunk(chunkX, chunkY);
    }
    return this.chunks[chunkKey][`${localX},${localY}`];
  },
  _generateChunk: function (chunkX, chunkY) {
    const key = `${chunkX},${chunkY}`;
    this.chunks[key] = {};
    const seed = chunkX * 10007 + chunkY * 30011;
    ROT.RNG.setSeed(seed);
    const cellular = new ROT.Map.Cellular(this.CHUNK_WIDTH, this.CHUNK_HEIGHT, {
      connected: true,
    });
    cellular.randomize(0.45);
    for (let i = 0; i < 4; i++) {
      cellular.create();
    }
    cellular.create((x, y, value) => {
      const tileKey = `${x},${y}`;
      this.chunks[key][tileKey] = value
        ? "#"
        : ROT.RNG.getUniform() < 0.02
          ? "🌵"
          : ".";
    });
  },
  _updateUI: function () {
    const ui = document.getElementById("game-ui");
    const aimingText = this.player.isAiming ? " [AIMING]" : "";
    ui.textContent = `Ammo: ${this.player.ammo}/6${aimingText}`;
  },
  _worldToScreen: function (worldX, worldY) {
    const topLeftX = this.player.x - Math.floor(this.DISPLAY_WIDTH / 2);
    const topLeftY = this.player.y - Math.floor(this.DISPLAY_HEIGHT / 2);
    const screenX = worldX - topLeftX;
    const screenY = worldY - topLeftY;
    if (
      screenX < 0 ||
      screenX >= this.DISPLAY_WIDTH ||
      screenY < 0 ||
      screenY >= this.DISPLAY_HEIGHT
    ) {
      return null; // Off-screen
    }
    return { x: screenX, y: screenY };
  },
  _drawAll: function () {
    this.display.clear();
    this._drawMap();
    this._drawEntities();
    this._updateUI(); // Also update UI on draw
  },
  _drawEntities: function () {
    // Draw enemies first
    this.enemies.forEach((enemy) => {
      const screenPos = this._worldToScreen(enemy.x, enemy.y);
      if (screenPos) {
        this.display.draw(
          screenPos.x,
          screenPos.y,
          enemy.char,
          enemy.color,
          "#D2B48C",
        );
      }
    });

    // Draw player on top
    const centerX = Math.floor(this.DISPLAY_WIDTH / 2);
    const centerY = Math.floor(this.DISPLAY_HEIGHT / 2);
    this.display.draw(centerX, centerY, "@", "#FFD700", "#D2B48C");
  },
  _getLine: function (x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      points.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) {
        break;
      }
      const e2 = 2 * err;
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
  },

  _createImpactEffect: function (worldX, worldY, tileType) {
    const screenPos = this._worldToScreen(worldX, worldY);
    if (!screenPos) {
      return;
    }

    // FIXED: Manually calculate the pixel position
    const originX = screenPos.x * this.cellWidth + this.cellWidth / 2;
    const originY = screenPos.y * this.cellHeight + this.cellHeight / 2;

    let particleCount, colors, speed;

    if (tileType === "#") {
      // Rock Impact 🪨
      particleCount = 20;
      colors = ["#8B4513", "#A0522D", "#696969", "#D2691E"];
      speed = Math.random() * 2 + 0.5;
    } else {
      // Cactus Impact 🌵
      particleCount = 10;
      colors = ["#2E8B57", "#3CB371", "#006400"];
      speed = Math.random() * 1.5 + 0.5;
    }

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const currentSpeed = speed * (1 - i / particleCount);
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * currentSpeed,
        vy: Math.sin(angle) * currentSpeed,
        lifespan: Math.random() * 30 + 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 2 + 1.5,
      });
    }
  },
  // in game.js
  _createRicochetEffect: function (worldX, worldY, shotVector) {
    const screenPos = this._worldToScreen(worldX, worldY);
    if (!screenPos) {
      return;
    }

    // CORRECTED: Manually calculate the pixel position
    const originX = screenPos.x * this.cellWidth + this.cellWidth / 2;
    const originY = screenPos.y * this.cellHeight + this.cellHeight / 2;

    const particleCount = 15;
    const colors = ["#8B4513", "#A0522D", "#696969"];

    // Reverse the shot vector for the ricochet
    const baseAngle = Math.atan2(-shotVector.y, -shotVector.x);

    for (let i = 0; i < particleCount; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * (Math.PI / 2); // 90-degree cone
      const speed = Math.random() * 2 + 0.5;
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifespan: Math.random() * 20 + 15,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 2 + 1,
      });
    }
  },

  // in game.js
  _animationLoop: function () {
    this.particleCtx.clearRect(
      0,
      0,
      this.particleCanvas.width,
      this.particleCanvas.height,
    );

    // --- 1. DRAW AIM LINE (if aiming) ---
    if (this.player.isAiming) {
      // Find the line's end point, stopping at obstacles
      const p = this.player;
      const rad = p.aimAngle * (Math.PI / 180);
      const aimVector = { x: Math.cos(rad), y: Math.sin(rad) };
      const maxRange = 20;
      const endX = Math.round(p.x + aimVector.x * maxRange);
      const endY = Math.round(p.y + aimVector.y * maxRange);
      const line = this._getLine(p.x, p.y, endX, endY);

      let finalPoint = line[line.length - 1];
      for (let i = 1; i < line.length; i++) {
        const point = line[i];
        if (this._getTileAt(point.x, point.y) !== ".") {
          finalPoint = point;
          break;
        }
      }

      // CORRECTED: Calculate the start pixel position from the center grid cell
      const startGridX = Math.floor(this.DISPLAY_WIDTH / 2);
      const startGridY = Math.floor(this.DISPLAY_HEIGHT / 2);
      const startPixelX = startGridX * this.cellWidth + this.cellWidth / 2;
      const startPixelY = startGridY * this.cellHeight + this.cellHeight / 2;

      const endScreenGrid = this._worldToScreen(finalPoint.x, finalPoint.y);

      if (endScreenGrid) {
        const endPixelX = endScreenGrid.x * this.cellWidth + this.cellWidth / 2;
        const endPixelY =
          endScreenGrid.y * this.cellHeight + this.cellHeight / 2;

        // Draw a dashed yellow line on the particle canvas
        this.particleCtx.beginPath();
        this.particleCtx.setLineDash([5, 5]);
        this.particleCtx.moveTo(startPixelX, startPixelY);
        this.particleCtx.lineTo(endPixelX, endPixelY);
        this.particleCtx.strokeStyle = "rgba(255, 255, 0, 0.5)";
        this.particleCtx.lineWidth = 2;
        this.particleCtx.stroke();
        this.particleCtx.setLineDash([]);
      }
    }

    // --- 2. DRAW PERSISTENT SPLATTERS ---
    // (This part is unchanged)
    for (const chunkKey in this.effects) {
      for (const tileKey in this.effects[chunkKey]) {
        const droplets = this.effects[chunkKey][tileKey];
        const [chunkX, chunkY] = chunkKey.split(",").map(Number);
        const [localX, localY] = tileKey.split(",").map(Number);
        const worldX = chunkX * this.CHUNK_WIDTH + localX;
        const worldY = chunkY * this.CHUNK_HEIGHT + localY;
        const screenPos = this._worldToScreen(worldX, worldY);
        if (screenPos) {
          const originX = screenPos.x * this.cellWidth + this.cellWidth / 2;
          const originY = screenPos.y * this.cellHeight + this.cellHeight / 2;
          for (const droplet of droplets) {
            this.particleCtx.fillStyle = droplet.color;
            this.particleCtx.fillRect(
              originX + droplet.dx,
              originY + droplet.dy,
              droplet.size,
              droplet.size,
            );
          }
        }
      }
    }

    // --- 3. ANIMATE TEMPORARY PARTICLES ---
    // (This part is unchanged)
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

    requestAnimationFrame(this._animationLoop.bind(this));
  },
  
_killEnemy: function(enemy) {
    this.scheduler.remove(enemy);
    enemy.char = '†';
    enemy.color = '#8B0000';
    enemy.looted = false; // Add a flag to prevent repeat looting

    // Create a blood pool directly under the corpse
    this._createSplatterEffect(enemy.x, enemy.y, {x:0, y:0}, 'corpse', 15);
},
  _drawMap: function () {
    const topLeftX = this.player.x - Math.floor(this.DISPLAY_WIDTH / 2);
    const topLeftY = this.player.y - Math.floor(this.DISPLAY_HEIGHT / 2);

    for (let y = 0; y < this.DISPLAY_HEIGHT; y++) {
      for (let x = 0; x < this.DISPLAY_WIDTH; x++) {
        const worldX = topLeftX + x;
        const worldY = topLeftY + y;
        const tile = this._getTileAt(worldX, worldY);

        let char = tile;
        let fg = null;
        // Set the default background for ALL tiles to be sand color
        let bg = "#D2B48C";

        if (tile === ".") {
          char = null; // For floor, just show the background
        } else if (tile === "#") {
          fg = "#8B4513"; // For rock, draw this char on the sand bg
        } else if (tile === "🌵") {
          fg = "#2E8B57"; // For cactus, draw this char on the sand bg
        }

        this.display.draw(x, y, char, fg, bg);
      }
    }
  },
  _drawPlayer: function () {
    const centerX = Math.floor(this.DISPLAY_WIDTH / 2);
    const centerY = Math.floor(this.DISPLAY_HEIGHT / 2);
    const sandColor = "#D2B48C";

    // Add the sand color as the 5th argument (background color)
    this.display.draw(centerX, centerY, "@", "#993300", sandColor);
  },
};

Game.init();
