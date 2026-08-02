// Old-stone floor theme.
//
// The layout is generated once in world coordinates, then only the visible
// stones are painted each frame. Camera movement therefore reveals the same
// surface instead of regenerating or sliding a screen-space texture.

const ROW_HEIGHT = 31;
const MIN_STONE_WIDTH = 46;
const STONE_WIDTH_RANGE = 42;
const OVERSCAN = 96;

function hash2(x, y, seed) {
  let h = Math.imul((x | 0) ^ (seed | 0), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16) ^ (y | 0), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function stoneColor(value) {
  const shift = Math.round((value - 0.5) * 13);
  const r = Math.max(0, Math.min(255, 52 + shift));
  const g = Math.max(0, Math.min(255, 57 + shift));
  const b = Math.max(0, Math.min(255, 65 + shift));
  return `rgb(${r}, ${g}, ${b})`;
}

function rowBoundary(row, seed) {
  return row * ROW_HEIGHT + (hash2(row, -81, seed) - 0.5) * 5;
}

function traceStone(ctx, points, dx = 0, dy = 0) {
  ctx.beginPath();
  ctx.moveTo(points[0].x + dx, points[0].y + dy);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x + dx, points[i].y + dy);
  }
  ctx.closePath();
}

function makeCrack(x, y, width, height, row, index, seed) {
  if (hash2(row * 17 + index, 401, seed) > 0.13) return null;

  const points = [];
  let px = x + width * (0.28 + hash2(row, index * 7 + 3, seed) * 0.38);
  let py = y + height * (0.22 + hash2(row * 3, index + 9, seed) * 0.22);
  points.push({ x: px, y: py });

  const segments = hash2(row, index + 71, seed) > 0.45 ? 3 : 2;
  for (let i = 0; i < segments; i++) {
    px += (hash2(row * 13 + i, index * 19 + 5, seed) - 0.44) * width * 0.14;
    py += height * (0.13 + hash2(row + i, index * 11, seed) * 0.1);
    px = Math.max(x + 7, Math.min(x + width - 7, px));
    py = Math.max(y + 5, Math.min(y + height - 5, py));
    points.push({ x: px, y: py });
  }
  return points;
}

function makeStone(row, index, x0, x1, top, bottom, seed) {
  const width = x1 - x0;
  const height = bottom - top;
  const inset = 1.45;

  const points = [
    {
      x: x0 + inset + (hash2(row, index * 11 + 1, seed) - 0.5) * 1.8,
      y: top + inset + (hash2(row, index * 11 + 2, seed) - 0.5) * 1.2,
    },
    {
      x: x1 - inset + (hash2(row, index * 11 + 3, seed) - 0.5) * 1.8,
      y: top + inset + (hash2(row, index * 11 + 4, seed) - 0.5) * 1.2,
    },
    {
      x: x1 - inset + (hash2(row, index * 11 + 5, seed) - 0.5) * 1.8,
      y: bottom - inset + (hash2(row, index * 11 + 6, seed) - 0.5) * 1.2,
    },
    {
      x: x0 + inset + (hash2(row, index * 11 + 7, seed) - 0.5) * 1.8,
      y: bottom - inset + (hash2(row, index * 11 + 8, seed) - 0.5) * 1.2,
    },
  ];

  const stainRoll = hash2(row * 23 + index, 503, seed);
  const stain = stainRoll < 0.11
    ? {
        x: x0 + width * (0.25 + hash2(row, index + 211, seed) * 0.5),
        y: top + height * (0.3 + hash2(row, index + 223, seed) * 0.4),
        rx: 4 + hash2(row, index + 227, seed) * Math.min(9, width * 0.12),
        ry: 1.8 + hash2(row, index + 229, seed) * 3.2,
        alpha: 0.045 + hash2(row, index + 233, seed) * 0.04,
      }
    : null;

  const chipRoll = hash2(row * 31 + index, 601, seed);
  const chip = chipRoll < 0.09
    ? {
        x: x0 + width * (0.18 + hash2(row, index + 307, seed) * 0.64),
        y: hash2(row, index + 311, seed) > 0.5 ? top + 2.5 : bottom - 2.5,
        size: 1.4 + hash2(row, index + 313, seed) * 1.6,
      }
    : null;

  return {
    minX: x0,
    maxX: x1,
    top,
    bottom,
    points,
    color: stoneColor(hash2(row, index, seed)),
    highlight: 0.075 + hash2(row, index + 101, seed) * 0.055,
    crack: makeCrack(x0, top, width, height, row, index, seed),
    stain,
    chip,
  };
}

function buildRows(worldWidth, worldHeight, seed) {
  const rows = [];
  const firstRow = -2;
  const lastRow = Math.ceil(worldHeight / ROW_HEIGHT) + 2;

  for (let row = firstRow; row <= lastRow; row++) {
    const top = rowBoundary(row, seed);
    const bottom = rowBoundary(row + 1, seed);
    const stones = [];
    let x = -OVERSCAN + hash2(row, 17, seed) * 42;
    let index = 0;

    while (x < worldWidth + OVERSCAN) {
      const width = MIN_STONE_WIDTH + hash2(row, index + 37, seed) * STONE_WIDTH_RANGE;
      const nextX = x + width;
      stones.push(makeStone(row, index, x, nextX, top, bottom, seed));
      x = nextX;
      index++;
    }

    rows.push({ top, bottom, stones });
  }

  return rows;
}

function drawStone(ctx, stone) {
  // A small lower-right extrusion reads as depth while the exposed grout keeps
  // neighbouring slabs visually separate.
  traceStone(ctx, stone.points, 0.7, 1.15);
  ctx.fillStyle = "rgba(8, 11, 15, 0.28)";
  ctx.fill();

  traceStone(ctx, stone.points);
  ctx.fillStyle = stone.color;
  ctx.fill();

  // Light catches the upper and left edges; the opposite edges stay recessed.
  ctx.beginPath();
  ctx.moveTo(stone.points[3].x, stone.points[3].y);
  ctx.lineTo(stone.points[0].x, stone.points[0].y);
  ctx.lineTo(stone.points[1].x, stone.points[1].y);
  ctx.strokeStyle = `rgba(232, 237, 243, ${stone.highlight})`;
  ctx.lineWidth = 0.9;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(stone.points[1].x, stone.points[1].y);
  ctx.lineTo(stone.points[2].x, stone.points[2].y);
  ctx.lineTo(stone.points[3].x, stone.points[3].y);
  ctx.strokeStyle = "rgba(6, 9, 13, 0.3)";
  ctx.lineWidth = 1.05;
  ctx.stroke();

  if (stone.stain) {
    ctx.beginPath();
    ctx.ellipse(
      stone.stain.x,
      stone.stain.y,
      stone.stain.rx,
      stone.stain.ry,
      hash2(Math.round(stone.stain.x), Math.round(stone.stain.y), 19) * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = `rgba(18, 29, 27, ${stone.stain.alpha})`;
    ctx.fill();
  }

  if (stone.crack) {
    ctx.beginPath();
    ctx.moveTo(stone.crack[0].x, stone.crack[0].y);
    for (let i = 1; i < stone.crack.length; i++) {
      ctx.lineTo(stone.crack[i].x, stone.crack[i].y);
    }
    ctx.strokeStyle = "rgba(8, 11, 15, 0.5)";
    ctx.lineWidth = 0.8;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  if (stone.chip) {
    ctx.beginPath();
    ctx.moveTo(stone.chip.x - stone.chip.size, stone.chip.y);
    ctx.lineTo(stone.chip.x + stone.chip.size, stone.chip.y);
    ctx.lineTo(stone.chip.x, stone.chip.y + (stone.chip.y < stone.top + 6 ? stone.chip.size : -stone.chip.size));
    ctx.closePath();
    ctx.fillStyle = "rgba(10, 13, 17, 0.26)";
    ctx.fill();
  }
}

export function createStoneFloor({ worldWidth, worldHeight, seed = 1 }) {
  const rows = buildRows(worldWidth, worldHeight, seed | 0);

  function draw(ctx, cam, viewportWidth, viewportHeight) {
    const left = cam.px - 4;
    const right = cam.px + viewportWidth + 4;
    const top = cam.py - 4;
    const bottom = cam.py + viewportHeight + 4;

    // Fill the viewport with recessed grout before laying slabs over it.
    ctx.fillStyle = "#22272e";
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    ctx.save();
    ctx.translate(-cam.px, -cam.py);
    for (const row of rows) {
      if (row.bottom < top || row.top > bottom) continue;
      for (const stone of row.stones) {
        if (stone.maxX < left || stone.minX > right) continue;
        drawStone(ctx, stone);
      }
    }
    ctx.restore();
  }

  return { draw };
}
