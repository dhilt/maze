import { hasWall } from "../../world/maze.js";

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const DIR_IDS = Object.keys(DIRS);

export const ACTION = Object.freeze({
  face: "face",
  step: "step",
  attack: "attack",
  eat: "eat",
  engage: "engage", // target-aware automatic face or attack, never a step
});

export function directionToAdjacent(from, to) {
  const dx = to.col - from.col;
  const dy = to.row - from.row;
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 0 && dy === -1) return "up";
  return null;
}

// Desired direction → face, step, attack, or null.
// towardBlocked: the hero will face a wall; a beast ignores that side.
// cell(toCol, toRow): "hostile" | "blocked" | null (open).
export function resolveIntent({ actor, desired, world, towardBlocked, cell }) {
  const dir = DIRS[desired];
  const blocked = hasWall(world, actor.col, actor.row, dir.dx, dir.dy);
  if (actor.facing !== desired) {
    return blocked && !towardBlocked ? null : {
      kind: ACTION.face,
      dx: 0,
      dy: 0,
      timeCost: actor.actionCosts.face,
      facing: desired,
    };
  }
  if (blocked) return null;

  const toCol = actor.col + dir.dx;
  const toRow = actor.row + dir.dy;
  const hit = cell?.(toCol, toRow);
  if (hit === "hostile") {
    return {
      kind: ACTION.attack,
      dx: 0,
      dy: 0,
      timeCost: actor.actionCosts.attack,
      facing: null,
      targetCell: { col: toCol, row: toRow },
    };
  }
  if (hit === "blocked") return null;
  return {
    kind: ACTION.step,
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
  if (move?.kind !== ACTION.step) return actor.col === toCol && actor.row === toRow;
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
