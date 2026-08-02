import { hasWall } from "../world/maze.js";

const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

// Executes one locomotion action at a time. The scheduler decides *which* action
// and *when*; movement only performs the given direction: a step when the way is
// clear, otherwise an in-place turn/bump against the wall. Either way the hero
// ends up facing that direction.
export function createMovement({ world, player, cellSize, actionTime }) {
  let move = null; // { dx, dy, t } — an actual step
  let turn = null; // { t } — an in-place turn or bump against a wall
  let facing = "down";

  function start(dir) {
    const [dx0, dy0] = DIRS[dir];
    facing = dir;

    let dx = dx0;
    let dy = dy0;
    if (player.col + dx < 0 || player.col + dx >= world.width) dx = 0;
    if (player.row + dy < 0 || player.row + dy >= world.height) dy = 0;
    if (dx !== 0 && hasWall(world, player.col, player.row, dx, 0)) dx = 0;
    if (dy !== 0 && hasWall(world, player.col, player.row, 0, dy)) dy = 0;

    if (dx !== 0 || dy !== 0) move = { dx, dy, t: 0 };
    else turn = { t: 0 };
  }

  // Advance the active action; returns leftover dt when it just completed (so the
  // scheduler can carry it into the next action and keep motion smooth), else 0.
  function update(dt) {
    if (move) {
      move.t += dt;
      if (move.t >= actionTime) {
        player.col += move.dx;
        player.row += move.dy;
        const leftover = move.t - actionTime;
        move = null;
        return leftover;
      }
    } else if (turn) {
      turn.t += dt;
      if (turn.t >= actionTime) {
        const leftover = turn.t - actionTime;
        turn = null;
        return leftover;
      }
    }
    return 0;
  }

  function getPixelPosition() {
    const progress = move ? Math.min(move.t / actionTime, 1) : 0;
    return {
      x: player.col * cellSize + (move ? move.dx * cellSize * progress : 0),
      y: player.row * cellSize + (move ? move.dy * cellSize * progress : 0),
    };
  }

  return {
    start,
    update,
    getPixelPosition,
    get move() { return move; },
    get active() { return move !== null || turn !== null; },
    get facing() { return facing; },
  };
}
