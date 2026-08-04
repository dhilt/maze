import assert from "node:assert/strict";
import test from "node:test";

import {
  createEnemyRenderState,
  drawEnemies,
  HEALTH_BAR_HIDE_DELAY_SECONDS,
} from "../src/rendering/enemies.js";

function createContext() {
  const translations = [];
  const images = [];
  const fills = [];
  let fillStyle = "";
  return {
    translations,
    images,
    fills,
    get fillStyle() { return fillStyle; },
    set fillStyle(value) { fillStyle = value; },
    save() {},
    restore() {},
    translate(x, y) { translations.push([x, y]); },
    beginPath() {},
    ellipse() {},
    arc() {},
    fill() {},
    stroke() {},
    fillRect(...args) { fills.push({ style: fillStyle, args }); },
    strokeRect() {},
    drawImage(...args) { images.push(args); },
  };
}

function createSprites() {
  return {
    walk: Object.fromEntries(
      ["down", "up", "left", "right"].map((direction) => [
        direction,
        Array.from({ length: 4 }, (_, frame) => ({
          complete: true,
          naturalWidth: 64,
          id: `${direction}-${frame}`,
        })),
      ]),
    ),
    attack: {
      down: Array.from({ length: 8 }, (_, frame) => ({
        complete: true,
        naturalWidth: 64,
        id: `attack-down-${frame}`,
      })),
      up: Array.from({ length: 8 }, (_, frame) => ({
        complete: true,
        naturalWidth: 64,
        id: `attack-up-${frame}`,
      })),
      left: Array.from({ length: 8 }, (_, frame) => ({
        complete: true,
        naturalWidth: 64,
        id: `attack-left-${frame}`,
      })),
      right: Array.from({ length: 8 }, (_, frame) => ({
        complete: true,
        naturalWidth: 64,
        id: `attack-right-${frame}`,
      })),
    },
  };
}

test("enemy rendering interpolates the same move state used by collision", () => {
  const ctx = createContext();
  drawEnemies(ctx, {
    monsters: [{
      id: "m1",
      kind: "meat-monster",
      col: 1,
      row: 1,
      facing: "right",
      move: { kind: "step", dx: 1, dy: 0, elapsed: 2.5, timeCost: 5 },
    }],
    cam: { px: 0, py: 0 },
    cellSize: 64,
    meatMonsterSprites: createSprites(),
  });

  assert.deepEqual(ctx.translations, [[128, 96]]);
  assert.equal(ctx.images[0][0].id, "right-2");
  assert.deepEqual(ctx.images[0].slice(1), [-32, -32, 64, 64]);
});

test("a downward enemy attack uses the weighted lunge frames", () => {
  const ctx = createContext();
  drawEnemies(ctx, {
    monsters: [{
      id: "m1",
      kind: "meat-monster",
      col: 1,
      row: 1,
      facing: "down",
      move: null,
      attack: { kind: "attack", elapsed: 2.5, timeCost: 5 },
    }],
    cam: { px: 0, py: 0 },
    cellSize: 64,
    meatMonsterSprites: createSprites(),
  });

  assert.equal(ctx.images[0][0].id, "attack-down-4");
});

test("a monster draws a compact health bar in a side-adjacent cell", () => {
  const ctx = createContext();
  drawEnemies(ctx, {
    monsters: [{
      id: "m1",
      kind: "meat-monster",
      col: 1,
      row: 1,
      facing: "down",
      move: null,
      attack: null,
      stats: { health: 10 },
      statsMax: { health: 20 },
    }],
    cam: { px: 0, py: 0 },
    cellSize: 64,
    meatMonsterSprites: createSprites(),
    player: { col: 0, row: 1 },
    playerMove: null,
  });

  assert.deepEqual(ctx.fills, [
    { style: "rgba(20, 8, 10, 0.58)", args: [-14, -23, 28, 2] },
    { style: "rgba(184, 48, 56, 0.84)", args: [-14, -23, 14, 2] },
  ]);
});

test("a monster health bar stays hidden outside side adjacency", () => {
  const ctx = createContext();
  drawEnemies(ctx, {
    monsters: [{
      id: "m1",
      kind: "meat-monster",
      col: 1,
      row: 1,
      facing: "down",
      move: null,
      attack: null,
      stats: { health: 10 },
      statsMax: { health: 20 },
    }],
    cam: { px: 0, py: 0 },
    cellSize: 64,
    meatMonsterSprites: createSprites(),
    player: { col: 0, row: 0 },
    playerMove: null,
  });

  assert.deepEqual(ctx.fills, []);
});

test("a visible health bar relaxes for one real second after adjacency ends", () => {
  const ctx = createContext();
  const monster = {
    id: "m1",
    kind: "meat-monster",
    col: 1,
    row: 1,
    facing: "down",
    move: null,
    attack: null,
    stats: { health: 10 },
    statsMax: { health: 20 },
  };
  const player = { col: 0, row: 1 };
  const renderState = createEnemyRenderState();
  const draw = (realTime) => drawEnemies(ctx, {
    monsters: [monster],
    cam: { px: 0, py: 0 },
    cellSize: 64,
    meatMonsterSprites: createSprites(),
    player,
    playerMove: null,
    realTime,
    renderState,
  });

  draw(10);
  assert.equal(ctx.fills.length, 2);

  player.col = 3;
  ctx.fills.length = 0;
  draw(10 + HEALTH_BAR_HIDE_DELAY_SECONDS - 0.001);
  assert.equal(ctx.fills.length, 2);

  ctx.fills.length = 0;
  draw(10 + HEALTH_BAR_HIDE_DELAY_SECONDS);
  assert.equal(ctx.fills.length, 0);
});

test("an upward enemy attack uses the upward lunge sprites", () => {
  const ctx = createContext();
  drawEnemies(ctx, {
    monsters: [{
      id: "m1",
      kind: "meat-monster",
      col: 1,
      row: 1,
      facing: "up",
      move: null,
      attack: { kind: "attack", elapsed: 2.5, timeCost: 5 },
    }],
    cam: { px: 0, py: 0 },
    cellSize: 64,
    meatMonsterSprites: createSprites(),
  });

  assert.equal(ctx.images[0][0].id, "attack-up-4");
});

test("horizontal enemy attacks use their directional lunge sprites", () => {
  for (const facing of ["left", "right"]) {
    const ctx = createContext();
    drawEnemies(ctx, {
      monsters: [{
        id: "m1",
        kind: "meat-monster",
        col: 1,
        row: 1,
        facing,
        move: null,
        attack: { kind: "attack", elapsed: 2.5, timeCost: 5 },
      }],
      cam: { px: 0, py: 0 },
      cellSize: 64,
      meatMonsterSprites: createSprites(),
    });

    assert.equal(ctx.images[0][0].id, `attack-${facing}-4`);
  }
});

test("unknown enemy kinds are ignored by the enemy renderer", () => {
  const ctx = createContext();
  drawEnemies(ctx, {
    monsters: [{ kind: "future-enemy", col: 0, row: 0, move: null }],
    cam: { px: 0, py: 0 },
    cellSize: 64,
  });

  assert.deepEqual(ctx.translations, []);
});
