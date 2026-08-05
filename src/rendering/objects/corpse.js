export function drawCorpse(ctx, { entity, x, y, cellSize, sprites }) {
  const image = sprites?.[entity?.kind];
  if (!image?.complete || !image.naturalWidth) return;
  ctx.drawImage(image, x, y, cellSize, cellSize);
}
