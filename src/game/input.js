const KEY_MAP = Object.freeze({
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
});

// Low-level input: exposes the held action (for auto-repeat while a key is
// down) and the stream of discrete presses (for the action buffer). It carries
// no notion of the current action — the scheduler applies the buffering rules.
export function createKeyboardInput(target = window) {
  const keys = Object.create(null);
  let lastAxis = "h";
  const pressed = []; // discrete action ids since the last drain

  function onKeyDown(event) {
    if (event.code === "KeyE") {
      if (!event.repeat) pressed.push("consume");
      event.preventDefault();
      return;
    }
    if (event.code === "Space") {
      keys.attack = true;
      if (!event.repeat) pressed.push("attack");
      event.preventDefault();
      return;
    }
    const action = KEY_MAP[event.code];
    if (!action) return;
    keys[action] = true;
    lastAxis = action === "left" || action === "right" ? "h" : "v";
    if (!event.repeat) pressed.push(action);
    event.preventDefault();
  }

  function onKeyUp(event) {
    if (event.code === "Space") {
      keys.attack = false;
      event.preventDefault();
      return;
    }
    const action = KEY_MAP[event.code];
    if (!action) return;
    keys[action] = false;
    event.preventDefault();
  }

  function clear() {
    for (const action of Object.values(KEY_MAP)) keys[action] = false;
    keys.attack = false;
    pressed.length = 0;
  }

  // The currently held direction (single axis, most recently pressed wins), or null.
  function heldDirection() {
    let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (dx !== 0 && dy !== 0) {
      if (lastAxis === "v") dx = 0;
      else dy = 0;
    }
    if (dx !== 0) return dx > 0 ? "right" : "left";
    if (dy !== 0) return dy > 0 ? "down" : "up";
    return null;
  }

  // Attack takes priority while Space and a direction are held together.
  function heldAction() {
    return keys.attack ? "attack" : heldDirection();
  }

  // Take the discrete presses recorded since the previous call.
  function drainPressed() {
    const out = pressed.slice();
    pressed.length = 0;
    return out;
  }

  function destroy() {
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
    target.removeEventListener("blur", clear);
  }

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", clear);

  return { heldAction, heldDirection, drainPressed, destroy };
}
