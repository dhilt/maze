import assert from "node:assert/strict";
import test from "node:test";

import { resolveDamage, resolveImpact } from "../src/game/actions/impact.js";

test("finite defense leaves chip damage, while infinite defense is absolute", () => {
  assert.equal(resolveDamage({ power: 5, defense: 5 }), 1);
  assert.equal(resolveDamage({ power: 5, defense: 100 }), 1);
  assert.equal(resolveDamage({ power: 5, defense: Infinity }), 0);
  assert.equal(resolveDamage({ power: 0, defense: 0 }), 0);
});

test("impact separates blocked and penetrating damage", () => {
  assert.deepEqual(resolveImpact({
    power: 6,
    defense: 2,
    impactWear: 1,
  }), {
    rawDamage: 6,
    blockedDamage: 2,
    damage: 4,
    statWear: 10,
  });
});

test("a fully blocked impact still causes finite stat wear", () => {
  assert.deepEqual(resolveImpact({
    power: 6,
    defense: Infinity,
    impactWear: 1,
  }), {
    rawDamage: 6,
    blockedDamage: 6,
    damage: 0,
    statWear: 16,
  });
});

test("impact wear and action multiplier scale either sword or shield use", () => {
  const result = resolveImpact({
    power: 6,
    defense: 2,
    impactWear: 1.5,
    wearMultiplier: 0.5,
  });

  assert.equal(result.statWear, 8);
});
