# Western Roguelike Prototype

A simple, turn-based roguelike prototype with a Western theme, built in JavaScript and `rot-js`.

See `plan.md` and `next_steps.md` for current features and next functionality.

## Current Objective

Survive the harsh desert, deal with outlaws, and trade in settlements. The world is dangerous, but fortune awaits the bold.

## Help

### Key Bindings

- `Arrow Keys` - Move
- `a` - Toggle Aim Mode
- `f` - Fire (while aiming) / Acknowledge "Spotted" message
- `r` - Reload Weapon
- `g` - Get items on ground
- `u` - Use item (near fire pit)
- `i` - Open/Close Inventory
- `d` - Duck behind cover
- `t` - Talk to people / Trade with Shopkeepers
- `?` - Open/Close Help
- `m` - Open/Close Map
- `l` - Look around

### Gameplay Mechanics

#### Combat & Weapons

Not all weapons are created equal. A `Rusty Revolver` is more likely to misfire and has poor accuracy, while a standard `Revolver` is more reliable. Shopkeepers may sell higher quality gear. Your own skill and the weapon's quality both contribute to a shot's accuracy, introducing a slight random deviation.

When you spot a bandit (`Č`), the game will pause and notify you. Press `f` to acknowledge the message and continue.

#### Bandit Behavior

Bandits will hunt you if you enter their line of sight. They will remember your last known position and pursue it. If they cannot see you, they will travel back to their home settlement. They often carry a small amount of money.

#### Settlements & Shopping

You can find settlements populated by townsfolk (`P`). One building in each settlement is a shop, run by a Shopkeeper. You can talk (`t`) to a shopkeeper to open a trade menu and buy goods with the money (`$`) you've acquired.

#### Cover System

You can press `d` to duck behind an adjacent rock for cover. This takes a turn. While ducking, you are protected from incoming shots, but your vision is limited. Press `d` again or move to stand up. You can fire from cover by aiming (`a`) and then firing (`f`), which gives you a brief glimpse of the area as you shoot. If you are being aimed at by a bandit, you can be shot… Whoever is faster wins!

#### Survival

The desert is harsh. Look for inactive fire pits (`~`). If you are standing next to one and have a `Can of Beans` in your inventory, press `u` to cook it and restore some health.
