const PHASES = 4;
const PHASE_TIME = 0.11;

export const VERSION = "0.29";

export const GAME_CONFIG = Object.freeze({
  cellSize: 64,
  viewCols: 10,
  viewRows: 7,
  worldCols: 50,
  worldRows: 50,
  cameraMargin: 2,
  phases: PHASES,
  phaseTime: PHASE_TIME,
  cellTime: PHASE_TIME * PHASES,
  debug: false,
  floorStyle: "crypt",
  worldSeed: 1,
  wallDensity: 33,
  wallSeed: null,
});
