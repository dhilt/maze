import { hasWall } from "../world/maze.js";

export function createMovement({ world, player, input, cellSize, cellTime }) {
  let move = null;
  let facing = "down";

  function startMoveIfInput() {
    const { dx: intentDx, dy: intentDy } = input.getDirection();

    // Turn to face the intended direction even if it is blocked — this lets the
    // hero face a wall from rest without stepping into it.
    if (intentDx !== 0) facing = intentDx > 0 ? "right" : "left";
    else if (intentDy !== 0) facing = intentDy > 0 ? "down" : "up";

    let dx = intentDx;
    let dy = intentDy;
    if (player.col + dx < 0 || player.col + dx >= world.width) dx = 0;
    if (player.row + dy < 0 || player.row + dy >= world.height) dy = 0;
    if (dx !== 0 && hasWall(world, player.col, player.row, dx, 0)) dx = 0;
    if (dy !== 0 && hasWall(world, player.col, player.row, 0, dy)) dy = 0;
    if (dx === 0 && dy === 0) return;

    move = { dx, dy, t: 0 };
  }

  function update(dt, { stopAtBoundary = false } = {}) {
    if (!move) {
      if (stopAtBoundary) return;
      startMoveIfInput();
      if (!move) return;
    }

    move.t += dt;
    while (move && move.t >= cellTime) {
      player.col += move.dx;
      player.row += move.dy;
      const leftover = move.t - cellTime;
      move = null;
      if (stopAtBoundary) break;
      startMoveIfInput();
      if (move) move.t = leftover;
    }
  }

  function getPixelPosition() {
    const progress = move ? Math.min(move.t / cellTime, 1) : 0;
    return {
      x: player.col * cellSize + (move ? move.dx * cellSize * progress : 0),
      y: player.row * cellSize + (move ? move.dy * cellSize * progress : 0),
    };
  }

  return {
    update,
    getPixelPosition,
    get move() { return move; },
    get isIdle() { return move === null; },
    get facing() { return facing; },
  };
}
