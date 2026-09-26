import { ACTION } from "./actions/intent.js";

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

const DIRECTION_HOLD_DELAY_MS = 120;

// Low-level input: exposes the held action (for auto-repeat while a key is
// down) and the stream of discrete presses (for the action buffer). It carries
// no notion of the current action — the scheduler applies the buffering rules.
export function createKeyboardInput(
  target = window,
  { directionHoldDelayMs = DIRECTION_HOLD_DELAY_MS } = {},
) {
  if (!Number.isFinite(directionHoldDelayMs) || directionHoldDelayMs < 0) {
    throw new RangeError("Direction hold delay must be a non-negative number");
  }
  const keys = Object.create(null);
  const pressedAt = Object.create(null);
  let lastAxis = "h";
  const pressed = []; // discrete action ids since the last drain

  function eventTime(event) {
    return Number.isFinite(event.timeStamp) ? Math.max(event.timeStamp, 0) : 0;
  }

  function onKeyDown(event) {
    if (event.code === "KeyE") {
      keys.eat = true;
      if (!event.repeat) pressed.push(ACTION.eat);
      event.preventDefault();
      return;
    }
    if (event.code === "Space") {
      keys.attack = true;
      if (!event.repeat) pressed.push(ACTION.attack);
      event.preventDefault();
      return;
    }
    const action = KEY_MAP[event.code];
    if (!action) return;
    if (event.repeat || keys[action]) {
      event.preventDefault();
      return;
    }
    keys[action] = true;
    pressedAt[action] = eventTime(event);
    lastAxis = action === "left" || action === "right" ? "h" : "v";
    pressed.push(action);
    event.preventDefault();
  }

  function onKeyUp(event) {
    if (event.code === "KeyE") {
      keys.eat = false;
      event.preventDefault();
      return;
    }
    if (event.code === "Space") {
      keys.attack = false;
      event.preventDefault();
      return;
    }
    const action = KEY_MAP[event.code];
    if (!action) return;
    keys[action] = false;
    delete pressedAt[action];
    event.preventDefault();
  }

  function clear() {
    for (const action of Object.values(KEY_MAP)) {
      keys[action] = false;
      delete pressedAt[action];
    }
    keys.attack = false;
    keys.eat = false;
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
  function heldAction(at = 0) {
    if (keys.attack) return ACTION.attack;
    const direction = heldDirection();
    if (direction === null) return null;
    const heldFor = at - (pressedAt[direction] ?? at);
    return heldFor >= directionHoldDelayMs ? direction : null;
  }

  function hasHeldControl() {
    return !!(keys.up || keys.down || keys.left || keys.right || keys.attack || keys.eat);
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

  return { heldAction, heldDirection, hasHeldControl, drainPressed, destroy };
}
