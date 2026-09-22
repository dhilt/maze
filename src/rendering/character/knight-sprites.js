import { KNIGHT_ASSET_PACK } from "../../assets/packs/knight.js";

export const KNIGHT_IDLE_FRAME_UNITS = 6;

// Relative durations from the approved pixel64 clips: fast approach, held
// contact (frame 5), then recovery. Scale to the action's unchanged time cost.
const ATTACK_FRAME_WEIGHTS = Object.freeze([150, 70, 60, 50, 50, 160, 70, 70, 110, 220]);
const ATTACK_WEIGHT_TOTAL = ATTACK_FRAME_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

// Travel weights tied to the planted-foot poses. Hold still at contact;
// return with the recovery instead of sliding in place.
const ATTACK_STEP_WEIGHTS = Object.freeze([0, 0, 1, 3, 5, 6, 6, 3, 0, 0]);
// Native 64px distances leave two clear pixels at the facing edge at contact.
const ATTACK_LUNGES = Object.freeze({
  down: { dx: 0, dy: 1, pixels: 6 },
  up: { dx: 0, dy: -1, pixels: 14 },
  left: { dx: -1, dy: 0, pixels: 10 },
  right: { dx: 1, dy: 0, pixels: 10 },
});

export function getKnightAttackOffset(facing, frame, cellSize = 64) {
  const lunge = ATTACK_LUNGES[facing];
  const weight = ATTACK_STEP_WEIGHTS[frame] ?? 0;
  if (!lunge || !weight) return { x: 0, y: 0 };
  const distance = Math.round(lunge.pixels * weight / 6 * cellSize / 64);
  if (!distance) return { x: 0, y: 0 };
  return { x: lunge.dx * distance, y: lunge.dy * distance };
}

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

export function selectConsumeFrame(
  progress,
  frameCount = KNIGHT_ASSET_PACK.animations.consume.frames,
) {
  const count = Math.max(1, Math.floor(frameCount));
  const boundedProgress = Math.min(
    Math.max(Number.isFinite(progress) ? progress : 0, 0),
    0.999999,
  );
  return Math.floor(boundedProgress * count);
}
