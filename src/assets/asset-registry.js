import { createAssetBundle } from "./asset-pack.js";

function loadImage(url, imageFactory) {
  const image = imageFactory();
  const ready = new Promise((resolve, reject) => {
    image.onload = async () => {
      try {
        if (typeof image.decode === "function") await image.decode();
        resolve(image);
      } catch (error) {
        reject(new Error(`Failed to decode asset: ${url}`, { cause: error }));
      }
    };
    image.onerror = () => reject(new Error(`Failed to load asset: ${url}`));
  });
  image.decoding = "async";
  image.src = url;
  return { image, ready };
}

export function createAssetRegistry({
  packs,
  imageFactory = () => new Image(),
}) {
  if (!packs || typeof packs !== "object") {
    throw new Error("Asset registry requires a pack catalog");
  }
  if (typeof imageFactory !== "function") {
    throw new Error("Asset registry imageFactory must be a function");
  }

  const images = new Map();
  const entries = new Map();

  function getImage(url) {
    let record = images.get(url);
    if (!record) {
      record = loadImage(url, imageFactory);
      images.set(url, record);
    }
    return record;
  }

  function preparePack(id) {
    let entry = entries.get(id);
    if (entry) return entry;

    const pack = packs[id];
    if (!pack) throw new Error(`Unknown asset pack: ${id}`);
    const pending = [];
    const bundle = createAssetBundle(pack, (url) => {
      const record = getImage(url);
      pending.push(record.ready);
      return record.image;
    });
    entry = { bundle, ready: null, loaded: false };
    entry.ready = Promise.all(pending).then(() => {
      entry.loaded = true;
      return bundle;
    });
    entries.set(id, entry);
    return entry;
  }

  async function preload(ids) {
    if (!Array.isArray(ids)) {
      throw new Error("Asset preload requires pack ids");
    }
    await Promise.all(ids.map((id) => preparePack(id).ready));
  }

  return {
    preload,
    preloadAll() { return preload(Object.keys(packs)); },
    get(id) {
      const entry = entries.get(id);
      if (!entry?.loaded) throw new Error(`Asset pack is not ready: ${id}`);
      return entry.bundle;
    },
    isReady(id) { return entries.get(id)?.loaded === true; },
  };
}
