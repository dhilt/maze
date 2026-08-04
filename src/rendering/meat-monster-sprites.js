const DIRECTIONS = Object.freeze(["down", "up", "left", "right"]);
const ATTACK_DIRECTIONS = DIRECTIONS;
const ASSET_ROOT = "./assets/enemies/meat-monster";
const ASSET_REVISION = "meat-monster-1";

export const MEAT_MONSTER_WALK_FRAME_COUNT = 4;
export const MEAT_MONSTER_ATTACK_FRAME_COUNT = 8;

// The lunge arrives quickly and holds the flattened bite pose long enough to
// read at the monster's five-unit attack duration.
const ATTACK_FRAME_WEIGHTS = Object.freeze([130, 85, 55, 45, 155, 60, 90, 130]);
const ATTACK_WEIGHT_TOTAL = ATTACK_FRAME_WEIGHTS.reduce(
  (sum, weight) => sum + weight,
  0,
);

function loadImage(src) {
  const img = new Image();
  img.decoding = "async";
  img.onerror = () => console.error(`Failed to load meat monster sprite: ${src}`);
  img.src = src;
  return img;
}

export function loadMeatMonsterSprites() {
  const sprites = { walk: {}, attack: {} };
  for (const direction of DIRECTIONS) {
    sprites.walk[direction] = Array.from(
      { length: MEAT_MONSTER_WALK_FRAME_COUNT },
      (_, frame) => loadImage(
        `${ASSET_ROOT}/walk/${direction}/${frame}.png?v=${ASSET_REVISION}`,
      ),
    );
  }
  for (const direction of ATTACK_DIRECTIONS) {
    sprites.attack[direction] = Array.from(
      { length: MEAT_MONSTER_ATTACK_FRAME_COUNT },
      (_, frame) => loadImage(
        `${ASSET_ROOT}/attack/${direction}/${frame}.png?v=${ASSET_REVISION}`,
      ),
    );
  }
  return sprites;
}

export function selectMeatMonsterWalkFrame(
  move,
  frameCount = MEAT_MONSTER_WALK_FRAME_COUNT,
) {
  const count = Math.max(1, Math.floor(frameCount));
  if (move?.kind !== "step") return 0;
  const progress = Math.min(
    Math.max(move.elapsed / move.timeCost, 0),
    0.999999,
  );
  return Math.floor(progress * count);
}

export function selectMeatMonsterAttackFrame(
  attack,
  frameCount = MEAT_MONSTER_ATTACK_FRAME_COUNT,
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
