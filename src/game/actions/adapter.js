import { hasWall } from "../../world/maze.js";

const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

// The adapter turns a DESIRED action into the CONCRETE action to execute, judged
// against the live world/player state right before it runs. It may:
//   * pass through   — "attack" → an attack;
//   * transform      — a move into a wall → a one-unit turn/bump;
//   * cancel         — return null, and the scheduler drops it from the queue.
// Every concrete action carries an integer timeCost in logical game-time units.
export function createActionAdapter({ world, player, costs }) {
  function adapt(desired) {
    if (desired === "attack") {
      return { kind: "attack", dx: 0, dy: 0, timeCost: costs.attack, facing: null };
    }

    const [dx0, dy0] = DIRS[desired];
    let dx = dx0;
    let dy = dy0;
    if (player.col + dx < 0 || player.col + dx >= world.width) dx = 0;
    if (player.row + dy < 0 || player.row + dy >= world.height) dy = 0;
    if (dx !== 0 && hasWall(world, player.col, player.row, dx, 0)) dx = 0;
    if (dy !== 0 && hasWall(world, player.col, player.row, 0, dy)) dy = 0;

    if (dx !== 0 || dy !== 0) {
      return { kind: "step", dx, dy, timeCost: costs.step, facing: desired };
    }
    // Looking into the same obstruction changes no actor state. Drop that intent
    // without occupying the action bus; continuous world time still advances.
    if (player.facing === desired) return null;
    // Transformed: a blocked move becomes a short in-place turn/bump.
    return { kind: "turn", dx: 0, dy: 0, timeCost: costs.turn, facing: desired };
  }

  return { adapt };
}
