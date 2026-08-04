import assert from "node:assert/strict";
import test from "node:test";

import { createKeyboardInput } from "../src/game/input.js";

function createTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type, event = {}) { listeners.get(type)?.({ preventDefault() {}, ...event }); },
  };
}

test("held direction follows the keys, most-recent axis wins", () => {
  const target = createTarget();
  const input = createKeyboardInput(target);

  target.dispatch("keydown", { code: "ArrowUp" });
  assert.equal(input.heldDirection(), "up");

  target.dispatch("keydown", { code: "ArrowRight" }); // both held → newest axis (h)
  assert.equal(input.heldDirection(), "right");

  target.dispatch("keyup", { code: "ArrowRight" }); // release right → up remains
  assert.equal(input.heldDirection(), "up");

  target.dispatch("keyup", { code: "ArrowUp" });
  assert.equal(input.heldDirection(), null);
  input.destroy();
});

test("discrete presses drain once; repeats are ignored", () => {
  const target = createTarget();
  const input = createKeyboardInput(target);

  target.dispatch("keydown", { code: "ArrowLeft" });
  target.dispatch("keydown", { code: "ArrowLeft", repeat: true }); // auto-repeat ignored
  target.dispatch("keydown", { code: "Space" });

  assert.deepEqual(input.drainPressed(), ["left", "attack"]);
  assert.deepEqual(input.drainPressed(), []); // drained
  input.destroy();
});

test("Space is exposed as a held attack until released", () => {
  const target = createTarget();
  const input = createKeyboardInput(target);

  target.dispatch("keydown", { code: "ArrowRight" });
  target.dispatch("keydown", { code: "Space" });
  assert.equal(input.heldAction(), "attack");

  target.dispatch("keyup", { code: "Space" });
  assert.equal(input.heldAction(), "right");

  target.dispatch("keyup", { code: "ArrowRight" });
  assert.equal(input.heldAction(), null);
  input.destroy();
});

test("losing focus clears held keys and pending presses", () => {
  const target = createTarget();
  const input = createKeyboardInput(target);

  target.dispatch("keydown", { code: "ArrowDown" });
  target.dispatch("keydown", { code: "Space" });
  target.dispatch("blur");

  assert.equal(input.heldDirection(), null);
  assert.equal(input.heldAction(), null);
  assert.deepEqual(input.drainPressed(), []);
  input.destroy();
});
