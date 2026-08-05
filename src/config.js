export const VERSION = "0.69";

// Physical seconds are converted to logical game-time units before they reach
// the action bus. At normal speed 1 unit lasts 50 ms.
const GAME_TIME = Object.freeze({
  secondsPerUnit: 0.04,
  speed: 1,
});

export const GAME_CONFIG = Object.freeze({
  cellSize: 64,
  viewCols: 10,
  viewRows: 7,
  cameraMargin: 2,
  gameTime: GAME_TIME,
  debug: false,
  floorStyle: "crypt",
  worldSeed: 1,
  wallDensity: 33,
  wallSeed: null,
  baseWallHealth: 20,
  baseWallDefense: 2,
  wallImpactWear: 1,
});
