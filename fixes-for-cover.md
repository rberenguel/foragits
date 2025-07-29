# Implementation Plan: The "Quickdraw" Mechanic

This plan outlines the necessary code changes to implement the "Quickdraw" mechanic for more dynamic 1-v-1 shootouts from behind cover.

### 1. Actor State Enhancement

A new state needs to be added to the actor classes to represent the "aiming from cover" action.

-   **File(s) to modify:** `src/actors/player.js`, `src/actors/bandit.js`
-   **Change:** Add a new boolean property to both `Player` and `Bandit` classes.
    ```javascript
    this.isReadyingShot = false;
    ```

### 2. Player Input and Logic

The player needs a way to initiate the "Ready Shot" state from cover.

-   **File to modify:** `src/actors/player.js`
-   **Change in `handleEvent(e)`:**
    -   When the player is ducking (`this.isDucking`), pressing the aim key (`a`) should now set `this.isReadyingShot = true`.
    -   This action must consume a turn.
    -   When aiming is toggled off, ensure `isReadyingShot` is also set to `false`.

    ```javascript
    // Inside handleEvent(e)
    if (key === 'a') {
        if (this.isDucking) {
            this.isReadyingShot = !this.isReadyingShot;
            this.game.renderer.displayMessage(this.isReadyingShot ? "You ready yourself to fire from cover." : "You stand down.");
            this.game.renderer.drawAll(); // To show aim line
            return true; // This is now a turn-taking action
        }
        // ... existing aiming logic
        this.isReadyingShot = false; // Ensure it's false if not ducking
    }
    ```

### 3. Bandit AI Enhancement

The bandit AI must be updated to recognize and react to the player's "Ready Shot" state and to use the mechanic itself.

-   **File to modify:** `src/actors/bandit.js`
-   **Change in `act()`:**
    -   The bandit's decision-making needs a new primary condition.
    -   If the bandit can see the player (`this.playerIsVisible`) and the player is readying a shot (`this.game.player.isReadyingShot`), the bandit's highest priority is to also enter `isReadyingShot = true` to trigger a Quickdraw.
    -   If the player is visible but *not* readying a shot, the bandit can choose to enter `isReadyingShot` as a tactical option, perhaps based on a random chance.

    ```javascript
    // Inside Bandit's act() method, in the DECISION MAKING section
    if (this.playerIsVisible) {
        // --- NEW QUICKDRAW LOGIC ---
        // If player is aiming from cover, bandit's priority is to counter-aim.
        if (this.game.player.isReadyingShot) {
            this.isReadyingShot = true;
            return; // Commit to the Quickdraw
        }

        // Tactical decision to aim from cover
        if (this.isDucking && Math.random() < 0.5) { // 50% chance to aim
             this.isReadyingShot = true;
             return;
        }
        // --- END NEW LOGIC ---

        // ... existing logic for aiming and shooting ...
    }
    ```

### 4. Game Engine and Turn Resolution

The core game loop must handle the new mechanic, resolving Quickdraws and automatic shots from the "Ready" state.

-   **File to modify:** `src/main.js`
-   **New Method: `resolveQuickdraw(actor1, actor2)`**
    -   This method compares the "speed" of the two actors. This can be a simple `Math.random()` check for now.
    -   The winner's `resolveShot()` is called.
    -   The loser's `isReadyingShot` is set to `false`, and they do not get to fire. They take damage.

-   **Change in the Engine's Turn Loop (within `Game.init` or the `act` loop):**
    -   Before an actor takes its turn, a check is needed.
    -   If `actor.isReadyingShot` is `true`:
        -   Find its target.
        -   If `target.isReadyingShot` is also `true`, call `resolveQuickdraw(actor, target)`.
        -   If the target is *not* readying a shot, call `actor.resolveShot()`. The shot will hit the target's cover.
        -   After firing, set `actor.isReadyingShot = false`.
        -   The actor's turn is consumed by this action.

    ```javascript
    // A conceptual update to the turn-based loop
    // This logic would live within the engine's next() or an actor's act()
    if (actor.isReadyingShot) {
        const target = (actor instanceof Player) ? findTarget(actor) : this.player;
        if (target && target.isReadyingShot) {
            // Quickdraw scenario
            this.resolveQuickdraw(actor, target);
        } else {
            // Standard ready shot against cover
            this.resolveShot(actor, actor.aimAngle); // or calculated angle for bandit
        }
        actor.isReadyingShot = false;
        // End actor's turn
        return;
    }
    ```

### 5. Visual Feedback

The player needs to know when an enemy is readying a shot.

-   **File to modify:** `src/renderer.js`
-   **Change in `_drawAimLines()`:**
    -   The renderer should draw an aim line for any enemy that has `isReadyingShot = true`, even if they are ducking. This provides the crucial visual cue for the player to react.


# Ideas for New Cover Objects

To make combat more dynamic and settlements less like open firing ranges, here are several new types of cover objects that can be added to the world generation.

### Universal & Desert Cover

These objects would appear naturally in the desert landscape, providing more opportunities for tactical movement and ambushes.

* **Fallen Wagon**
    * **Glyph:** `🛒` (or a multi-tile structure using `|`, `/`, `\`)
    * **Description:** An old, broken-down wagon. Provides a larger area of cover than a single rock.
    * **Mechanics:**
        * `isPassable: false`
        * `isTransparent: false` (blocks line of sight)
        * `isBulletPassable: false`
        * **Destructible:** Could have health. After taking enough damage, it breaks apart into smaller, less effective cover or disappears entirely.
        * Could occasionally contain a small amount of loot.

* **Large Animal Skull/Carcass**
    * **Glyph:** `💀`
    * **Description:** The bleached bones of a large animal, like a buffalo or steer.
    * **Mechanics:**
        * `isPassable: true` (You can stand on the same tile)
        * `isTransparent: true`
        * `isBulletPassable: false` (Functions like existing rocks for ducking)
        * Low profile cover, perfect for the `isDucking` mechanic.

### Settlement-Specific Cover

These objects would be generated within or on the outskirts of settlements, making them feel more lived-in and providing crucial cover for town-based shootouts.

* **Water Trough**
    * **Glyph:** `U`
    * **Description:** A long wooden or metal trough for horses.
    * **Mechanics:**
        * `isPassable: false`
        * `isTransparent: true`
        * `isBulletPassable: false`
        * Provides low cover along its length.
        * Could be destructible; if destroyed, could create a "wet" or "muddy" tile that might slow movement.

* **Stacks of Crates / Barrels**
    * **Glyph:** `📦` or `Barrel: B`
    * **Description:** Cargo waiting to be shipped or stored.
    * **Mechanics:**
        * `isPassable: false`
        * `isTransparent: false` (Blocks line of sight)
        * `isBulletPassable: false`
        * Can be generated in small clusters outside the General Store or along building walls.
        * Highly destructible.

* **Fences**
    * **Glyph:** `+` (for posts) and `-` or `|` for rails.
    * **Description:** A simple wooden fence, perhaps enclosing a non-existent yard or corral.
    * **Mechanics:**
        * `isPassable: false`
        * `isTransparent: true`
        * `isBulletPassable: true` (This is the key difference!)
        * **Gameplay Twist:** Fences would *not* provide cover from bullets but would still block movement, forcing actors to path around them or through gates. This creates channels and chokepoints without creating "safe" spots, adding a different tactical layer.


# Implementation Plan: The "Scramble" Mechanic

This feature allows an actor to move multiple tiles in a single turn to reach cover, with adjusted combat parameters during the move.

### 1. Player Action & State

A new action and state are required for the player.

-   **Activation:**
    -   Introduce a new key, for example, `c` for "Scramble."
    -   When the player presses `c`, the game enters a "Scramble Targeting" mode.
-   **Targeting:**
    -   The UI should highlight valid, reachable cover objects (like rocks `o`) within a certain range (e.g., 3-4 tiles).
    -   The player clicks on or uses arrow keys to select a target rock.
-   **Execution:**
    -   Upon selection, the player character moves up to X tiles (e.g., 3) in a straight line towards the cover in a single turn.
    -   The action consumes the entire turn.
-   **New State:** Add a new boolean property to the `Player` class: `this.isScrambling = false;`. This will be `true` for the duration of the turn the action is taken.

### 2. Combat Mechanics During Scramble

While an actor is scrambling, the rules of engagement change.

-   **File to modify:** `src/main.js` (in `resolveShot` or `attack`)
-   **Defensive Buff:**
    -   If the target of an attack has `isScrambling == true`, apply a significant accuracy penalty to the attacker. For example, the attacker's `aimError` could be temporarily doubled or tripled.
    -   This makes the scrambling actor harder to hit but not invincible.
-   **Suppressive Fire:**
    -   At the end of a Scramble action, the scrambling actor automatically fires one shot towards the enemy that initiated the scramble.
    -   This shot should have extremely high `aimError` (e.g., 50-60 degrees of deviation), making a direct hit nearly impossible.
    -   The purpose is to force a reaction from the AI, not to do reliable damage.

### 3. Bandit AI for Scrambling

The bandit AI needs to be able to use this mechanic to create more dynamic encounters.

-   **File to modify:** `src/actors/bandit.js` (in `act()`)
-   **AI Trigger:**
    -   If a bandit is in the open (not adjacent to cover) and spots the player for the first time, it should have a high chance of initiating a Scramble.
    -   The AI would scan for the nearest valid cover object and use its turn to Scramble towards it.
-   **Suppressive Fire Reaction:**
    -   If a bandit is targeted by the player's suppressive fire (a shot with very high deviation), the AI could be programmed to have a higher chance of ducking or scrambling on its next turn, simulating being "pinned down."

### How It Complements "Quickdraw"

The "Scramble" and "Quickdraw" mechanics work together beautifully to create a complete combat loop:

1.  **Engagement Starts (Open Field):** An actor is spotted. They **Scramble** for cover to close the distance and survive the initial volley.
2.  **In Cover (Stalemate):** Both actors are now ducking behind rocks. The situation is tense.
3.  **Shootout (Duel):** The actors must now use the **Quickdraw** mechanic (Aim from Cover -> Fire) to try and win the duel of timing and prediction.

This creates a natural flow from open-field maneuvering to a tense, cover-based shootout, making your combat encounters far more varied and strategic.