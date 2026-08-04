import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { drawObjects } from "../src/rendering/objects/index.js";
import { loadCorpseSprites } from "../src/rendering/objects/corpse.js";
import { createWall, damageWall } from "../src/world/maze.js";
import { generateWorld } from "../src/world/world.js";

function recordingContext() {
  const filledPaths = [];
  const images = [];
  let path = [];
  return {
    filledPaths,
    images,
    save() {},
    restore() {},
    beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); },
    closePath() {},
    fill() { filledPaths.push(path.map((point) => [...point])); },
    stroke() {},
    drawImage(...args) { images.push(args); },
  };
}

function renderContext(world, objectSprites = {}) {
  const ctx = recordingContext();
  drawObjects(ctx, {
    cam: { px: 0, py: 0 },
    world,
    cellSize: 64,
    viewCols: world.width,
    viewRows: world.height,
    objectSprites,
  });
  return ctx;
}

function render(world) {
  return renderContext(world).filledPaths;
}

test("destroyed walls render as deterministic background stones", () => {
  const world = generateWorld({ width: 2, height: 1, seed: 7 });
  world.at(0, 0).wallRight = createWall({
    health: 1,
    defense: 2,
    impactWear: 1,
  });
  damageWall(world, 0, 0, 1, 0);

  const first = render(world);
  assert.equal(first.length, 8);
  assert.deepEqual(render(world), first, "the rubble layout must not move between frames");
});

test("unknown and non-background cell objects are ignored by this layer", () => {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  world.at(0, 0).objects.push(
    { kind: "unknown", layer: "background" },
    { kind: "wall-rubble", layer: "interactive" },
  );

  assert.deepEqual(render(world), []);
});

test("a meat monster corpse renders as a non-blocking cell object", () => {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  world.at(0, 0).objects.push({
    id: "corpse-m1",
    kind: "corpse",
    layer: "background",
    entityKind: "meat-monster",
  });
  const image = { complete: true, naturalWidth: 64, id: "corpse" };

  const ctx = renderContext(world, { corpse: { "meat-monster": image } });

  assert.deepEqual(ctx.images, [[image, 0, 0, 64, 64]]);
});

test("the committed corpse is a 64px PNG and its loader uses a deployable URL", async () => {
  const file = new URL(
    "../assets/enemies/meat-monster/corpse.png",
    import.meta.url,
  );
  const png = await readFile(file);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 64);
  assert.equal(png.readUInt32BE(20), 64);

  const PreviousImage = globalThis.Image;
  globalThis.Image = class FakeImage {};
  try {
    const sprites = loadCorpseSprites();
    assert.match(
      sprites["meat-monster"].src,
      /^\.\/assets\/enemies\/meat-monster\/corpse\.png\?v=/,
    );
  } finally {
    if (PreviousImage === undefined) delete globalThis.Image;
    else globalThis.Image = PreviousImage;
  }
});
