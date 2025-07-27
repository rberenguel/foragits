# Western Roguelike Prototype

A simple, turn-based roguelike prototype with a Western theme, built in JavaScript and `rot-js`.

See `plan.md` for current features and next functionality.

## Current Objective

The game currently starts with 5 bandits. The objective is to defeat them all. The game is effectively over after they are killed.

## Help

### Key Bindings
`Arrow Keys` - Move
`a` - Toggle Aim Mode
`f` - Fire (while aiming)
`r` - Reload Weapon
`g` - Get items on ground
`u` - Use item (near fire pit)
`i` - Open/Close Inventory
`d` - Duck behind cover
`?` - Open/Close Help
`m` - Open/Close Map
`l` - Look around

### Gameplay Mechanics

#### Bandit Behavior
Bandits will hunt you if you enter their line of sight. They will remember your last known position and pursue it. If they cannot see you, they will travel back to their home settlement.

#### Cover System
You can press `d` to duck behind an adjacent rock for cover. This takes a turn. While ducking, you are protected from incoming shots, but your vision is limited. Press `d` again or move to stand up. You can fire from cover by aiming (`a`) and then firing (`f`), which gives you a brief glimpse of the area as you shoot.

#### Survival
The desert is harsh. Look for inactive fire pits (`~`). If you are standing next to one and have a `Can of Beans` in your inventory, press `u` to cook it and restore some health.