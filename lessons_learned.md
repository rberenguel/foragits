# Lessons Learned

- For this project, all in-game assets represented by characters must be standard UTF-8 characters. Emojis are not to be used.

## Quickdraw Mechanic Implementation Failures (July 2025 Session)

The attempts to implement the "Quickdraw" and "Peek-and-Shoot" mechanics were unsuccessful and introduced several critical, game-breaking bugs. The core failures stemmed from improper management of asynchronous JavaScript (`setTimeout`) within the synchronous, turn-based game loop provided by `rot-js`.

1.  **Asynchronous State Management:** The primary error was using `setTimeout` to create a visual "peek" effect when firing from cover.
    *   **Initial Bug:** The `setTimeout` callback would execute after the player's turn had technically ended, but the game state (`isDucking`) was not correctly restored before the next turn could begin, leaving the player stuck.
    *   **Root Cause:** The game's engine lock and the player's `keydown` event listener were not managed correctly across the asynchronous boundary. The engine was either unlocked too early, or the event listener was not properly removed and re-added, leading to a locked state where no further input was accepted.

2.  **Regression and Brittle Fixes:** Attempts to fix the asynchronous bug led to regressions that broke core functionality.
    *   **Example 1 (Invalid Move Hang):** A fix that removed the event listener too aggressively caused the game to hang when the player performed an invalid action (like walking into a wall), because the engine was never unlocked for that non-turn.
    *   **Example 2 (Announcement Hang):** A subsequent fix broke the dismissal of the "Bandit Spotted" announcement, again by failing to unlock the engine.
    *   **Lesson:** Fixes for a specific feature must be tested against all core interactions to prevent regressions. The input handling logic is particularly sensitive and must account for all possible outcomes (valid sync turn, valid async turn, invalid action).

3.  **Incorrect AI Precondition Validation:** The bandit AI was incorrectly triggering actions without verifying the necessary state.
    *   **Bug:** Bandits would announce they were "taking aim from cover" even when standing in the open.
    *   **Lesson:** All AI decision-making must validate preconditions before executing an action (e.g., `if (this._isAdjacentToCover()) { ... }`).

## Second Quickdraw Implementation Attempt Failures (July 2025 Session)

A second attempt to implement the Quickdraw mechanic also failed, introducing significant regressions.

1.  **Overly Complicated and Buggy State Management:** The introduction of the `isReadyingShot` state was not handled correctly in the player and bandit `act()` and `handleEvent()` methods. This created situations where the player or bandit would enter a state where they could not perform any actions (e.g., player readying a shot but unable to fire) or where the state was prematurely reset. The interaction between `isAiming`, `isDucking`, and `isReadyingShot` was not clearly defined, leading to unpredictable behavior.

2.  **Broken Visual Feedback:** The logic for drawing aim lines in `renderer.js` was broken.
    *   **Player:** The new logic for drawing the player's "ready" aim line depended on a `_findTarget()` method that was not robust, causing the aim line to not appear at all.
    *   **Bandit:** Changes to the bandit's `act()` method caused its `isAiming` or `isReadyingShot` state to be handled incorrectly, resulting in its aim line no longer being rendered. This removed critical visual cues for the player.

3.  **Flawed AI Logic:** The rewrite of the bandit's `act()` method, intended to make it more tactical, was a failure. The AI's decision tree was poorly structured, causing bandits to either abandon cover and rush the player or become passive and not fire at all. The logic for maintaining optimal distance and using cover was ineffective.

## Third Quickdraw Implementation Attempt Failure (July 2025 Session)

The third attempt to fix the feature was also a complete failure.

1.  **Persistent Failure to Render Aim Line:** Despite multiple attempts to refactor the `_drawAimLines` method in `renderer.js`, the aim line for the player in the `isReadyingShot` state was never correctly rendered. This indicates a persistent and fundamental misunderstanding of the game's rendering loop, the timing of state updates, and how data should be passed to the renderer. The repeated failure to fix this specific, critical piece of visual feedback demonstrates an inability to debug the core rendering logic.

