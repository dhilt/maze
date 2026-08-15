import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDamage,
  resolveDamageRange,
  resolveImpact,
} from "../src/game/actions/impact.js";

function closeTo(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `expected ${actual} to be close to ${expected}`,
  );
}

test("efficiencies define the raw damage interval", () => {
  const range = resolveDamageRange({
    power: 7,
    powerEfficiency: 0.8,
    defense: 5,
    defenseEfficiency: 0.6,
  });

  closeTo(range.min, 0.6);
  closeTo(range.max, 4);
});

test("damage samples the raw interval and applies the global hard minimum", () => {
  const options = {
    power: 6,
    powerEfficiency: 0.7,
    defense: 5,
    defenseEfficiency: 0.9,
  };

  assert.equal(resolveDamage({ ...options, roll: 0 }), 0.05);
  closeTo(resolveDamage({ ...options, roll: 0.5 }), 0.35);
  closeTo(resolveDamage({ ...options, roll: 1 }), 1.5);
});

test("the global minimum also applies to zero power and infinite defense", () => {
  assert.equal(resolveDamage({
    power: 0,
    powerEfficiency: 0.5,
    defense: 0,
    defenseEfficiency: 0.5,
    roll: 1,
  }), 0.05);
  assert.equal(resolveDamage({
    power: 100,
    powerEfficiency: 0.5,
    defense: Infinity,
    defenseEfficiency: 0.5,
    roll: 1,
  }), 0.05);
});

test("impact exposes sampled raw damage and separates blocked damage", () => {
  assert.deepEqual(resolveImpact({
    power: 6,
    powerEfficiency: 1,
    defense: 2,
    defenseEfficiency: 1,
    impactWear: 1,
    roll: 0.5,
  }), {
    rawDamage: 4,
    blockedDamage: 2,
    damage: 4,
    statWear: 10,
  });
});

test("a fully blocked impact still causes finite stat wear", () => {
  assert.deepEqual(resolveImpact({
    power: 6,
    powerEfficiency: 1,
    defense: Infinity,
    defenseEfficiency: 1,
    impactWear: 1,
    roll: 0.5,
  }), {
    rawDamage: 0,
    blockedDamage: 6,
    damage: 0.05,
    statWear: 17,
  });
});

test("impact wear and action multiplier scale either sword or shield use", () => {
  const result = resolveImpact({
    power: 6,
    powerEfficiency: 1,
    defense: 2,
    defenseEfficiency: 1,
    impactWear: 1.5,
    roll: 0.5,
    wearMultiplier: 0.5,
  });

  assert.equal(result.statWear, 8);
});
