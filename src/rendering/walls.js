// Wall rendering is isolated from the world data and the main layer composer.

export function drawWalls(ctx, {
  cam,
  world,
  cellSize,
  viewCols,
  viewRows,
  worldCols,
  worldRows,
}) {
  const startCol = Math.floor(cam.px / cellSize);
  const startRow = Math.floor(cam.py / cellSize);

  ctx.lineCap = "round";
  ctx.beginPath();
  for (let row = startRow; row <= startRow + viewRows; row++) {
    for (let col = startCol; col <= startCol + viewCols; col++) {
      const cell = world.at(col, row);
      if (!cell) continue;

      const x = col * cellSize - cam.px;
      const y = row * cellSize - cam.py;
      if (cell.wallRight) {
        ctx.moveTo(x + cellSize, y);
        ctx.lineTo(x + cellSize, y + cellSize);
      }
      if (cell.wallDown) {
        ctx.moveTo(x, y + cellSize);
        ctx.lineTo(x + cellSize, y + cellSize);
      }

      if (row === 0) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + cellSize, y);
      }
      if (col === 0) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + cellSize);
      }
      if (row === worldRows - 1) {
        ctx.moveTo(x, y + cellSize);
        ctx.lineTo(x + cellSize, y + cellSize);
      }
      if (col === worldCols - 1) {
        ctx.moveTo(x + cellSize, y);
        ctx.lineTo(x + cellSize, y + cellSize);
      }
    }
  }

  ctx.save();
  ctx.strokeStyle = "#747d89";
  ctx.lineWidth = 5.5;
  ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "rgba(225, 231, 238, 0.34)";
  ctx.lineWidth = 1.05;
  ctx.stroke();
  ctx.lineCap = "butt";
}
