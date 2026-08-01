const PHASES = 4;
const PHASE_TIME = 0.11;
const ATTACK_FRAMES = 7;
const ATTACK_FRAME_TIME = 0.09;

export const VERSION = "0.31";

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
  attackFrames: ATTACK_FRAMES,
  attackFrameTime: ATTACK_FRAME_TIME,
  attackTime: ATTACK_FRAME_TIME * ATTACK_FRAMES,
  debug: false,
  floorStyle: "crypt",
  worldSeed: 1,
  wallDensity: 33,
  wallSeed: null,
});
