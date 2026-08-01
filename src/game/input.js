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

export function createKeyboardInput(target = window) {
  const keys = Object.create(null);
  let lastAxis = "h";

  function onKeyDown(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    keys[action] = true;
    lastAxis = action === "left" || action === "right" ? "h" : "v";
    event.preventDefault();
  }

  function onKeyUp(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    keys[action] = false;
    event.preventDefault();
  }

  function clear() {
    for (const action of Object.values(KEY_MAP)) keys[action] = false;
  }

  function getDirection() {
    let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);

    if (dx !== 0 && dy !== 0) {
      if (lastAxis === "v") dx = 0;
      else dy = 0;
    }
    return { dx, dy };
  }

  function destroy() {
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
    target.removeEventListener("blur", clear);
  }

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", clear);

  return { getDirection, destroy };
}
