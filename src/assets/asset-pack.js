function requireText(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function normalizeAnimations(animations) {
  return Object.freeze(Object.fromEntries(
    Object.entries(animations).map(([name, definition]) => {
      const directions = definition?.directions;
      const frames = definition?.frames;
      if (!Array.isArray(directions) || directions.length === 0) {
        throw new Error(`Animation ${name} requires directions`);
      }
      if (!Number.isInteger(frames) || frames <= 0) {
        throw new Error(`Animation ${name} requires a positive frame count`);
      }
      return [name, Object.freeze({
        directions: Object.freeze(directions.map((direction) => (
          requireText(direction, `Animation ${name} direction`)
        ))),
        frames,
      })];
    }),
  ));
}

function normalizeImages(images) {
  return Object.freeze(Object.fromEntries(
    Object.entries(images).map(([name, path]) => [
      name,
      requireText(path, `Image ${name} path`),
    ]),
  ));
}

export function defineAssetPack({
  id,
  root,
  revision,
  animations = {},
  images = {},
}) {
  return Object.freeze({
    id: requireText(id, "Asset pack id"),
    root: requireText(root, "Asset pack root").replace(/\/$/, ""),
    revision: requireText(revision, "Asset pack revision"),
    animations: normalizeAnimations(animations),
    images: normalizeImages(images),
  });
}

export function getAssetUrl(pack, path) {
  return `${pack.root}/${path}?v=${encodeURIComponent(pack.revision)}`;
}

export function createAssetBundle(pack, resolveImage) {
  if (typeof resolveImage !== "function") {
    throw new Error("Asset bundle requires an image resolver");
  }
  const animations = Object.fromEntries(
    Object.entries(pack.animations).map(([action, definition]) => [
      action,
      Object.fromEntries(definition.directions.map((direction) => [
        direction,
        Array.from({ length: definition.frames }, (_, frame) => resolveImage(
          getAssetUrl(pack, `${action}/${direction}/${frame}.png`),
        )),
      ])),
    ]),
  );
  const images = Object.fromEntries(
    Object.entries(pack.images).map(([name, path]) => [
      name,
      resolveImage(getAssetUrl(pack, path)),
    ]),
  );
  return { animations, images };
}

export function listAssetPackUrls(pack) {
  const urls = [];
  createAssetBundle(pack, (url) => { urls.push(url); });
  return urls;
}
