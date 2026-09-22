import assert from "node:assert/strict";
import test from "node:test";

import { ATTACK_CONTACT_PROGRESS } from "../src/game/actions/attack-timing.js";
import { selectAttackFrame } from "../src/rendering/character/knight-sprites.js";
import { selectMeatMonsterAttackFrame } from "../src/rendering/meat-monster-sprites.js";

test("hero and meat monster display their contact poses at the shared peak", () => {
  assert.equal(selectAttackFrame(ATTACK_CONTACT_PROGRESS), 5);
  assert.equal(selectMeatMonsterAttackFrame({
    elapsed: 5 * ATTACK_CONTACT_PROGRESS,
    timeCost: 5,
  }), 4);
});
