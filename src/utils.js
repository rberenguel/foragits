// src/utils.js

/**
 * Parses a dice notation string (e.g., "1d6", "2d8+2") and returns the result of the roll.
 * @param {string} diceNotation The string representing the dice roll.
 * @returns {number} The result of the dice roll.
 */
export function rollDice(diceNotation) {
  if (!diceNotation || typeof diceNotation !== "string") {
    console.error("Invalid dice notation provided:", diceNotation);
    return 1; // Return a default value
  }

  const match = diceNotation.match(/(\d+)d(\d+)(?:([+-])(\d+))?/);
  if (!match) {
    console.error("Invalid dice notation format:", diceNotation);
    return 1;
  }

  const numDice = parseInt(match[1], 10);
  const numSides = parseInt(match[2], 10);
  const modifierSign = match[3];
  const modifierValue = match[4] ? parseInt(match[4], 10) : 0;

  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * numSides) + 1;
  }

  if (modifierSign === "+") {
    total += modifierValue;
  } else if (modifierSign === "-") {
    total -= modifierValue;
  }

  return total;
}
