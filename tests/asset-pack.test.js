import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createAssetRegistry } from "../src/assets/asset-registry.js";
import {
  createAssetBundle,
  defineAssetPack,
  listAssetPackUrls,
} from "../src/assets/asset-pack.js";
import { ASSET_PACKS, getAssetPack } from "../src/assets/catalog.js";
import { KNIGHT_ASSET_PACK } from "../src/assets/packs/knight.js";
import { MEAT_MONSTER_ASSET_PACK } from "../src/assets/packs/meat-monster.js";

const TEST_PACK = defineAssetPack({
  id: "actor",
  root: "./assets/actor",
  revision: "rev 1",
  animations: {
    idle: { directions: ["down", "up"], frames: 2 },
  },
  images: { portrait: "portrait.png" },
});

function controlledImages() {
  const images = [];
  return {
    images,
    factory() {
      const image = {
        decodeCalls: 0,
        decode() {
          this.decodeCalls += 1;
          return Promise.resolve();
        },
      };
      images.push(image);
      return image;
    },
  };
}

test("the asset catalog exposes immutable semantic packs", () => {
  assert.equal(getAssetPack("knight"), KNIGHT_ASSET_PACK);
  assert.equal(getAssetPack("meat-monster"), MEAT_MONSTER_ASSET_PACK);
  assert.equal(getAssetPack("unknown"), null);
  assert.equal(Object.isFrozen(ASSET_PACKS), true);
  assert.equal(Object.isFrozen(MEAT_MONSTER_ASSET_PACK.animations.attack), true);
});

test("a declarative pack expands animations and standalone images in order", () => {
  assert.deepEqual(listAssetPackUrls(TEST_PACK), [
    "./assets/actor/idle/down/0.png?v=rev%201",
    "./assets/actor/idle/down/1.png?v=rev%201",
    "./assets/actor/idle/up/0.png?v=rev%201",
    "./assets/actor/idle/up/1.png?v=rev%201",
    "./assets/actor/portrait.png?v=rev%201",
  ]);
});

test("a bundle preserves the declared shape without owning image loading", () => {
  const bundle = createAssetBundle(TEST_PACK, (src) => ({ src }));

  assert.equal(bundle.animations.idle.down.length, 2);
  assert.equal(bundle.animations.idle.up.length, 2);
  assert.match(bundle.images.portrait.src, /portrait\.png\?v=rev%201$/);
});

test("every declared production asset is a committed 64px PNG", async () => {
  const urls = Object.values(ASSET_PACKS).flatMap(listAssetPackUrls);

  await Promise.all(urls.map(async (url) => {
    const [publicPath] = url.split("?");
    assert.match(publicPath, /^\.\/assets\/.+\.png$/);
    const file = new URL(`../${publicPath.slice(2)}`, import.meta.url);
    const png = await readFile(file);
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 64);
    assert.equal(png.readUInt32BE(20), 64);
  }));
});

test("preloadAll waits for every image load and decode before exposing packs", async () => {
  const extraPack = defineAssetPack({
    id: "icon",
    root: "./assets/icon",
    revision: "1",
    images: { marker: "marker.png" },
  });
  const packs = { actor: TEST_PACK, icon: extraPack };
  const controlled = controlledImages();
  const assets = createAssetRegistry({
    packs,
    imageFactory: controlled.factory,
  });
  let settled = false;
  const pending = assets.preloadAll().then(() => { settled = true; });

  await Promise.resolve();
  assert.equal(settled, false);
  assert.deepEqual(
    controlled.images.map(({ src }) => src),
    Object.values(packs).flatMap(listAssetPackUrls),
  );
  assert.throws(() => assets.get("actor"), /not ready/);

  for (const image of controlled.images) image.onload();
  await pending;

  assert.equal(settled, true);
  assert.equal(assets.isReady("actor"), true);
  assert.equal(assets.isReady("icon"), true);
  assert.ok(controlled.images.every(({ decodeCalls }) => decodeCalls === 1));
  assert.equal(assets.get("actor").animations.idle.down.length, 2);
  assert.equal(assets.get("icon").images.marker, controlled.images.at(-1));

  await assets.preloadAll();
  assert.equal(controlled.images.length, 6, "ready packs must not create new Images");
});

test("the registry deduplicates repeated URLs inside a pack", async () => {
  const pack = defineAssetPack({
    id: "shared",
    root: "./assets/shared",
    revision: "1",
    images: { first: "same.png", second: "same.png" },
  });
  const controlled = controlledImages();
  const assets = createAssetRegistry({
    packs: { shared: pack },
    imageFactory: controlled.factory,
  });
  const pending = assets.preloadAll();

  assert.equal(controlled.images.length, 1);
  controlled.images[0].onload();
  await pending;

  const bundle = assets.get("shared");
  assert.equal(bundle.images.first, bundle.images.second);
});

test("an image error rejects preload with its asset URL", async () => {
  const pack = defineAssetPack({
    id: "broken",
    root: "./assets/broken",
    revision: "1",
    images: { icon: "missing.png" },
  });
  const controlled = controlledImages();
  const assets = createAssetRegistry({
    packs: { broken: pack },
    imageFactory: controlled.factory,
  });
  const pending = assets.preloadAll();

  controlled.images[0].onerror();

  await assert.rejects(pending, /assets\/broken\/missing\.png/);
  assert.equal(assets.isReady("broken"), false);
});

test("a decode error rejects preload before exposing the pack", async () => {
  const pack = defineAssetPack({
    id: "broken",
    root: "./assets/broken",
    revision: "1",
    images: { icon: "invalid.png" },
  });
  const controlled = controlledImages();
  const assets = createAssetRegistry({
    packs: { broken: pack },
    imageFactory: controlled.factory,
  });
  const failure = new Error("decode failed");
  const pending = assets.preloadAll();
  controlled.images[0].decode = () => Promise.reject(failure);

  controlled.images[0].onload();

  await assert.rejects(pending, /Failed to decode asset/);
  assert.equal(assets.isReady("broken"), false);
});

test("invalid animation declarations fail before any image is requested", () => {
  assert.throws(() => defineAssetPack({
    id: "broken",
    root: "./assets/broken",
    revision: "1",
    animations: { walk: { directions: ["down"], frames: 0 } },
  }), /positive frame count/);
});
