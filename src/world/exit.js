import { createRandom } from "./random.js";

const EDGE_DEPTH = 2;
export const EXIT_PHASES = Object.freeze({
  HIDDEN: "hidden",
  REVEALING: "revealing",
  OPEN: "open",
});

function edgeCells(world) {
  return world.cells.filter((cell) => (
    cell.x <= EDGE_DEPTH ||
    cell.y <= EDGE_DEPTH ||
    cell.x >= world.width - 1 - EDGE_DEPTH ||
    cell.y >= world.height - 1 - EDGE_DEPTH
  ));
}

export function isExitOpen(cell) {
  return cell?.exit?.phase === EXIT_PHASES.OPEN;
}

export function getExitRevealProgress(cell, time) {
  const exit = cell?.exit;
  if (exit?.phase === EXIT_PHASES.OPEN) return 1;
  if (
    exit?.phase !== EXIT_PHASES.REVEALING ||
    !Number.isFinite(time) ||
    !Number.isFinite(exit.revealStartedAt) ||
    !Number.isFinite(exit.revealDuration) ||
    exit.revealDuration <= 0
  ) return 0;
  return Math.max(0, Math.min(1, (
    time - exit.revealStartedAt
  ) / exit.revealDuration));
}

// Marks exactly one cell in the outer three-cell band. The marker remains on
// the cell while hidden, so its position survives serialisation.
export function placeExit(world, {
  seed = world.seed,
} = {}) {
  for (const cell of world.cells) cell.exit = null;

  const candidates = edgeCells(world);
  if (candidates.length === 0) return null;

  const random = createRandom(seed >>> 0);
  const exit = candidates[Math.floor(random() * candidates.length)];
  exit.exit = {
    kind: "exit",
    phase: EXIT_PHASES.HIDDEN,
    revealStartedAt: null,
    revealDuration: null,
  };
  return exit;
}
