import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MEAT_MONSTER_ATTACK_FRAME_COUNT,
  MEAT_MONSTER_WALK_FRAME_COUNT,
  loadMeatMonsterSprites,
  selectMeatMonsterAttackFrame,
  selectMeatMonsterWalkFrame,
} from "../src/rendering/meat-monster-sprites.js";

const DIRECTIONS = ["down", "up", "left", "right"];

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

test("the committed meat monster walk set contains 64px PNG files", async () => {
  for (const direction of DIRECTIONS) {
    for (let frame = 0; frame < MEAT_MONSTER_WALK_FRAME_COUNT; frame += 1) {
      const file = new URL(
        `../assets/enemies/meat-monster/walk/${direction}/${frame}.png`,
        import.meta.url,
      );
      const png = await readFile(file);
      assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      assert.equal(png.readUInt32BE(16), 64);
      assert.equal(png.readUInt32BE(20), 64);
    }
  }
});

test("the committed directional attack set contains the configured 64px PNG files", async () => {
  for (const direction of DIRECTIONS) {
    for (let frame = 0; frame < MEAT_MONSTER_ATTACK_FRAME_COUNT; frame += 1) {
      const file = new URL(
        `../assets/enemies/meat-monster/attack/${direction}/${frame}.png`,
        import.meta.url,
      );
      const png = await readFile(file);
      assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      assert.equal(png.readUInt32BE(16), 64);
      assert.equal(png.readUInt32BE(20), 64);
    }
  }
});

test("the meat monster loader uses deployable asset URLs", () => {
  const PreviousImage = globalThis.Image;
  globalThis.Image = class FakeImage {};
  try {
    const sprites = loadMeatMonsterSprites();
    const lastWalkFrame = MEAT_MONSTER_WALK_FRAME_COUNT - 1;
    const lastAttackFrame = MEAT_MONSTER_ATTACK_FRAME_COUNT - 1;
    assert.equal(sprites.walk.down.length, MEAT_MONSTER_WALK_FRAME_COUNT);
    assert.equal(sprites.walk.left.length, MEAT_MONSTER_WALK_FRAME_COUNT);
    assert.equal(sprites.attack.down.length, MEAT_MONSTER_ATTACK_FRAME_COUNT);
    assert.equal(sprites.attack.up.length, MEAT_MONSTER_ATTACK_FRAME_COUNT);
    assert.equal(sprites.attack.left.length, MEAT_MONSTER_ATTACK_FRAME_COUNT);
    assert.equal(sprites.attack.right.length, MEAT_MONSTER_ATTACK_FRAME_COUNT);
    assert.match(
      sprites.walk.right[lastWalkFrame].src,
      new RegExp(`^\\./assets/enemies/meat-monster/walk/right/${lastWalkFrame}\\.png\\?v=`),
    );
    assert.equal(sprites.walk.right[lastWalkFrame].src.includes("temp"), false);
    assert.match(
      sprites.attack.down[lastAttackFrame].src,
      new RegExp(`^\\./assets/enemies/meat-monster/attack/down/${lastAttackFrame}\\.png\\?v=`),
    );
    assert.match(
      sprites.attack.up[lastAttackFrame].src,
      new RegExp(`^\\./assets/enemies/meat-monster/attack/up/${lastAttackFrame}\\.png\\?v=`),
    );
    assert.match(
      sprites.attack.left[lastAttackFrame].src,
      new RegExp(`^\\./assets/enemies/meat-monster/attack/left/${lastAttackFrame}\\.png\\?v=`),
    );
    assert.match(
      sprites.attack.right[lastAttackFrame].src,
      new RegExp(`^\\./assets/enemies/meat-monster/attack/right/${lastAttackFrame}\\.png\\?v=`),
    );
  } finally {
    if (PreviousImage === undefined) delete globalThis.Image;
    else globalThis.Image = PreviousImage;
  }
});
