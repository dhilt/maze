const PHASES = 4;
const ACTION_TIME = 0.5; // unified duration of every character action (seconds)

export const VERSION = "0.36";

export const GAME_CONFIG = Object.freeze({
  cellSize: 64,
  viewCols: 10,
  viewRows: 7,
  worldCols: 50,
  worldRows: 50,
  cameraMargin: 2,
  phases: PHASES,
  actionTime: ACTION_TIME,
  debug: false,
  floorStyle: "crypt",
  worldSeed: 1,
  wallDensity: 33,
  wallSeed: null,
});
