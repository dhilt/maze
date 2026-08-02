// Maze module — a simple thin-wall (edge) obstacle generator.
//
// Walls live on cell edges, not inside cells. They are stored canonically on
// each cell as nullable wallRight (edge to the cell on the right) and wallDown
// (edge to the cell below) objects. Because that single object is shared by
// both neighbours, "can't go right from (x,y)" and "can't go left into
// (x,y) from (x+1,y)" are the same fact — no duplication, no inconsistency.
//
// The layout is not guaranteed solvable; density just controls how many edges
// become walls.

import { createRandom } from "./random.js";

const INFINITE_STATS = Object.freeze({ health: Infinity, defense: Infinity });

// Runtime sentinel for the implicit perimeter. Infinity needs an explicit
// save/load codec because JSON itself serialises it as null.
export const INDESTRUCTIBLE_WALL = Object.freeze({
  kind: "wall",
  material: "stone",
  stats: INFINITE_STATS,
  statsMax: INFINITE_STATS,
  impactWear: 1,
});

function positiveStat(value, name, { allowInfinity = false } = {}) {
  if (value <= 0 || (!Number.isFinite(value) && !(allowInfinity && value === Infinity))) {
    throw new Error(`${name} must be a positive number${allowInfinity ? " or Infinity" : ""}`);
  }
  return value === Infinity ? value : Math.max(1, Math.round(value));
}

function nonNegativeStat(value, name, { allowInfinity = false } = {}) {
  if (value < 0 || (!Number.isFinite(value) && !(allowInfinity && value === Infinity))) {
    throw new Error(`${name} must be a non-negative number${allowInfinity ? " or Infinity" : ""}`);
  }
  return value === Infinity ? value : Math.max(0, Math.round(value));
}

function variedHealth(rand, health) {
  if (health === Infinity) return Infinity;
  // Seeded construction quality varies by ±25% around one health baseline.
  const quality = 0.75 + rand() * 0.5;
  return Math.max(1, Math.round(health * quality));
}

export function createWall({ health, defense, impactWear, material = "stone" }) {
  const concreteHealth = positiveStat(health, "wall health", { allowInfinity: true });
  const concreteDefense = nonNegativeStat(defense, "wall defense", { allowInfinity: true });
  if (!Number.isFinite(impactWear) || impactWear < 0) {
    throw new Error("wall impactWear must be a non-negative number");
  }
  if (typeof material !== "string" || material.length === 0) {
    throw new Error("wall material must be a non-empty string");
  }
  return {
    kind: "wall",
    material,
    stats: { health: concreteHealth, defense: concreteDefense },
    statsMax: { health: concreteHealth, defense: concreteDefense },
    impactWear,
  };
}

// Place canonical walls on cell edges with probability = density/100.
//   density 0   → no walls at all
//   density 100 → every internal edge is a wall (each cell fully boxed in)
// Only right/bottom edges of interior cells are set; the outer border is already
// impassable via world bounds.
export function generateMaze(world, {
  density = 30,
  seed = world.seed,
  baseHealth,
  defense,
  impactWear,
} = {}) {
  const p = Math.max(0, Math.min(100, density)) / 100;
  const rand = createRandom(seed >>> 0);
  // A separate stream keeps wall placement stable when quality generation
  // changes and makes wall health reproducible for a fixed maze seed.
  const healthRand = createRandom((seed ^ 0xa511e9b3) >>> 0);
  const initialHealth = positiveStat(baseHealth, "baseHealth", { allowInfinity: true });
  const initialDefense = nonNegativeStat(defense, "defense", { allowInfinity: true });
  if (!Number.isFinite(impactWear) || impactWear < 0) {
    throw new Error("impactWear must be a non-negative number");
  }

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.at(x, y);
      cell.wallRight = x < world.width - 1 && rand() < p
        ? createWall({
            health: variedHealth(healthRand, initialHealth),
            defense: initialDefense,
            impactWear,
          })
        : null;
      cell.wallDown = y < world.height - 1 && rand() < p
        ? createWall({
            health: variedHealth(healthRand, initialHealth),
            defense: initialDefense,
            impactWear,
          })
        : null;
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
  if (dir === "right") world.at(x, y).wallRight = null;
  else if (dir === "left") world.at(x - 1, y).wallRight = null;
  else if (dir === "down") world.at(x, y).wallDown = null;
  else if (dir === "up") world.at(x, y - 1).wallDown = null;
}

// Resolve an orthogonal edge to its single canonical storage slot. The world
// perimeter has no slot: it remains an implicit, indestructible boundary.
function wallSlot(world, x, y, dx, dy) {
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) return null;
  if (dx === 1 && dy === 0) return { cell: world.at(x, y), key: "wallRight" };
  if (dx === -1 && dy === 0) return { cell: world.at(x - 1, y), key: "wallRight" };
  if (dx === 0 && dy === 1) return { cell: world.at(x, y), key: "wallDown" };
  if (dx === 0 && dy === -1) return { cell: world.at(x, y - 1), key: "wallDown" };
  return null;
}

function isWorldBoundary(world, x, y, dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  if (world.at(x, y) === null) return false;
  return world.at(x + dx, y + dy) === null;
}

function wallRubble(world, slot, wall) {
  const edge = slot.key === "wallRight" ? "right" : "down";
  const orientation = edge === "right" ? 0x27d4eb2d : 0x165667b1;
  const visualSeed = (
    (world.seed >>> 0) ^
    Math.imul(slot.cell.x + 1, 0x9e3779b1) ^
    Math.imul(slot.cell.y + 1, 0x85ebca77) ^
    orientation
  ) >>> 0;
  return {
    kind: "wall-rubble",
    layer: "background",
    placement: { type: "edge", edge },
    material: wall.material ?? "stone",
    visualSeed,
  };
}

export function getWall(world, x, y, dx, dy) {
  if (isWorldBoundary(world, x, y, dx, dy)) return INDESTRUCTIBLE_WALL;
  const slot = wallSlot(world, x, y, dx, dy);
  return slot?.cell[slot.key] ?? null;
}

// Reaching zero opens the edge and leaves a non-blocking background object.
export function damageWall(world, x, y, dx, dy, amount = 1) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Wall damage must be a non-negative number");
  }
  if (isWorldBoundary(world, x, y, dx, dy)) {
    return { hit: true, broken: false, health: Infinity };
  }
  const slot = wallSlot(world, x, y, dx, dy);
  const wall = slot?.cell[slot.key] ?? null;
  if (wall === null) return { hit: false, broken: false, health: null };
  if (wall.stats.health === Infinity) {
    return { hit: true, broken: false, health: Infinity };
  }
  if (!Number.isFinite(wall.stats.health) || wall.stats.health <= 0) {
    throw new Error("Wall health must be a positive number or Infinity");
  }

  wall.stats.health = Math.max(0, wall.stats.health - amount);
  if (wall.stats.health === 0) {
    slot.cell.objects.push(wallRubble(world, slot, wall));
    slot.cell[slot.key] = null;
    return { hit: true, broken: true, health: 0 };
  }
  return { hit: true, broken: false, health: wall.stats.health };
}

// Is there a wall on the edge leaving (x, y) in the orthogonal step (dx, dy)?
// The world boundary is an implicit solid perimeter (all four sides). Interior
// edges read the canonical object — left/up edges read the neighbour's
// right/down slot.
export function hasWall(world, x, y, dx, dy) {
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) return true;
  return getWall(world, x, y, dx, dy) !== null;
}
