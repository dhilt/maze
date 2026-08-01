import assert from "node:assert/strict";
import test from "node:test";

import { createAttack } from "../src/game/attack.js";
import { createMovement } from "../src/game/movement.js";
import { generateWorld } from "../src/world/world.js";

test("attack consumes a request only when the hero is idle", () => {
  let queued = true;
  const input = {
    consumeAttack() {
      if (!queued) return false;
      queued = false;
      return true;
    },
  };
  const attack = createAttack({ input, duration: 0.63 });

  assert.equal(attack.tryStart(false), false);
  assert.equal(queued, true);
  assert.equal(attack.tryStart(true), true);
  assert.equal(queued, false);
  assert.equal(attack.active, true);
});

test("attack completes after its configured duration and returns to idle", () => {
  const input = { consumeAttack: () => true };
  const attack = createAttack({ input, duration: 0.63 });

  attack.tryStart(true);
  attack.update(0.62);
  assert.equal(attack.active, true);
  attack.update(0.01);
  assert.equal(attack.active, false);
  assert.equal(attack.state, null);
});

test("an attack queued during movement starts only after the cell is completed", () => {
  const world = generateWorld({ width: 5, height: 5, seed: 1 });
  const player = { col: 1, row: 2 };
  let queued = true;
  const input = {
    getDirection: () => ({ dx: 1, dy: 0 }),
    hasAttackRequest: () => queued,
    consumeAttack() {
      if (!queued) return false;
      queued = false;
      return true;
    },
  };
  const movement = createMovement({
    world,
    player,
    input,
    cellSize: 64,
    cellTime: 0.44,
  });
  const attack = createAttack({ input, duration: 0.63 });

  movement.update(0.2);
  assert.equal(attack.tryStart(movement.isIdle), false);
  assert.equal(queued, true);

  movement.update(0.3, { stopAtBoundary: input.hasAttackRequest() });
  assert.deepEqual(player, { col: 2, row: 2 });
  assert.equal(movement.isIdle, true);
  assert.equal(attack.tryStart(movement.isIdle), true);
  assert.equal(attack.active, true);
});
