import assert from "node:assert/strict";
import test from "node:test";

import {
  selectMeatMonsterAttackFrame,
  selectMeatMonsterWalkFrame,
} from "../src/rendering/meat-monster-sprites.js";

test("meat monster walking uses all four movement phases", () => {
  const move = { kind: "step", elapsed: 0, timeCost: 8 };
  assert.equal(selectMeatMonsterWalkFrame(move), 0);
  move.elapsed = 2;
  assert.equal(selectMeatMonsterWalkFrame(move), 1);
  move.elapsed = 4;
  assert.equal(selectMeatMonsterWalkFrame(move), 2);
  move.elapsed = 6;
  assert.equal(selectMeatMonsterWalkFrame(move), 3);
  assert.equal(selectMeatMonsterWalkFrame(null), 0);
  assert.equal(selectMeatMonsterWalkFrame({ kind: "turn", elapsed: 1, timeCost: 1 }), 0);
});

test("the downward lunge reaches and holds its flattened bite phase", () => {
  const attack = { elapsed: 0, timeCost: 5 };
  assert.equal(selectMeatMonsterAttackFrame(attack), 0);
  attack.elapsed = 1.7;
  assert.equal(selectMeatMonsterAttackFrame(attack), 2);
  attack.elapsed = 2.2;
  assert.equal(selectMeatMonsterAttackFrame(attack), 4);
  attack.elapsed = 3.0;
  assert.equal(selectMeatMonsterAttackFrame(attack), 4);
  attack.elapsed = 5;
  assert.equal(selectMeatMonsterAttackFrame(attack), 7);
});
