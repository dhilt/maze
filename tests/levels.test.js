import assert from "node:assert/strict";
import test from "node:test";

import { createLevelBus, LEVELS } from "../src/game/levels.js";

test("configured levels form a valid non-decreasing progression", () => {
  assert.ok(LEVELS.length > 0);
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(level.number, index + 1);
    assert.ok(Number.isInteger(level.width) && level.width > 0);
    assert.ok(Number.isInteger(level.height) && level.height > 0);
    assert.ok(Number.isInteger(level.monsterCount) && level.monsterCount >= 0);
    if (index === 0) continue;
    assert.ok(level.width >= LEVELS[index - 1].width);
    assert.ok(level.height >= LEVELS[index - 1].height);
    assert.ok(level.monsterCount >= LEVELS[index - 1].monsterCount);
  }
});

test("the level bus advances once per level and stops at the final one", () => {
  const bus = createLevelBus();
  const total = LEVELS.length;

  assert.deepEqual(bus.state, {
    number: 1,
    total,
    progress: 1 / total,
    isLast: total === 1,
    definition: LEVELS[0],
  });
  for (let number = 2; number <= total; number += 1) {
    assert.equal(bus.advance(), true);
    assert.equal(bus.number, number);
    assert.equal(bus.progress, number / total);
    assert.equal(bus.current, LEVELS[number - 1]);
  }
  assert.equal(bus.isLast, true);
  assert.equal(bus.advance(), false);
  assert.equal(bus.current, LEVELS.at(-1));
});
