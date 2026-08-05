import { KNIGHT_ASSET_PACK } from "../../assets/packs/knight.js";

export const KNIGHT_IDLE_FRAME_UNITS = 6;

// Contact is held longer so the impact remains readable without changing cost.
const ATTACK_FRAME_WEIGHTS = Object.freeze([1, 1, 1, 1, 4.5, 1, 1, 1, 1]);
const ATTACK_WEIGHT_TOTAL = ATTACK_FRAME_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

export function selectAttackFrame(
  progress,
  frameCount = KNIGHT_ASSET_PACK.animations.attack.frames,
) {
  const count = Math.max(1, Math.floor(frameCount));
  const boundedProgress = Math.min(
    Math.max(Number.isFinite(progress) ? progress : 0, 0),
    0.999999,
  );
  if (count !== ATTACK_FRAME_WEIGHTS.length) {
    return Math.floor(boundedProgress * count);
  }

  let remaining = boundedProgress * ATTACK_WEIGHT_TOTAL;
  for (let frame = 0; frame < ATTACK_FRAME_WEIGHTS.length; frame += 1) {
    if (remaining < ATTACK_FRAME_WEIGHTS[frame]) return frame;
    remaining -= ATTACK_FRAME_WEIGHTS[frame];
  }
  return count - 1;
}
