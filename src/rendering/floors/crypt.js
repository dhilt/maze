// Crypt floor theme.
//
// Large cold slabs form a staggered funerary pavement. Chamfered corners,
// recessed borders, sparse engraved seals, hairline cracks and damp marks make
// it distinct from the rough horizontal flagstones in floor.js while keeping
// the same createFloor(...).draw(...) contract.

const TILE_W = 58;
const TILE_H = 46;
const GAP = 1.35;
const CHAMFER = 4.2;
const OVERSCAN = TILE_W * 2;

function hash2(x, y, seed) {
  let h = Math.imul((x | 0) ^ (seed | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15) ^ (y | 0), 0x165667b1);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function cryptColor(value) {
  const shift = Math.round((value - 0.5) * 12);
  const r = Math.max(0, Math.min(255, 42 + shift));
  const g = Math.max(0, Math.min(255, 49 + shift));
  const b = Math.max(0, Math.min(255, 59 + shift));
  return `rgb(${r}, ${g}, ${b})`;
}

function tracePolygon(ctx, points, dx = 0, dy = 0) {
  ctx.beginPath();
  ctx.moveTo(points[0].x + dx, points[0].y + dy);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x + dx, points[i].y + dy);
  }
  ctx.closePath();
}

function octagon(x, y, width, height, inset, chamfer, row, col, seed) {
  const left = x + inset;
  const right = x + width - inset;
  const top = y + inset;
  const bottom = y + height - inset;
  const jitter = inset < 3 ? 0.7 : 0.25;
  const j = (slot) => (hash2(row * 17 + slot, col * 23 + slot * 3, seed) - 0.5) * jitter;

  return [
    { x: left + chamfer + j(1), y: top + j(2) },
    { x: right - chamfer + j(3), y: top + j(4) },
    { x: right + j(5), y: top + chamfer + j(6) },
    { x: right + j(7), y: bottom - chamfer + j(8) },
    { x: right - chamfer + j(9), y: bottom + j(10) },
    { x: left + chamfer + j(11), y: bottom + j(12) },
    { x: left + j(13), y: bottom - chamfer + j(14) },
    { x: left + j(15), y: top + chamfer + j(16) },
  ];
}

function makeCrack(x, y, row, col, seed) {
  if (hash2(row * 29 + col, 701, seed) > 0.15) return null;

  const points = [];
  let px = x + TILE_W * (0.25 + hash2(row, col + 41, seed) * 0.5);
  let py = y + TILE_H * (0.18 + hash2(row, col + 43, seed) * 0.2);
  points.push({ x: px, y: py });

  const segments = hash2(row, col + 47, seed) > 0.55 ? 4 : 3;
  for (let i = 0; i < segments; i++) {
    px += (hash2(row * 11 + i, col * 31 + i, seed) - 0.5) * 9;
    py += 4 + hash2(row + i, col * 13 + i, seed) * 4.5;
    px = Math.max(x + 8, Math.min(x + TILE_W - 8, px));
    py = Math.max(y + 7, Math.min(y + TILE_H - 7, py));
    points.push({ x: px, y: py });
  }
  return points;
}

function makeTile(row, col, x, y, seed) {
  const detailRoll = hash2(row * 37 + col, 809, seed);
  const motif = detailRoll < 0.075
    ? {
        type: Math.floor(hash2(row, col + 83, seed) * 3),
        x: x + TILE_W * (0.47 + (hash2(row, col + 89, seed) - 0.5) * 0.1),
        y: y + TILE_H * (0.5 + (hash2(row, col + 97, seed) - 0.5) * 0.08),
        radius: 6.5 + hash2(row, col + 101, seed) * 2,
      }
    : null;

  const dampRoll = hash2(row * 41 + col, 907, seed);
  const damp = dampRoll < 0.12
    ? {
        x: x + TILE_W * (0.2 + hash2(row, col + 109, seed) * 0.6),
        y: y + TILE_H * (0.24 + hash2(row, col + 113, seed) * 0.54),
        rx: 5 + hash2(row, col + 127, seed) * 7,
        ry: 2.5 + hash2(row, col + 131, seed) * 4.5,
        angle: hash2(row, col + 137, seed) * Math.PI,
        alpha: 0.045 + hash2(row, col + 139, seed) * 0.045,
      }
    : null;

  const points = octagon(x, y, TILE_W, TILE_H, GAP, CHAMFER, row, col, seed);
  return {
    minX: x,
    maxX: x + TILE_W,
    top: y,
    bottom: y + TILE_H,
    points,
    frame: hash2(row, col + 149, seed) < 0.34
      ? octagon(x, y, TILE_W, TILE_H, 6.2, 2.4, row, col, seed)
      : null,
    color: cryptColor(hash2(row, col, seed)),
    highlight: 0.065 + hash2(row, col + 151, seed) * 0.05,
    crack: makeCrack(x, y, row, col, seed),
    motif,
    damp,
  };
}

function buildRows(worldWidth, worldHeight, seed) {
  const rows = [];
  const firstRow = -2;
  const lastRow = Math.ceil(worldHeight / TILE_H) + 2;

  for (let row = firstRow; row <= lastRow; row++) {
    const y = row * TILE_H;
    const offset = (row & 1) === 0 ? 0 : -TILE_W * 0.5;
    const tiles = [];
    let col = -2;
    let x = offset - OVERSCAN;

    while (x < worldWidth + OVERSCAN) {
      tiles.push(makeTile(row, col, x, y, seed));
      col++;
      x += TILE_W;
    }
    rows.push({ top: y, bottom: y + TILE_H, tiles });
  }
  return rows;
}

function drawMotif(ctx, motif) {
  ctx.save();
  ctx.translate(motif.x, motif.y);
  ctx.strokeStyle = "rgba(9, 13, 18, 0.34)";
  ctx.lineWidth = 1.15;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (motif.type === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, motif.radius, 0, Math.PI * 2);
    ctx.moveTo(0, -motif.radius + 2);
    ctx.lineTo(0, motif.radius - 2);
    ctx.moveTo(-motif.radius * 0.55, -1);
    ctx.lineTo(motif.radius * 0.55, -1);
    ctx.stroke();
  } else if (motif.type === 1) {
    ctx.beginPath();
    ctx.moveTo(0, -motif.radius);
    ctx.lineTo(motif.radius, 0);
    ctx.lineTo(0, motif.radius);
    ctx.lineTo(-motif.radius, 0);
    ctx.closePath();
    ctx.moveTo(motif.radius * 0.34, 0);
    ctx.arc(0, 0, motif.radius * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-motif.radius * 0.7, -motif.radius * 0.7);
    ctx.lineTo(motif.radius * 0.7, motif.radius * 0.7);
    ctx.moveTo(motif.radius * 0.7, -motif.radius * 0.7);
    ctx.lineTo(-motif.radius * 0.7, motif.radius * 0.7);
    ctx.moveTo(-motif.radius * 0.8, 0);
    ctx.lineTo(motif.radius * 0.8, 0);
    ctx.stroke();
  }

  // A tiny lower-right highlight makes the carving read as recessed.
  ctx.translate(0.65, 0.7);
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#aab7c5";
  ctx.lineWidth = 0.55;
  if (motif.type === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, motif.radius, 0.1, Math.PI * 0.9);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-motif.radius * 0.65, motif.radius * 0.65);
    ctx.lineTo(0, motif.radius);
    ctx.lineTo(motif.radius * 0.65, motif.radius * 0.65);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTile(ctx, tile) {
  tracePolygon(ctx, tile.points, 0.8, 1.25);
  ctx.fillStyle = "rgba(3, 6, 10, 0.34)";
  ctx.fill();

  tracePolygon(ctx, tile.points);
  ctx.fillStyle = tile.color;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(tile.points[6].x, tile.points[6].y);
  ctx.lineTo(tile.points[7].x, tile.points[7].y);
  ctx.lineTo(tile.points[0].x, tile.points[0].y);
  ctx.lineTo(tile.points[1].x, tile.points[1].y);
  ctx.strokeStyle = `rgba(215, 225, 235, ${tile.highlight})`;
  ctx.lineWidth = 0.9;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tile.points[2].x, tile.points[2].y);
  ctx.lineTo(tile.points[3].x, tile.points[3].y);
  ctx.lineTo(tile.points[4].x, tile.points[4].y);
  ctx.lineTo(tile.points[5].x, tile.points[5].y);
  ctx.strokeStyle = "rgba(2, 5, 9, 0.38)";
  ctx.lineWidth = 1.05;
  ctx.stroke();

  if (tile.frame) {
    tracePolygon(ctx, tile.frame);
    ctx.strokeStyle = "rgba(8, 12, 17, 0.22)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  if (tile.damp) {
    ctx.beginPath();
    ctx.ellipse(tile.damp.x, tile.damp.y, tile.damp.rx, tile.damp.ry, tile.damp.angle, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(17, 31, 32, ${tile.damp.alpha})`;
    ctx.fill();
  }

  if (tile.motif) drawMotif(ctx, tile.motif);

  if (tile.crack) {
    ctx.beginPath();
    ctx.moveTo(tile.crack[0].x, tile.crack[0].y);
    for (let i = 1; i < tile.crack.length; i++) {
      ctx.lineTo(tile.crack[i].x, tile.crack[i].y);
    }
    ctx.strokeStyle = "rgba(4, 7, 11, 0.52)";
    ctx.lineWidth = 0.8;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

export function createCryptFloor({ worldWidth, worldHeight, seed = 1 }) {
  const rows = buildRows(worldWidth, worldHeight, seed | 0);

  function draw(ctx, cam, viewportWidth, viewportHeight) {
    const left = cam.px - 4;
    const right = cam.px + viewportWidth + 4;
    const top = cam.py - 4;
    const bottom = cam.py + viewportHeight + 4;

    ctx.fillStyle = "#171d24";
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    ctx.save();
    ctx.translate(-cam.px, -cam.py);
    for (const row of rows) {
      if (row.bottom < top || row.top > bottom) continue;
      for (const tile of row.tiles) {
        if (tile.maxX < left || tile.minX > right) continue;
        drawTile(ctx, tile);
      }
    }
    ctx.restore();
  }

  return { draw };
}
