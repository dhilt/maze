import assert from "node:assert/strict";
import test from "node:test";

import { createKeyboardInput } from "../src/game/input.js";

function createTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type, event) { listeners.get(type)?.(event); },
  };
}

test("Space creates one attack request and ignores keyboard repeat", () => {
  const target = createTarget();
  const input = createKeyboardInput(target);
  const event = { code: "Space", repeat: false, preventDefault() {} };

  target.dispatch("keydown", event);
  target.dispatch("keydown", { ...event, repeat: true });

  assert.equal(input.hasAttackRequest(), true);
  assert.equal(input.consumeAttack(), true);
  assert.equal(input.consumeAttack(), false);
  input.destroy();
});

test("attack is not queued while an attack is already the active action", () => {
  const target = createTarget();
  let attacking = true;
  const input = createKeyboardInput(target, { canQueueAttack: () => !attacking });
  const space = { code: "Space", repeat: false, preventDefault() {} };

  target.dispatch("keydown", space);
  assert.equal(input.hasAttackRequest(), false); // dropped mid-attack (no double)

  attacking = false;
  target.dispatch("keydown", space);
  assert.equal(input.hasAttackRequest(), true); // accepted once free
  input.destroy();
});

test("losing focus clears a queued attack", () => {
  const target = createTarget();
  const input = createKeyboardInput(target);

  target.dispatch("keydown", { code: "Space", repeat: false, preventDefault() {} });
  target.dispatch("blur", {});

  assert.equal(input.hasAttackRequest(), false);
  input.destroy();
});
