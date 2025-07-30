# Settlement-Specific Cover

These objects would be generated within or on the outskirts of settlements, making them feel more lived-in and providing crucial cover for town-based shootouts.

- **Water Trough**

  - **Glyph:** `U`
  - **Description:** A long wooden or metal trough for horses.
  - **Mechanics:**
    - `isPassable: false`
    - `isTransparent: true`
    - `isBulletPassable: false`
    - Provides low cover along its length.
    - Could be destructible; if destroyed, could create a "wet" or "muddy" tile that might slow movement.

- **Stacks of Crates / Barrels**

  - **Glyph:** some UTF8 character that makes for a good "box" feel, same for barrel.
  - **Description:** Cargo waiting to be shipped or stored.
  - **Mechanics:**
    - `isPassable: false`
    - `isTransparent: false` (Blocks line of sight)
    - `isBulletPassable: false`
    - Can be generated in small clusters outside the General Store or along building walls.
    - Highly destructible.

- **Fences**
  - **Glyph:** `+` (for posts) and `-` or `|` for rails.
  - **Description:** A simple wooden fence, perhaps enclosing a non-existent yard or corral.
  - **Mechanics:**
    - `isPassable: false`
    - `isTransparent: true`
    - `isBulletPassable: true` (This is the key difference!)
    - **Gameplay Twist:** Fences would _not_ provide cover from bullets but would still block movement, forcing actors to path around them or through gates. This creates channels and chokepoints without creating "safe" spots, adding a different tactical layer.

# Implementation Plan: The "Scramble" Mechanic

This feature allows an actor to move multiple tiles in a single turn to reach cover, with adjusted combat parameters during the move.

### 1. Player Action & State

A new action and state are required for the player.

- **Activation:**
  - Introduce a new key, for example, `c` for "Scramble."
  - When the player presses `c`, the game enters a "Scramble Targeting" mode.
- **Targeting:**
  - The UI should highlight valid, reachable cover objects (like rocks `o`) within a certain range (e.g., 3-4 tiles).
  - The player clicks on or uses arrow keys to select a target rock.
- **Execution:**
  - Upon selection, the player character moves up to X tiles (e.g., 3) in a straight line towards the cover in a single turn.
  - The action consumes the entire turn.
- **New State:** Add a new boolean property to the `Player` class: `this.isScrambling = false;`. This will be `true` for the duration of the turn the action is taken.

### 2. Combat Mechanics During Scramble

While an actor is scrambling, the rules of engagement change.

- **File to modify:** `src/main.js` (in `resolveShot` or `attack`)
- **Defensive Buff:**
  - If the target of an attack has `isScrambling == true`, apply a significant accuracy penalty to the attacker. For example, the attacker's `aimError` could be temporarily doubled or tripled.
  - This makes the scrambling actor harder to hit but not invincible.
- **Suppressive Fire:**
  - At the end of a Scramble action, the scrambling actor automatically fires one shot towards the enemy that initiated the scramble.
  - This shot should have extremely high `aimError` (e.g., 50-60 degrees of deviation), making a direct hit nearly impossible.
  - The purpose is to force a reaction from the AI, not to do reliable damage.

### 3. Bandit AI for Scrambling

The bandit AI needs to be able to use this mechanic to create more dynamic encounters.

- **File to modify:** `src/actors/bandit.js` (in `act()`)
- **AI Trigger:**
  - If a bandit is in the open (not adjacent to cover) and spots the player for the first time, it should have a high chance of initiating a Scramble.
  - The AI would scan for the nearest valid cover object and use its turn to Scramble towards it.
- **Suppressive Fire Reaction:**
  - If a bandit is targeted by the player's suppressive fire (a shot with very high deviation), the AI could be programmed to have a higher chance of ducking or scrambling on its next turn, simulating being "pinned down."

### How It Complements "Quickdraw"

The "Scramble" and "Quickdraw" mechanics work together beautifully to create a complete combat loop:

1.  **Engagement Starts (Open Field):** An actor is spotted. They **Scramble** for cover to close the distance and survive the initial volley.
2.  **In Cover (Stalemate):** Both actors are now ducking behind rocks. The situation is tense.
3.  **Shootout (Duel):** The actors must now use the **Quickdraw** mechanic (Aim from Cover -> Fire) to try and win the duel of timing and prediction.

This creates a natural flow from open-field maneuvering to a tense, cover-based shootout, making your combat encounters far more varied and strategic.
