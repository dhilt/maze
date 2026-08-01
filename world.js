// World module — the data model of the map and its generation.
// A cell is a plain, extensible object; the world is a flat array of cells plus
// an at(x, y) accessor. The whole thing is JSON-serialisable (save/load, editor).

import { DEFAULT_TERRAIN } from "./terrain.js";

// A single cell. Coordinates are its first properties; more live alongside them.
// wallRight / wallDown store thin edge-walls canonically: the wall on the right
// of (x, y) is the very same wall as the left of (x+1, y), so the two adjacent
// cells can never disagree. Populated by the maze generator (maze.js).
function createCell(x, y) {
  return { x, y, terrain: DEFAULT_TERRAIN, wallRight: false, wallDown: false };
}

// Explicit world generation — runs once at startup and returns the full world
// structure in an extensible format. No landscape algorithm yet: every cell gets
// the default terrain. The single place to add generation later is createCell()
// (per-cell) or a pass over `cells` below (region/noise based).
export function generateWorld({ width, height, seed = 1 }) {
  const cells = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells[y * width + x] = createCell(x, y);
    }
  }

  return {
    width,
    height,
    seed, // kept for reproducible generation once an algorithm is added
    cells,
    at(x, y) {
      if (x < 0 || x >= width || y < 0 || y >= height) return null;
      return cells[y * width + x];
    },
  };
}
