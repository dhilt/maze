export const VERSION = "0.60";

// Physical seconds are converted to logical game-time units before they reach
// the action bus. At normal speed 1 unit lasts 100 ms.
const GAME_TIME = Object.freeze({
  secondsPerUnit: 0.1,
  speed: 1,
});

// Integer costs in logical game-time units. A blocked move toward a new facing
// resolves to a turn; repeating the current facing is a cancelled no-op.
const ACTION_COSTS = Object.freeze({
  step: 5,
  turn: 1,
  attack: 5,
});

const ENEMIES = Object.freeze({
  meatMonster: Object.freeze({ count: 8, stepCost: 8 }),
});

export const GAME_CONFIG = Object.freeze({
  cellSize: 64,
  viewCols: 10,
  viewRows: 7,
  worldCols: 50,
  worldRows: 50,
  cameraMargin: 2,
  gameTime: GAME_TIME,
  actionCosts: ACTION_COSTS,
  enemies: ENEMIES,
  debug: false,
  floorStyle: "crypt",
  worldSeed: 1,
  wallDensity: 33,
  wallSeed: null,
  baseWallHealth: 20,
  baseWallDefense: 2,
  wallImpactWear: 1,
});
