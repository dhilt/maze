import { hasWall } from "../world/maze.js";

export function createMovement({ world, player, input, cellSize, cellTime }) {
  let move = null;
  let facing = "down";

  function startMoveIfInput() {
    let { dx, dy } = input.getDirection();

    if (player.col + dx < 0 || player.col + dx >= world.width) dx = 0;
    if (player.row + dy < 0 || player.row + dy >= world.height) dy = 0;
    if (dx !== 0 && hasWall(world, player.col, player.row, dx, 0)) dx = 0;
    if (dy !== 0 && hasWall(world, player.col, player.row, 0, dy)) dy = 0;
    if (dx === 0 && dy === 0) return;

    move = { dx, dy, t: 0 };
    if (dx !== 0) facing = dx > 0 ? "right" : "left";
    else facing = dy > 0 ? "down" : "up";
  }

  function update(dt) {
    if (!move) {
      startMoveIfInput();
      if (!move) return;
    }

    move.t += dt;
    while (move && move.t >= cellTime) {
      player.col += move.dx;
      player.row += move.dy;
      const leftover = move.t - cellTime;
      move = null;
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
    get facing() { return facing; },
  };
}
