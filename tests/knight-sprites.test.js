import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  KNIGHT_FRAME_COUNTS,
  loadKnightSprites,
  selectAttackFrame,
} from "../src/rendering/character/knight-sprites.js";

const DIRECTIONS = ["down", "up", "left", "right"];

test("the attack reaches its contact frame quickly and holds it", () => {
  assert.equal(selectAttackFrame(0.00), 0);
  assert.equal(selectAttackFrame(0.31), 3);
  assert.equal(selectAttackFrame(0.32), 4);
  assert.equal(selectAttackFrame(0.67), 4);
  assert.equal(selectAttackFrame(0.68), 5);
  assert.equal(selectAttackFrame(1.00), 8);
});

test("attack frame selection clamps invalid progress and supports other counts", () => {
  assert.equal(selectAttackFrame(-1), 0);
  assert.equal(selectAttackFrame(Number.NaN), 0);
  assert.equal(selectAttackFrame(1), 8);
  assert.equal(selectAttackFrame(0.5, 7), 3);
});

test("the committed knight asset set is complete and contains 64px PNG files", async () => {
  for (const [action, count] of Object.entries(KNIGHT_FRAME_COUNTS)) {
    for (const direction of DIRECTIONS) {
      for (let frame = 0; frame < count; frame += 1) {
        const file = new URL(
          `../assets/characters/knight/${action}/${direction}/${frame}.png`,
          import.meta.url,
        );
        const png = await readFile(file);
        assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        assert.equal(png.readUInt32BE(16), 64);
        assert.equal(png.readUInt32BE(20), 64);
      }
    }
  }
});

test("the knight loader uses deployable asset URLs instead of temp output", () => {
  const PreviousImage = globalThis.Image;
  globalThis.Image = class FakeImage {};
  try {
    const sprites = loadKnightSprites();

    assert.equal(sprites.idle.down.length, 4);
    assert.equal(sprites.walk.left.length, 4);
    assert.equal(sprites.attack.right.length, 9);
    assert.match(
      sprites.walk.right[3].src,
      /^\.\/assets\/characters\/knight\/walk\/right\/3\.png\?v=/,
    );
    assert.equal(sprites.walk.right[3].src.includes("temp"), false);
  } finally {
    if (PreviousImage === undefined) delete globalThis.Image;
    else globalThis.Image = PreviousImage;
  }
});
