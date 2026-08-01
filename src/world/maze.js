// Maze module — a simple thin-wall (edge) obstacle generator.
//
// Walls live on cell edges, not inside cells. They are stored canonically on
// each cell as wallRight (edge to the cell on the right) and wallDown (edge to
// the cell below). Because that single bit is shared by both neighbours, "can't
// go right from (x,y)" and "can't go left into (x,y) from (x+1,y)" are the same
// fact — no duplication, no inconsistency.
//
// The layout is not guaranteed solvable; density just controls how many edges
// become walls.

// mulberry32 — tiny seeded PRNG, so a given seed reproduces the same maze.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Place canonical walls on cell edges with probability = density/100.
//   density 0   → no walls at all
//   density 100 → every internal edge is a wall (each cell fully boxed in)
// Only right/bottom edges of interior cells are set; the outer border is already
// impassable via world bounds.
export function generateMaze(world, { density = 30, seed = world.seed } = {}) {
  const p = Math.max(0, Math.min(100, density)) / 100;
  const rand = mulberry32(seed >>> 0);

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.at(x, y);
      cell.wallRight = x < world.width - 1 && rand() < p;
      cell.wallDown = y < world.height - 1 && rand() < p;
    }
  }

  breakEnclosedCells(world, rand);
}

// Second pass: any cell walled off on all four sides is a sealed 1x1 pocket.
// Open it by clearing one random interior edge (the world perimeter can't be
// removed). Removals only ever open edges, so a single row-major pass leaves no
// fully-enclosed cell behind.
function breakEnclosedCells(world, rand) {
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (!isEnclosed(world, x, y)) continue;

      const edges = [];
      if (y > 0) edges.push("up");
      if (y < world.height - 1) edges.push("down");
      if (x > 0) edges.push("left");
      if (x < world.width - 1) edges.push("right");
      if (edges.length === 0) continue; // degenerate 1x1 world

      openEdge(world, x, y, edges[Math.floor(rand() * edges.length)]);
    }
  }
}

function isEnclosed(world, x, y) {
  return (
    hasWall(world, x, y, 0, -1) &&
    hasWall(world, x, y, 0, 1) &&
    hasWall(world, x, y, -1, 0) &&
    hasWall(world, x, y, 1, 0)
  );
}

function openEdge(world, x, y, dir) {
  if (dir === "right") world.at(x, y).wallRight = false;
  else if (dir === "left") world.at(x - 1, y).wallRight = false;
  else if (dir === "down") world.at(x, y).wallDown = false;
  else if (dir === "up") world.at(x, y - 1).wallDown = false;
}

// Is there a wall on the edge leaving (x, y) in the orthogonal step (dx, dy)?
// The world boundary is an implicit solid perimeter (all four sides). Interior
// edges read the canonical bit — left/up edges read the neighbour's right/down.
export function hasWall(world, x, y, dx, dy) {
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) return true;
  if (dx === 1) return !!world.at(x, y)?.wallRight;
  if (dx === -1) return !!world.at(x - 1, y)?.wallRight;
  if (dy === 1) return !!world.at(x, y)?.wallDown;
  if (dy === -1) return !!world.at(x, y - 1)?.wallDown;
  return false;
}
