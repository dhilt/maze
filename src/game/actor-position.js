import { ACTION } from "./actions/intent.js";

// Positions are measured in cells; rendering only converts them to pixels.
export function actorPosition(actor, move) {
  const progress = move?.kind === ACTION.step
    ? Math.max(0, Math.min(move.elapsed / move.timeCost, 1))
    : 0;
  return {
    x: actor.col + (move?.dx ?? 0) * progress,
    y: actor.row + (move?.dy ?? 0) * progress,
  };
}

export function actorPixelPosition(actor, move, cellSize) {
  const { x, y } = actorPosition(actor, move);
  return { x: x * cellSize, y: y * cellSize };
}
