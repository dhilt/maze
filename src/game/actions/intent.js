import { hasWall } from "../../world/maze.js";

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const DIR_IDS = Object.keys(DIRS);

// Desired direction → turn, step, attack, or null.
// towardBlocked: the hero will face a wall; a beast ignores that side.
// cell(toCol, toRow): "attack" | "block" | null (open).
export function resolveIntent({ actor, desired, world, towardBlocked, cell }) {
  const dir = DIRS[desired];
  const blocked = hasWall(world, actor.col, actor.row, dir.dx, dir.dy);
  if (actor.facing !== desired) {
    return blocked && !towardBlocked ? null : {
      kind: "turn",
      dx: 0,
      dy: 0,
      timeCost: actor.actionCosts.turn,
      facing: desired,
    };
  }
  if (blocked) return null;

  const toCol = actor.col + dir.dx;
  const toRow = actor.row + dir.dy;
  const hit = cell?.(toCol, toRow);
  if (hit === "attack") {
    return {
      kind: "attack",
      dx: 0,
      dy: 0,
      timeCost: actor.actionCosts.attack,
      facing: null,
      targetCell: { col: toCol, row: toRow },
    };
  }
  if (hit === "block") return null;
  return {
    kind: "step",
    dx: dir.dx,
    dy: dir.dy,
    timeCost: actor.actionCosts.step,
    facing: desired,
  };
}

// A step reserves its destination. The vacated source is enterable unless the
// other actor is stepping into this one — that would be a head-on swap.
export function actorBlocksEntry(actor, fromCol, fromRow, toCol, toRow) {
  const move = actor.move;
  if (move?.kind !== "step") return actor.col === toCol && actor.row === toRow;
  const targetCol = actor.col + move.dx;
  const targetRow = actor.row + move.dy;
  if (targetCol === toCol && targetRow === toRow) return true;
  return (
    actor.col === toCol &&
    actor.row === toRow &&
    targetCol === fromCol &&
    targetRow === fromRow
  );
}
