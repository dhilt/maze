import { CORPSE_KIND } from "../../world/corpse.js";
import { getWall } from "../../world/maze.js";
import { ACTION, DIRS, directionToAdjacent, resolveIntent } from "./intent.js";

// The adapter turns a DESIRED action into the CONCRETE action to execute, judged
// against the live world/player state right before it runs. It may:
//   * pass through   — "attack" → an attack;
//   * transform      — a new direction → a face, or an attack facing
//                      a stored wall → an attack with a wall target;
//   * cancel         — return null, and the scheduler drops it from the queue.
// Every concrete action carries an integer timeCost in logical game-time units.
export function createActionAdapter({
  world,
  player,
  character,
  findEntryBlocker,
  findEntityById,
  onActionRejected,
}) {
  function adapt(desired) {
    if (desired?.kind === ACTION.engage) {
      const target = findEntityById(desired.targetId);
      if (!target || target.stats.health <= 0) return null;
      const direction = directionToAdjacent(player, target);
      if (direction === null) return null;
      const { dx, dy } = DIRS[direction];
      if (getWall(world, player.col, player.row, dx, dy) !== null) return null;
      if (player.facing !== direction) {
        return {
          kind: ACTION.face,
          dx: 0,
          dy: 0,
          timeCost: character.actionCosts.face,
          facing: direction,
        };
      }
      return {
        kind: ACTION.attack,
        dx: 0,
        dy: 0,
        timeCost: character.actionCosts.attack,
        facing: null,
        targetCell: { col: target.col, row: target.row },
      };
    }

    if (desired === ACTION.eat) {
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
          onActionRejected?.({ action: ACTION.eat, reason: "morale" });
        }
        return null;
      }
      return {
        kind: ACTION.eat,
        timeCost: character.actionCosts.eat,
        target: {
          col: player.col,
          row: player.row,
          corpseId: target.corpse.id,
          entityId: target.entity.id,
        },
      };
    }

    if (desired === ACTION.attack) {
      const { dx, dy } = DIRS[player.facing] ?? { dx: 0, dy: 0 };
      if (getWall(world, player.col, player.row, dx, dy) !== null) {
        return {
          kind: ACTION.attack,
          dx: 0,
          dy: 0,
          timeCost: character.actionCosts.attack,
          facing: null,
          target: { x: player.col, y: player.row, dx, dy },
        };
      }
      return {
        kind: ACTION.attack,
        dx: 0,
        dy: 0,
        timeCost: character.actionCosts.attack,
        facing: null,
        targetCell: { col: player.col + dx, row: player.row + dy },
      };
    }

    return resolveIntent({
      actor: {
        col: player.col,
        row: player.row,
        facing: player.facing,
        actionCosts: character.actionCosts,
      },
      desired,
      world,
      towardBlocked: true,
      cell: (col, row) => (
        findEntryBlocker(player.col, player.row, col, row) ? "hostile" : null
      ),
    });
  }

  return { adapt };
}
