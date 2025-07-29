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