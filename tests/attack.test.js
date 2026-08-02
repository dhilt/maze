import assert from "node:assert/strict";
import test from "node:test";

import { createAttack } from "../src/game/attack.js";

test("attack is inactive until started", () => {
  const attack = createAttack({ duration: 0.5 });
  assert.equal(attack.active, false);
  assert.equal(attack.state, null);
});

test("attack runs for its duration then clears", () => {
  const attack = createAttack({ duration: 0.5 });
  attack.start();
  assert.equal(attack.active, true);

  assert.equal(attack.update(0.49), 0);
  assert.equal(attack.active, true);

  const leftover = attack.update(0.02); // 0.51 total → completes, 0.01 leftover
  assert.equal(attack.active, false);
  assert.equal(attack.state, null);
  assert.ok(Math.abs(leftover - 0.01) < 1e-9);
});
