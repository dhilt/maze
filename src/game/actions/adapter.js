import { CORPSE_KIND } from "../../world/corpse.js";
import { getWall, hasWall } from "../../world/maze.js";

const DIRS = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

// The adapter turns a DESIRED action into the CONCRETE action to execute, judged
// against the live world/player state right before it runs. It may:
//   * pass through   — "attack" → an attack;
//   * transform      — a move into a wall → a one-unit turn/bump, or an attack
//                      facing a stored wall → a wallAttack;
//   * cancel         — return null, and the scheduler drops it from the queue.
// Every concrete action carries an integer timeCost in logical game-time units.
export function createActionAdapter({
  world,
  player,
  character,
  costs,
  findEntryBlocker = () => null,
}) {
  function attackCell(col, row) {
    return {
      kind: "attack",
      dx: 0,
      dy: 0,
      timeCost: costs.attack,
      facing: null,
      targetCell: { col, row },
    };
  }

  function adapt(desired) {
    if (desired === "consume") {
      const cell = world.at(player.col, player.row);
      const corpse = cell?.objects.find(({ kind }) => kind === CORPSE_KIND) ?? null;
      if (
        corpse === null ||
        !character ||
        character.stats.morale <= 0 ||
        character.stats.health >= character.statsMax.health
      ) return null;
      return {
        kind: "consume",
        timeCost: costs.consume,
        target: {
          col: player.col,
          row: player.row,
          corpseId: corpse.id,
          entityId: corpse.entityId,
        },
      };
    }

    if (desired === "attack") {
      const [dx, dy] = DIRS[player.facing] ?? [0, 0];
      if (getWall(world, player.col, player.row, dx, dy) !== null) {
        return {
          kind: "wallAttack",
          dx: 0,
          dy: 0,
          timeCost: costs.attack,
          facing: null,
          target: { x: player.col, y: player.row, dx, dy },
        };
      }
      const col = player.col + dx;
      const row = player.row + dy;
      return attackCell(col, row);
    }

    const [dx0, dy0] = DIRS[desired];
    let dx = dx0;
    let dy = dy0;
    if (player.col + dx < 0 || player.col + dx >= world.width) dx = 0;
    if (player.row + dy < 0 || player.row + dy >= world.height) dy = 0;
    if (dx !== 0 && hasWall(world, player.col, player.row, dx, 0)) dx = 0;
    if (dy !== 0 && hasWall(world, player.col, player.row, 0, dy)) dy = 0;
    const blocker = (dx !== 0 || dy !== 0)
      ? findEntryBlocker(player.col, player.row, player.col + dx, player.row + dy)
      : null;
    if (blocker !== null && player.facing === desired) {
      return attackCell(player.col + dx, player.row + dy);
    }
    if (blocker !== null) {
      dx = 0;
      dy = 0;
    }

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
