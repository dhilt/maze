import { ACTION } from "../game/actions/intent.js";

// One interpolation rule for sprites and effects attached to moving actors.
export function actorPixelPosition(actor, move, cellSize) {
  const progress = move?.kind === ACTION.step
    ? Math.max(0, Math.min(move.elapsed / move.timeCost, 1))
    : 0;
  return {
    x: (actor.col + (move?.dx ?? 0) * progress) * cellSize,
    y: (actor.row + (move?.dy ?? 0) * progress) * cellSize,
  };
}
