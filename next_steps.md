# Next Steps for Gameplay Development

This document outlines a step-by-step plan to build a compelling gameplay loop by introducing an economic model and a consequence system. Each step builds upon the previous one.

### Step 1: Economic Foundation - NPC Inventories & Shops

**Goal:** Create a reason for the player to need money.

0. **Main score:**

   - Make dollars the main game score.

1. **NPC Inventories:**

   - Give all non-hostile NPCs an inventory containing a small amount of money and a low chance of carrying a common item (e.g., `can_of_beans`).
   - When an NPC is killed, they will drop their inventory, just like bandits do.

2. **Shopkeeper NPC:**

   - Create a new, distinct "Shopkeeper" NPC type. They will be stationary within a specific building in a settlement.
   - Give them a larger inventory of items for sale (e.g., better ammo, food, perhaps a basic weapon or piece of apparel).
   - A shopkeeper wields a shotgun, damage 10 (100% of the time at range smaller than 5, which should be "inside the shop").
     If you aim at him/her while inside their building, they will also aim at you, show a message in the messaging system
     (a choice of things like "Don't even think about it") and, if you were to fire (f) their shot is faster and cancels
     your action. With the current gameplay loop it would be impossible to kill shopkeepers (well, almost).

3. **Shopping UI:**
   - Implement a simple "Shop" screen that is triggered by talking (`t`) to a Shopkeeper.
   - This screen will list the Shopkeeper's items and their prices.
   - The player will be able to buy items, which will transfer the item to their inventory and deduct the cost from their money.

**Justification:** This step establishes the core economic loop. The player now has a clear motivation to acquire money to buy better gear, creating a tangible reason to engage with both friendly and hostile NPCs.

---

### Step 2: The "Wanted" System - Consequences for Actions

**Goal:** Introduce meaningful consequences for the player's choices.

1.  **`isWanted` Player Status:**

    - Add a `player.isWanted` flag, which starts as `false`.
    - Attacking or killing any non-hostile NPC (regular or Shopkeeper) will permanently set this flag to `true`.

2.  **NPC Reactions:**
    - Update NPC logic. If `player.isWanted`:
      - Regular NPCs will refuse to talk, perhaps showing a fearful message instead ("Stay away from me!").
      - Shopkeepers will aim and kill if entering their building. Note that we need to make clear a building is a shop to avoid
        insta-death on entering while wanted.

**Justification:** This step introduces a clear moral and strategic choice. The player can choose the "outlaw" path for quick, easy loot by killing NPCs, but at the cost of being cut off from lawful society and its benefits (shops).

---

### Step 3: Enhancing the "Lawful" Path - Bandit Bounties

**Goal:** Make the lawful path a more viable and rewarding alternative.

1.  **Improved Bandit Loot:**

    - Increase the amount of money and the quality of items dropped by bandits to make hunting them more profitable.

2.  **More bandits:**

    - We need to add more bandits over time. Also, they should be a problem for settlements… and have their own "lairs".

3.  **Bounty System (Future Foundation):**
    - While a full "Sheriff" NPC isn't needed yet, we can lay the groundwork. When a named bandit is killed, log a message like "You could probably collect a bounty on the head of 'Deadeye' Jed." This signals to the player that their actions have a positive value.

**Justification:** This step ensures that players who choose not to become outlaws have a clear and rewarding path for progression, balancing the risk/reward of the "Wanted" system.

---

### Step 4: Enhancing the "Outlaw" Path - Bounty Hunters

**Goal:** Add a dynamic, challenging consequence to being an outlaw.

1.  **Bounty Hunter AI:**

    - Create a new, tougher enemy type: the "Bounty Hunter." They will be better equipped than standard bandits.

2.  **Spawning Logic:**
    - If `player.isWanted`, there will be a small chance on each turn that a Bounty Hunter will spawn at the edge of the map and begin actively hunting the player, using the same advanced pathfinding as bandits.

**Justification:** This adds a direct and recurring threat that makes the "outlaw" path more dangerous and exciting, completing the consequence loop.
