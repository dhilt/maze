const DIRECTIONS = Object.freeze(["down", "up", "left", "right"]);
const ASSET_ROOT = "./assets/characters/knight";
const ASSET_REVISION = "knight-1";

export const KNIGHT_FRAME_COUNTS = Object.freeze({
  idle: 4,
  walk: 4,
  attack: 9,
});

export const KNIGHT_IDLE_FRAME_UNITS = 3;

// Contact is held longer so the impact remains readable without changing cost.
const ATTACK_FRAME_WEIGHTS = Object.freeze([1, 1, 1, 1, 4.5, 1, 1, 1, 1]);
const ATTACK_WEIGHT_TOTAL = ATTACK_FRAME_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

function loadImage(src) {
  const img = new Image();
  img.decoding = "async";
  img.onerror = () => console.error(`Failed to load knight sprite: ${src}`);
  img.src = src;
  return img;
}

function loadFrames(action, direction) {
  return Array.from(
    { length: KNIGHT_FRAME_COUNTS[action] },
    (_, frame) => loadImage(
      `${ASSET_ROOT}/${action}/${direction}/${frame}.png?v=${ASSET_REVISION}`,
    ),
  );
}

export function loadKnightSprites() {
  const sprites = { idle: {}, walk: {}, attack: {} };
  for (const action of Object.keys(KNIGHT_FRAME_COUNTS)) {
    for (const direction of DIRECTIONS) {
      sprites[action][direction] = loadFrames(action, direction);
    }
  }
  return sprites;
}

export function selectAttackFrame(progress, frameCount = KNIGHT_FRAME_COUNTS.attack) {
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
