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
//   * transform      — a new direction → a one-unit turn, or an attack facing
//                      a stored wall → a wallAttack;
//   * cancel         — return null, and the scheduler drops it from the queue.
// Every concrete action carries an integer timeCost in logical game-time units.
export function createActionAdapter({
  world,
  player,
  character,
  findEntryBlocker = () => null,
  findEntityById = () => null,
  onActionRejected,
}) {
  if (!character?.actionCosts) {
    throw new Error("Action adapter requires character action costs");
  }
  function attackCell(col, row) {
    return {
      kind: "attack",
      dx: 0,
      dy: 0,
      timeCost: character.actionCosts.attack,
      facing: null,
      targetCell: { col, row },
    };
  }

  function adapt(desired) {
    if (desired === "consume") {
      const cell = world.at(player.col, player.row);
      if (!character || character.stats.health >= character.statsMax.health) return null;

      // Several monsters may die on the same cell. Pick the first carcass the
      // hero can actually afford instead of letting another corpse mask it.
      let target = null;
      let blockedByMorale = false;
      for (const corpse of cell?.objects ?? []) {
        if (corpse.kind !== CORPSE_KIND) continue;
        const entity = findEntityById(corpse.entityId);
        if (entity === null) continue;
        const moraleCost = entity.carcass?.moraleCost;
        if (!Number.isFinite(moraleCost) || moraleCost < 0) {
          throw new Error("Consumed entity carcass.moraleCost must be a non-negative number");
        }
        if (character.stats.morale >= moraleCost) {
          target = { corpse, entity };
          break;
        }
        blockedByMorale = true;
      }
      if (target === null) {
        if (blockedByMorale) {
          onActionRejected?.({ action: "consume", reason: "morale" });
        }
        return null;
      }
      return {
        kind: "consume",
        timeCost: character.actionCosts.consume,
        target: {
          col: player.col,
          row: player.row,
          corpseId: target.corpse.id,
          entityId: target.entity.id,
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
          timeCost: character.actionCosts.attack,
          facing: null,
          target: { x: player.col, y: player.row, dx, dy },
        };
      }
      const col = player.col + dx;
      const row = player.row + dy;
      return attackCell(col, row);
    }

    const [dx0, dy0] = DIRS[desired];
    // A direction change is always its own action, even on a clear path. A
    // second press or a confirmed hold resolves after facing has changed.
    if (player.facing !== desired) {
      return {
        kind: "turn",
        dx: 0,
        dy: 0,
        timeCost: character.actionCosts.turn,
        facing: desired,
      };
    }

    let dx = dx0;
    let dy = dy0;
    if (player.col + dx < 0 || player.col + dx >= world.width) dx = 0;
    if (player.row + dy < 0 || player.row + dy >= world.height) dy = 0;
    if (dx !== 0 && hasWall(world, player.col, player.row, dx, 0)) dx = 0;
    if (dy !== 0 && hasWall(world, player.col, player.row, 0, dy)) dy = 0;
    const blocker = (dx !== 0 || dy !== 0)
      ? findEntryBlocker(player.col, player.row, player.col + dx, player.row + dy)
      : null;
    if (blocker !== null) {
      return attackCell(player.col + dx, player.row + dy);
    }

    if (dx !== 0 || dy !== 0) {
      return {
        kind: "step",
        dx,
        dy,
        timeCost: character.actionCosts.step,
        facing: desired,
      };
    }
    // Looking into the same obstruction changes no actor state. Drop that intent
    // without occupying the action bus; continuous world time still advances.
    return null;
  }

  return { adapt };
}
