// Wander — a knight moving cell-by-cell across a large world, viewed through a
// fixed viewport with a dead-zone (static-viewport) scrolling camera.
// This file owns state, input, logic, the camera, and the game loop.
// Drawing and sprite generation live in renderer.js / graphics.js.

import { createRenderer } from "./renderer.js";
import { generateWorld } from "./world.js";
import { generateMaze, hasWall } from "./maze.js";
import { createCharacter } from "./character.js";
import { createStatsPanel } from "./panel.js";

// ---------- Version (bumped on every code edit) ----------
const VERSION = "0.28";

// ---------- Config ----------
const CELL = 64;         // cell side in pixels; the object fills one cell
const VIEW_COLS = 10;    // visible viewport width (cells)
const VIEW_ROWS = 7;     // visible viewport height (cells)
const WORLD_COLS = 50;   // full world width (cells)
const WORLD_ROWS = 50;   // full world height (cells)
const MARGIN = 2;        // cells kept between player and viewport edge before scroll
const PHASES = 4;        // animation phases / sprite frames per one-cell move
const PHASE_TIME = 0.11; // seconds per phase → CELL_TIME = 0.44s
const CELL_TIME = PHASE_TIME * PHASES;
const DEBUG = false;      // cell numbers + static-viewport outline
const WALL_DENSITY = 33;  // 0..100 — thin-wall (edge) obstacle density
const WALL_SEED = null;   // null → new maze each load; set a number to reproduce one

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
document.getElementById("ver").textContent = VERSION;

// Debug toggle checkbox — initialised from DEBUG, then live-controlled by the user.
const debugCheckbox = document.getElementById("debug");
debugCheckbox.checked = DEBUG;

// The viewport is fixed; the world scrolls underneath it.
canvas.width = VIEW_COLS * CELL;
canvas.height = VIEW_ROWS * CELL;

const renderer = createRenderer(ctx, {
  cellSize: CELL,
  viewCols: VIEW_COLS,
  viewRows: VIEW_ROWS,
  worldCols: WORLD_COLS,
  worldRows: WORLD_ROWS,
  phases: PHASES,
  cellTime: CELL_TIME,
  margin: MARGIN,
  debug: DEBUG,
});

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// The world: an explicit generation step at startup produces the full structure
// (flat, extensible, JSON-serialisable). No landscape algorithm yet — every cell
// is default terrain; the hook to add generation lives in world.js.
const world = generateWorld({ width: WORLD_COLS, height: WORLD_ROWS, seed: 1 });
generateMaze(world, {
  density: WALL_DENSITY,
  seed: WALL_SEED ?? (Math.random() * 0x100000000) >>> 0,
});

// Player character — a plain, serialisable stats state object (see character.js),
// reflected into the side panel next to the viewport.
const character = createCharacter({ name: "Sir Roland" });
const statsPanel = createStatsPanel(document.getElementById("stats"));
statsPanel.update(character);

// ---------- State ----------
// Player position is in WORLD cell coordinates. Starts at the world center.
const player = {
  col: Math.floor(WORLD_COLS / 2),
  row: Math.floor(WORLD_ROWS / 2),
};
// Active slide between cells: { dx, dy, t } where t is elapsed time, or null when idle.
let move = null;
let facing = "down"; // last movement direction; drives which sprite row is shown
let lastAxis = "h";  // most recently pressed axis ("h"/"v") — orthogonal priority

// Camera: continuous world-pixel offset of the viewport's top-left corner.
const MAX_CAM_X = (WORLD_COLS - VIEW_COLS) * CELL;
const MAX_CAM_Y = (WORLD_ROWS - VIEW_ROWS) * CELL;
const cam = {
  px: clamp((player.col - Math.floor(VIEW_COLS / 2)) * CELL, 0, MAX_CAM_X),
  py: clamp((player.row - Math.floor(VIEW_ROWS / 2)) * CELL, 0, MAX_CAM_Y),
};

// ---------- Input ----------
// Store key states in a dictionary; read them in update() rather than moving
// the player directly inside the event handler.
const keys = Object.create(null);

const keyMap = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

window.addEventListener("keydown", (e) => {
  const action = keyMap[e.code];
  if (!action) return;
  keys[action] = true;
  lastAxis = action === "left" || action === "right" ? "h" : "v";
  e.preventDefault();
});

window.addEventListener("keyup", (e) => {
  const action = keyMap[e.code];
  if (!action) return;
  keys[action] = false;
  e.preventDefault();
});

// ---------- Logic ----------
// Begin a slide toward the held direction if there is one and it stays in the world.
function startMoveIfInput() {
  let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);

  // Orthogonal only — never diagonal. If both axes are held, keep the most
  // recently pressed one.
  if (dx !== 0 && dy !== 0) {
    if (lastAxis === "v") dx = 0;
    else dy = 0;
  }

  // Drop an axis that would leave the world, so we can still slide along the other.
  if (player.col + dx < 0 || player.col + dx > WORLD_COLS - 1) dx = 0;
  if (player.row + dy < 0 || player.row + dy > WORLD_ROWS - 1) dy = 0;

  // Drop an axis blocked by a thin wall (prevents squeezing through a corner).
  if (dx !== 0 && hasWall(world, player.col, player.row, dx, 0)) dx = 0;
  if (dy !== 0 && hasWall(world, player.col, player.row, 0, dy)) dy = 0;

  if (dx === 0 && dy === 0) return;

  move = { dx, dy, t: 0 };
  // Face the movement; prefer horizontal facing on diagonals.
  if (dx !== 0) facing = dx > 0 ? "right" : "left";
  else facing = dy > 0 ? "down" : "up";
}

// Continuous world-pixel position of the player's cell top-left (mid-slide aware).
function playerPixelX() {
  const p = move ? Math.min(move.t / CELL_TIME, 1) : 0;
  return player.col * CELL + (move ? move.dx * CELL * p : 0);
}
function playerPixelY() {
  const p = move ? Math.min(move.t / CELL_TIME, 1) : 0;
  return player.row * CELL + (move ? move.dy * CELL * p : 0);
}

// Dead-zone camera: keep the player at least MARGIN cells from the viewport edge;
// scroll (continuously) only past that, and clamp to the world bounds.
function updateCamera() {
  const px = playerPixelX();
  const py = playerPixelY();

  const left = cam.px + MARGIN * CELL;
  const right = cam.px + (VIEW_COLS - 1 - MARGIN) * CELL;
  if (px < left) cam.px = px - MARGIN * CELL;
  else if (px > right) cam.px = px - (VIEW_COLS - 1 - MARGIN) * CELL;

  const top = cam.py + MARGIN * CELL;
  const bottom = cam.py + (VIEW_ROWS - 1 - MARGIN) * CELL;
  if (py < top) cam.py = py - MARGIN * CELL;
  else if (py > bottom) cam.py = py - (VIEW_ROWS - 1 - MARGIN) * CELL;

  cam.px = clamp(cam.px, 0, MAX_CAM_X);
  cam.py = clamp(cam.py, 0, MAX_CAM_Y);
}

// ---------- Update (logic, with delta time) ----------
function update(dt) {
  if (!move) {
    startMoveIfInput();
    if (!move) return;
  }

  move.t += dt;

  // Complete as many whole cell-crossings as fit this frame; chain moves
  // seamlessly while a key stays held (carry leftover time into the next slide).
  while (move && move.t >= CELL_TIME) {
    player.col += move.dx;
    player.row += move.dy;
    const leftover = move.t - CELL_TIME;
    move = null;
    startMoveIfInput();
    if (move) move.t = leftover;
  }
}

// ---------- Game loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1); // clamp on tab refocus
  last = now;

  update(dt);
  updateCamera();
  renderer.render({ player, move, facing, cam, world, debug: debugCheckbox.checked });

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
