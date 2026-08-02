import assert from "node:assert/strict";
import test from "node:test";

import { createAttack } from "../src/game/attack.js";

test("attack is inactive until begun", () => {
  const attack = createAttack();
  assert.equal(attack.active, false);
  assert.equal(attack.state, null);
});

test("attack runs for its time cost then clears", () => {
  const attack = createAttack();
  attack.begin({ timeCost: 5 });
  assert.equal(attack.active, true);

  assert.equal(attack.update(4.9), 0);
  assert.equal(attack.active, true);

  const leftover = attack.update(0.2); // 5.1 → completes, 0.1 leftover
  assert.equal(attack.active, false);
  assert.equal(attack.state, null);
  assert.ok(Math.abs(leftover - 0.1) < 1e-9);
});
