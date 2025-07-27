// src/items.js

const itemTemplates = {
  // Weapons
  revolver_rusty: {
    name: "Rusty Revolver",
    char: "r",
    color: "#a35229",
    type: "weapon",
    damage: "1d6",
    capacity: 6,
    loaded: 6,
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
  return { ...template, ...overrides };
}
