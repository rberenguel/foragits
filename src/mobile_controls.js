// src/mobile_controls.js

function createButton(action, player) {
  const button = document.createElement("button");
  button.innerText = action.label;
  button.dataset.key = action.key;
  button.addEventListener("click", () => {
    const event = new KeyboardEvent("keydown", { key: action.key });
    player.handleEvent(event);
  });
  return button;
}

export function setupMobileControls(game) {
  const player = game.player;
  const controlsContainer = document.getElementById("mobile-controls");
  if (!controlsContainer) return;

  controlsContainer.innerHTML = ""; // Clear existing controls

  const isAiming =
    player.combatStance === "aiming" || player.combatStance === "challenging";

  const movementActions = [
    { key: "ArrowLeft", label: "←" },
    { key: "ArrowUp", label: "↑" },
    { key: "ArrowDown", label: "↓" },
    { key: "ArrowRight", label: "→" },
  ];

  const movementGroup = document.createElement("div");
  movementGroup.className = "control-group";
  movementActions.forEach((action) => {
    movementGroup.appendChild(createButton(action, player));
  });
  controlsContainer.appendChild(movementGroup);

  if (isAiming) {
    const fireActions = [
      { key: "f", label: "F" },
      { key: "a", label: "A" },
    ];
    const fireGroup = document.createElement("div");
    fireGroup.className = "control-group";
    fireActions.forEach((action) => {
      fireGroup.appendChild(createButton(action, player));
    });
    controlsContainer.appendChild(fireGroup);
  } else {
    const actions = [
      { key: "a", label: "A" },
      { key: "d", label: "D" },
      { key: "r", label: "R" },
      { key: "g", label: "G" },
      { key: "t", label: "T" },
      { key: "u", label: "U" },
      { key: "l", label: "L" },
      { key: "x", label: "X" },
    ];

    const actionsGroup = document.createElement("div");
    actionsGroup.className = "control-group";
    actions.forEach((action) => {
      actionsGroup.appendChild(createButton(action, player));
    });
    controlsContainer.appendChild(actionsGroup);
  }
}
