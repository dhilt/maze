const PHASES = 4;
const ACTION_TIME = 0.5; // base action duration (seconds)

export const VERSION = "0.38";

export const GAME_CONFIG = Object.freeze({
  cellSize: 64,
  viewCols: 10,
  viewRows: 7,
  worldCols: 50,
  worldRows: 50,
  cameraMargin: 2,
  phases: PHASES,
  actionTime: ACTION_TIME, // step (cell-crossing) time; also the walk-cycle length
  // Per-action durations. A declared move is adapted to a step (actionTime) or,
  // when blocked, to an instant turn (0). Add an action's params here as it joins
  // the bus.
  actionDurations: Object.freeze({
    step: ACTION_TIME,
    turn: 0,
    attack: ACTION_TIME,
  }),
  debug: false,
  floorStyle: "crypt",
  worldSeed: 1,
  wallDensity: 33,
  wallSeed: null,
});
