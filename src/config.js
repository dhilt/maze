const PHASES = 4;
const SECONDS_PER_TIME_UNIT = 0.1;

export const VERSION = "0.41";

export const GAME_CONFIG = Object.freeze({
  cellSize: 64,
  viewCols: 10,
  viewRows: 7,
  worldCols: 50,
  worldRows: 50,
  cameraMargin: 2,
  phases: PHASES,
  // Physical seconds are converted to logical game-time units before they reach
  // the action bus. At normal speed 1 unit lasts 100 ms.
  gameTime: Object.freeze({
    secondsPerUnit: SECONDS_PER_TIME_UNIT,
    speed: 1,
  }),
  // Integer costs in logical game-time units. A blocked move toward a new facing
  // resolves to a turn; repeating the current facing is a cancelled no-op.
  actionCosts: Object.freeze({
    step: 5,
    turn: 1,
    attack: 5,
  }),
  // Time-based effects. Health drains by 1 every `drainInterval` game-time units
  // (real-time — it ticks whether or not the hero is acting). A character may
  // override this via its own healthDrainInterval.
  health: Object.freeze({
    drainInterval: 100,
  }),
  debug: false,
  floorStyle: "crypt",
  worldSeed: 1,
  wallDensity: 33,
  wallSeed: null,
});
