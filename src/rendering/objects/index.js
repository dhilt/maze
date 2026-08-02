import { drawWallRubble } from "./wall-rubble.js";

const DRAWERS = Object.freeze({
  "wall-rubble": drawWallRubble,
});

export function drawObjects(ctx, {
  cam,
  world,
  cellSize,
  viewCols,
  viewRows,
  layer = "background",
}) {
  const startCol = Math.floor(cam.px / cellSize);
  const startRow = Math.floor(cam.py / cellSize);

  for (let row = startRow; row <= startRow + viewRows; row++) {
    for (let col = startCol; col <= startCol + viewCols; col++) {
      const cell = world.at(col, row);
      if (!cell) continue;
      for (const object of cell.objects) {
        const draw = object.layer === layer ? DRAWERS[object.kind] : null;
        if (!draw) continue;
        draw(ctx, {
          object,
          cell,
          x: col * cellSize - cam.px,
          y: row * cellSize - cam.py,
          cellSize,
        });
      }
    }
  }
}
