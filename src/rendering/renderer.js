// Renderer module — all canvas drawing.
// Draws a fixed viewport onto a larger world at a continuous camera offset,
// plus debug helpers (cell numbers, static-viewport outline).
// Gets its sprites from the character renderer; gets plain state + camera from the game loop.

import { KNIGHT_ASSET_PACK } from "../assets/packs/knight.js";
import { MEAT_MONSTER_ASSET_PACK } from "../assets/packs/meat-monster.js";
import {
  KNIGHT_IDLE_FRAME_UNITS,
  selectAttackFrame,
} from "./character/knight-sprites.js";
import { drawExits } from "./exits.js";
import { createEnemyRenderState, drawEnemies } from "./enemies.js";
import { createFloor, isFloorStyle } from "./floors/index.js";
import { drawObjects } from "./objects/index.js";
import { drawWalls } from "./walls.js";

// createRenderer(ctx, config) → { render(state) }
// config: { cellSize, viewCols, viewRows, margin, debug }
export function createRenderer(ctx, config) {
  const {
    cellSize: CELL,
    viewCols: VC, viewRows: VR,
    debug,
    floorStyle = "crypt",
    assets,
  } = config;

  const knightAssets = assets.get(KNIGHT_ASSET_PACK.id);
  const meatMonsterAssets = assets.get(MEAT_MONSTER_ASSET_PACK.id);
  const KNIGHT_SPRITES = knightAssets.animations;
  const MEAT_MONSTER_SPRITES = meatMonsterAssets.animations;
  const OBJECT_SPRITES = {
    corpse: { [MEAT_MONSTER_ASSET_PACK.id]: meatMonsterAssets.images.corpse },
  };
  const ENEMY_RENDER_STATE = createEnemyRenderState();
  const W = VC * CELL;
  const H = VR * CELL;
  const numFont = `${Math.round(CELL * 0.17)}px system-ui, sans-serif`;
  let floorRenderer = null;
  let floorCacheKey = null;

  function getFloor(world, requestedStyle) {
    const seed = Number.isFinite(world.seed) ? world.seed : 1;
    const style = isFloorStyle(requestedStyle) ? requestedStyle : "stone";
    const cacheKey = `${style}:${seed}:${world.width}x${world.height}`;
    if (!floorRenderer || floorCacheKey !== cacheKey) {
      floorRenderer = createFloor(style, {
        worldWidth: world.width * CELL,
        worldHeight: world.height * CELL,
        seed,
      });
      floorCacheKey = cacheKey;
    }
    return floorRenderer;
  }

  // Draw the continuous floor, optional gameplay grid, then the maze walls.
  function drawWorld(cam, world, dbg, activeFloorStyle, time, entities) {
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
          if (c < 0 || c >= world.width || r < 0 || r >= world.height) continue;
          const sx = c * CELL - cam.px;
          const sy = r * CELL - cam.py;
          ctx.strokeRect(sx + 0.5, sy + 0.5, CELL, CELL);
          ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
          ctx.fillText(`${c}/${r}`, sx + CELL / 2, sy + CELL / 2);
        }
      }
    }

    drawObjects(ctx, {
      cam,
      world,
      cellSize: CELL,
      viewCols: VC,
      viewRows: VR,
      objectSprites: OBJECT_SPRITES,
      entities,
    });

    drawExits(ctx, {
      cam,
      world,
      cellSize: CELL,
      viewCols: VC,
      viewRows: VR,
      time,
    });

    drawWalls(ctx, {
      cam,
      world,
      cellSize: CELL,
      viewCols: VC,
      viewRows: VR,
      worldCols: world.width,
      worldRows: world.height,
    });

  }

  function drawPlayer({ player, move, attack, facing, tick }, cam) {
    let wx = player.col * CELL;
    let wy = player.row * CELL;
    if (move) {
      const progress = Math.min(move.elapsed / move.timeCost, 1);
      wx += move.dx * CELL * progress;
      wy += move.dy * CELL * progress;
    }
    const sx = wx - cam.px;
    const sy = wy - cam.py;

    const idleTime = Number.isFinite(tick?.time) ? tick.time : 0;
    const idleFrames = KNIGHT_SPRITES.idle[facing];
    let img = idleFrames[
      Math.floor(idleTime / KNIGHT_IDLE_FRAME_UNITS) % idleFrames.length
    ];
    if (move) {
      const frames = KNIGHT_SPRITES.walk[facing];
      const progress = Math.min(move.elapsed / move.timeCost, 0.999999);
      img = frames[Math.floor(progress * frames.length)];
    }
    if (attack) {
      const frames = KNIGHT_SPRITES.attack[facing];
      const progress = Math.min(attack.elapsed / attack.timeCost, 0.999999);
      img = frames[selectAttackFrame(progress, frames.length)];
    }
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, sx, sy, CELL, CELL);
    }
  }

  function render(state) {
    const { cam, world } = state;
    const dbg = state.debug !== undefined ? state.debug : debug; // live toggle, else config default
    const activeFloorStyle = state.floorStyle || floorStyle;
    const time = Number.isFinite(state.tick?.time) ? state.tick.time : 0;
    ctx.clearRect(0, 0, W, H);

    // All world-space rendering is clipped to the actual world rectangle. This
    // keeps floor themes and effects from leaking into a centred empty margin.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-cam.px, -cam.py, world.width * CELL, world.height * CELL);
    ctx.clip();
    drawWorld(cam, world, dbg, activeFloorStyle, time, state.monsters ?? []);
    drawEnemies(ctx, {
      monsters: state.monsters ?? [],
      cam,
      cellSize: CELL,
      meatMonsterSprites: MEAT_MONSTER_SPRITES,
      player: state.player,
      playerMove: state.move,
      realTime: Number.isFinite(state.tick?.realTime) ? state.tick.realTime : 0,
      renderState: ENEMY_RENDER_STATE,
    });
    drawPlayer(state, cam);
    ctx.restore();
  }

  return { render };
}
