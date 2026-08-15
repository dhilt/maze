import { MEAT_MONSTER_ASSET_PACK } from "../assets/packs/meat-monster.js";
import { ACTION } from "../game/actions/intent.js";

// The lunge arrives quickly and holds the flattened bite pose long enough to
// read relative to the monster's configured attack duration.
const ATTACK_FRAME_WEIGHTS = Object.freeze([130, 85, 55, 45, 155, 60, 90, 130]);
const ATTACK_WEIGHT_TOTAL = ATTACK_FRAME_WEIGHTS.reduce(
  (sum, weight) => sum + weight,
  0,
);

export function selectMeatMonsterWalkFrame(
  move,
  frameCount = MEAT_MONSTER_ASSET_PACK.animations.walk.frames,
) {
  const count = Math.max(1, Math.floor(frameCount));
  if (move?.kind !== ACTION.step) return 0;
  const progress = Math.min(
    Math.max(move.elapsed / move.timeCost, 0),
    0.999999,
  );
  return Math.floor(progress * count);
}

export function selectMeatMonsterAttackFrame(
  attack,
  frameCount = MEAT_MONSTER_ASSET_PACK.animations.attack.frames,
) {
  const count = Math.max(1, Math.floor(frameCount));
  if (!attack || !Number.isFinite(attack.timeCost) || attack.timeCost <= 0) return 0;
  const progress = Math.min(
    Math.max(attack.elapsed / attack.timeCost, 0),
    0.999999,
  );
  if (count !== ATTACK_FRAME_WEIGHTS.length) {
    return Math.floor(progress * count);
  }

  let remaining = progress * ATTACK_WEIGHT_TOTAL;
  for (let frame = 0; frame < ATTACK_FRAME_WEIGHTS.length; frame += 1) {
    if (remaining < ATTACK_FRAME_WEIGHTS[frame]) return frame;
    remaining -= ATTACK_FRAME_WEIGHTS[frame];
  }
  return count - 1;
}
