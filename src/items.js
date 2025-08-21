// src/items.js

const itemTemplates = {
  // Weapons
  revolver: {
    name: "Revolver",
    char: "r",
    color: "#c0c0c0",
    type: "weapon",
    kind: "revolver",
    damage: "1d6",
    capacity: 6,
    loaded: 6,
    aimError: 5, // Degrees of deviation
    misfireChance: 0.01, // 1% chance
  },
  revolver_rusty: {
    name: "Rusty Revolver",
    char: "r",
    color: "#a35229",
    type: "weapon",
    kind: "revolver",
    damage: "1d3",
    capacity: 6,
    loaded: 6,
    aimError: 15, // Degrees of deviation
    misfireChance: 0.1, // 10% chance
  },
  shotgun: {
    name: "Shotgun",
    char: "S",
    color: "#8b4513",
    type: "weapon",
    kind: "shotgun",
    damage: "2d8", // Deals high damage at close range
    capacity: 2,
    loaded: 2,
    aimError: 25, // Very inaccurate at range
    misfireChance: 0.05,
  },
  // Misc
  money: {
    name: "Money",
    char: "$",
    color: "#ffd700", // Gold color
    type: "money",
    isStackable: true,
    quantity: 1,
  },
  // Ammo
  ammo_bullet: {
    name: "Ammunition",
    char: "'",
    color: "#888888",
    type: "ammo",
    isStackable: true,
    quantity: 1, // Default quantity
  },
  // Apparel
  belt_rusty: {
    name: "Rusty Belt",
    char: "b",
    color: "#8b4513",
    type: "apparel",
  },
  hat_fedora: {
    name: "Fedora Hat",
    char: "h",
    color: "#594d41",
    type: "apparel",
  },
  boots_worn: {
    name: "Worn Out Boots",
    char: "B",
    color: "#543d2b",
    type: "apparel",
  },
  // Consumables
  can_of_beans: {
    name: "Can of Beans",
    char: "o",
    color: "#bfae8e",
    type: "consumable",
    isStackable: true,
    heals: 4, // Restores 4 HP
    quantity: 1,
  },
};

/**
 * Creates a new item instance from a template.
 * @param {string} templateId The key of the item in itemTemplates.
 * @param {object} overrides Optional properties to override the template's defaults.
 * @returns {object} A new item object.
 */
export function createItem(templateId, overrides = {}) {
  if (!itemTemplates[templateId]) {
    throw new Error(`Item template with id "${templateId}" not found.`);
  }
  const template = itemTemplates[templateId];
  return { templateId, ...template, ...overrides };
}
