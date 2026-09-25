import assert from "node:assert/strict";
import test from "node:test";

import { BLOOD_DURATION_SECONDS, createBloodEffects } from "../src/rendering/blood.js";

const HIT = {
  target: { x: 128, y: 64 },
  attacker: { x: 64, y: 64 },
};

function drawAt(effects, time) {
  const rectangles = [];
  const ctx = {
    save() {},
    restore() {},
    fillRect(...args) {
      rectangles.push({ rect: args, color: this.fillStyle, alpha: this.globalAlpha });
    },
  };
  const active = effects.draw(ctx, { px: 0, py: 0 }, time);
  return { rectangles, active };
}

test("blood samples visual randomness once, then animates and expires", () => {
  let samples = 0;
  const effects = createBloodEffects({ cellSize: 64, random: () => { samples += 1; return 0.5; } });
  effects.spawn(HIT, 0);
  const sampledAtImpact = samples;

  const opening = drawAt(effects, 0).rectangles;
  assert.equal(opening.length, 10, "the first frames add a brief contact splash");
  assert.ok(opening.some(({ rect, color }) => color === "#ff4b54" && rect[2] >= 6));
  const afterAccent = drawAt(effects, 0.1).rectangles;
  assert.equal(afterAccent.length, 7, "only the flying drops remain after the accent");
  assert.equal(afterAccent.filter(({ color }) => color === "#ff4b54").length, 2);

  const middle = drawAt(effects, 0.17);
  assert.equal(middle.active, true);
  const first = middle.rectangles;
  assert.equal(first.length, 7);
  assert.deepEqual(drawAt(effects, 0.17).rectangles, first, "redrawing a frame must not re-roll particles");
  assert.equal(samples, sampledAtImpact);

  const other = createBloodEffects({ cellSize: 64, random: () => 0.8 });
  other.spawn(HIT, 0);
  assert.notDeepEqual(drawAt(other, 0.17).rectangles, first, "the random source changes the spray");
  assert.deepEqual(drawAt(effects, BLOOD_DURATION_SECONDS), {
    rectangles: [],
    active: false,
  });
});
