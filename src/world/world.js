// World module — the data model of the map and its generation.
// A cell is a plain, extensible object; the world is a flat array of cells plus
// an at(x, y) accessor. The whole thing is JSON-serialisable (save/load, editor).

// A single cell. Coordinates are its first properties; more live alongside them.
// wallRight / wallDown store thin edge-walls canonically: the wall on the right
// of (x, y) is the very same wall as the left of (x+1, y), so the two adjacent
// cells can never disagree. Populated by the maze generator (maze.js).
function createCell(x, y) {
  return {
    x,
    y,
    wallRight: false,
    wallDown: false,
    exit: false,
    // Cell-local, serialisable object data. Rendering layer and interactivity are
    // properties of each future object, not separate containers on the cell.
    objects: [],
  };
}

// Explicit world generation — runs once at startup and returns the full world
// structure in an extensible, serialisable format. Add per-cell data in
// createCell(), or populate regions/objects in a pass over `cells` below.
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
