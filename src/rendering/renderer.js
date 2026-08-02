// Renderer module — all canvas drawing.
// Draws a fixed viewport onto a larger world at a continuous camera offset,
// plus debug helpers (cell numbers, static-viewport outline).
// Gets its sprites from the character renderer; gets plain state + camera from the game loop.

import { buildAttackSprites, buildSprites } from "./character/knight-sprites.js";
import { createFloor, isFloorStyle } from "./floors/index.js";
import { drawWalls } from "./walls.js";

// createRenderer(ctx, config) → { render(state) }
// config: { cellSize, viewCols, viewRows, worldCols, worldRows, phases, margin, debug }
export function createRenderer(ctx, config) {
  const {
    cellSize: CELL,
    viewCols: VC, viewRows: VR,
    worldCols: WC, worldRows: WR,
    phases: PHASES,
    margin: MARGIN, debug,
    floorStyle = "crypt",
  } = config;

  const SPRITES = buildSprites();
  const ATTACK_SPRITES = buildAttackSprites();
  const W = VC * CELL;
  const H = VR * CELL;
  const numFont = `${Math.round(CELL * 0.17)}px system-ui, sans-serif`;
  let floorRenderer = null;
  let floorCacheKey = null;

  function getFloor(world, requestedStyle) {
    const seed = Number.isFinite(world.seed) ? world.seed : 1;
    const style = isFloorStyle(requestedStyle) ? requestedStyle : "stone";
    const cacheKey = `${style}:${seed}`;
    if (!floorRenderer || floorCacheKey !== cacheKey) {
      floorRenderer = createFloor(style, {
        worldWidth: WC * CELL,
        worldHeight: WR * CELL,
        seed,
      });
      floorCacheKey = cacheKey;
    }
    return floorRenderer;
  }

  // Draw the continuous floor, optional gameplay grid, then the maze walls.
  function drawWorld(cam, world, dbg, activeFloorStyle) {
    getFloor(world, activeFloorStyle).draw(ctx, cam, W, H);

    // The gameplay grid is a debug overlay only. With debug off the slabs
    // read as one continuous floor instead of a board of stamped cells.
    if (dbg) {
      const startCol = Math.floor(cam.px / CELL);
      const startRow = Math.floor(cam.py / CELL);
      ctx.strokeStyle = "rgba(230, 235, 242, 0.075)";
      ctx.lineWidth = 1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = numFont;
      for (let r = startRow; r <= startRow + VR; r++) {
        for (let c = startCol; c <= startCol + VC; c++) {
          if (c < 0 || c >= WC || r < 0 || r >= WR) continue;
          const sx = c * CELL - cam.px;
          const sy = r * CELL - cam.py;
          ctx.strokeRect(sx + 0.5, sy + 0.5, CELL, CELL);
          ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
          ctx.fillText(`${c}/${r}`, sx + CELL / 2, sy + CELL / 2);
        }
      }
    }

    drawWalls(ctx, {
      cam,
      world,
      cellSize: CELL,
      viewCols: VC,
      viewRows: VR,
      worldCols: WC,
      worldRows: WR,
    });

  }

  function drawPlayer({ player, move, attack, facing }, cam) {
    let wx = player.col * CELL;
    let wy = player.row * CELL;
    let frame = 0; // standing pose when idle
    if (move) {
      const progress = Math.min(move.elapsed / move.timeCost, 1);
      wx += move.dx * CELL * progress;
      wy += move.dy * CELL * progress;
      frame = Math.floor(progress * PHASES) % PHASES;
    }
    const sx = wx - cam.px;
    const sy = wy - cam.py;

    let img = SPRITES[facing][frame];
    if (attack) {
      const frames = ATTACK_SPRITES[facing];
      const progress = Math.min(attack.elapsed / attack.timeCost, 0.999999);
      img = frames[Math.floor(progress * frames.length)];
    }
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, sx, sy, CELL, CELL);
    } else {
      const inset = 3;
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(sx + inset, sy + inset, CELL - inset * 2, CELL - inset * 2);
    }
  }

  function render(state) {
    const { cam, world } = state;
    const dbg = state.debug !== undefined ? state.debug : debug; // live toggle, else config default
    const activeFloorStyle = state.floorStyle || floorStyle;
    ctx.clearRect(0, 0, W, H);
    drawWorld(cam, world, dbg, activeFloorStyle);
    drawPlayer(state, cam);
  }

  return { render };
}
