import { createRandom } from "./random.js";

const EDGE_DEPTH = 2;

function edgeCells(world) {
  return world.cells.filter((cell) => (
    cell.x <= EDGE_DEPTH ||
    cell.y <= EDGE_DEPTH ||
    cell.x >= world.width - 1 - EDGE_DEPTH ||
    cell.y >= world.height - 1 - EDGE_DEPTH
  ));
}

// Marks exactly one cell in the outer three-cell band: the perimeter plus two
// cells inward. Walls and reachability are deliberately irrelevant, so an exit
// may belong to an inaccessible region. Existing markers are cleared first.
export function placeExit(world, {
  seed = world.seed,
} = {}) {
  for (const cell of world.cells) cell.exit = false;

  const candidates = edgeCells(world);
  if (candidates.length === 0) return null;

  const random = createRandom(seed >>> 0);
  const exit = candidates[Math.floor(random() * candidates.length)];
  exit.exit = true;
  return exit;
}
