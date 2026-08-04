const ASSET_REVISION = "meat-monster-corpse-1";

function loadImage(src) {
  const image = new Image();
  image.decoding = "async";
  image.onerror = () => console.error(`Failed to load corpse sprite: ${src}`);
  image.src = src;
  return image;
}

export function loadCorpseSprites() {
  return {
    "meat-monster": loadImage(
      `./assets/enemies/meat-monster/corpse.png?v=${ASSET_REVISION}`,
    ),
  };
}

export function drawCorpse(ctx, { object, x, y, cellSize, sprites }) {
  const image = sprites?.[object.entityKind];
  if (!image?.complete || !image.naturalWidth) return;
  ctx.drawImage(image, x, y, cellSize, cellSize);
}
