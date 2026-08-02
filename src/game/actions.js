import { hasWall } from "../world/maze.js";

const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

// The adapter turns a DESIRED action into the CONCRETE action to execute, judged
// against the live world/player state right before it runs. It may:
//   * pass through   — "attack" → an attack;
//   * transform      — a move into a wall → an instant turn/bump;
//   * cancel         — return null, and the scheduler drops it from the queue.
export function createActionAdapter({ world, player, durations }) {
  function adapt(desired) {
    if (desired === "attack") {
      return { kind: "attack", dx: 0, dy: 0, duration: durations.attack, facing: null };
    }

    const [dx0, dy0] = DIRS[desired];
    let dx = dx0;
    let dy = dy0;
    if (player.col + dx < 0 || player.col + dx >= world.width) dx = 0;
    if (player.row + dy < 0 || player.row + dy >= world.height) dy = 0;
    if (dx !== 0 && hasWall(world, player.col, player.row, dx, 0)) dx = 0;
    if (dy !== 0 && hasWall(world, player.col, player.row, 0, dy)) dy = 0;

    if (dx !== 0 || dy !== 0) {
      return { kind: "step", dx, dy, duration: durations.step, facing: desired };
    }
    // Transformed: a blocked move becomes an instant in-place turn/bump.
    return { kind: "turn", dx: 0, dy: 0, duration: durations.turn, facing: desired };
  }

  return { adapt };
}
