import assert from "node:assert/strict";
import test from "node:test";

import { startGameAfterAssets } from "../src/game/startup.js";

test("game creation and time start wait for asset preload", async () => {
  let releaseAssets;
  let created = 0;
  let started = 0;
  const assets = {
    preloadAll: () => new Promise((resolve) => { releaseAssets = resolve; }),
  };
  const pending = startGameAfterAssets({
    assets,
    create: (receivedAssets) => {
      assert.equal(receivedAssets, assets);
      created += 1;
      return { start: () => { started += 1; } };
    },
  });

  await Promise.resolve();
  assert.equal(created, 0);
  assert.equal(started, 0);

  releaseAssets();
  await pending;

  assert.equal(created, 1);
  assert.equal(started, 1);
});

test("a preload failure prevents game creation", async () => {
  let created = 0;
  const failure = new Error("asset failed");

  await assert.rejects(startGameAfterAssets({
    assets: { preloadAll: () => Promise.reject(failure) },
    create: () => {
      created += 1;
      return { start() {} };
    },
  }), failure);

  assert.equal(created, 0);
});
