// Wall rendering is isolated from the world data and the main layer composer.

const CRACK_TEMPLATES = [
  { at: 0.23, mirror: -1 },
  { at: 0.46, mirror: 1 },
  { at: 0.68, mirror: -1 },
  { at: 0.84, mirror: 1 },
];

function crackStage(wall) {
  const health = wall.stats.health;
  const maxHealth = wall.statsMax.health;
  if (!Number.isFinite(health) || !Number.isFinite(maxHealth) || !(maxHealth > 0)) return 0;
  const damage = Math.max(0, Math.min(1, 1 - health / maxHealth));
  return Math.min(CRACK_TEMPLATES.length, Math.ceil(damage * CRACK_TEMPLATES.length));
}

function edgePoint(edge, along, normal) {
  return edge.vertical
    ? [edge.x + normal, edge.y + along]
    : [edge.x + along, edge.y + normal];
}

function drawCracks(ctx, edges, cellSize) {
  if (edges.length === 0) return;

  ctx.save();
  ctx.beginPath();
  for (const edge of edges) {
    for (let index = 0; index < edge.stage; index++) {
      const { at, mirror } = CRACK_TEMPLATES[index];
      const along = at * cellSize;
      const side = mirror * (((edge.col + edge.row + index) & 1) ? -1 : 1);
      const points = [
        edgePoint(edge, along - cellSize * 0.03, -side * cellSize * 0.04),
        edgePoint(edge, along, 0),
        edgePoint(edge, along + cellSize * 0.035, side * cellSize * 0.045),
      ];
      ctx.moveTo(...points[0]);
      ctx.lineTo(...points[1]);
      ctx.lineTo(...points[2]);

      const branch = edgePoint(
        edge,
        along - cellSize * 0.05,
        side * cellSize * 0.075,
      );
      ctx.moveTo(...points[1]);
      ctx.lineTo(...branch);
    }
  }
  ctx.strokeStyle = "rgba(48, 54, 63, 0.82)";
  ctx.lineWidth = Math.max(0.8, cellSize * 0.016);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

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
  const crackedEdges = [];

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
        const stage = crackStage(cell.wallRight);
        if (stage > 0) {
          crackedEdges.push({ x: x + cellSize, y, vertical: true, stage, col, row });
        }
      }
      if (cell.wallDown) {
        ctx.moveTo(x, y + cellSize);
        ctx.lineTo(x + cellSize, y + cellSize);
        const stage = crackStage(cell.wallDown);
        if (stage > 0) {
          crackedEdges.push({ x, y: y + cellSize, vertical: false, stage, col, row });
        }
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
  drawCracks(ctx, crackedEdges, cellSize);
  ctx.lineCap = "butt";
}
