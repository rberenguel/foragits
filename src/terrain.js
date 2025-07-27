// src/terrain.js

export const terrainInfo = {
  ".": {
    isPassable: true,
    isTransparent: true,
    isBulletPassable: true,
    color: "#D2B48C",
    darkColor: "#423e37",
  },
  "#": {
    isPassable: false,
    isTransparent: false,
    isBulletPassable: false,
    color: "#8B4513",
  },
  Ψ: {
    isPassable: false,
    isTransparent: true,
    isBulletPassable: false,
    color: "#2E8B57",
  },
  "=": {
    isPassable: false,
    isTransparent: false,
    isBulletPassable: false,
    color: "#A9A9A9",
  },
  "+": {
    isPassable: true,
    isTransparent: false, // Blocks line of sight
    isBulletPassable: true, // But not bullets
    color: "#A0522D",
  },
  팻: {
    isPassable: false,
    isTransparent: true,
    isBulletPassable: true,
    color: "#8B4513",
  },
};

export const TILE_TYPE = {
  FLOOR: ".",
  WALL: "#",
  CACTUS: "Ψ",
  SETTLEMENT_WALL: "=",
  DOOR: "+",
  PLACARD: "팻",
};
