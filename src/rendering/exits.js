// Rendering for semantic exit markers stored directly on world cells.

import { EXIT_PHASES, getExitRevealProgress } from "../world/exit.js";

const TAU = Math.PI * 2;
const PULSE_PERIOD = 36;
const ROTATION_PERIOD = 96;
const ANNOUNCEMENT_START_SCALE = 1;
const ANNOUNCEMENT_END_SCALE = 3;

function drawPortal(ctx, x, y, cellSize, time, opacity) {
  const pulse = (Math.sin((time / PULSE_PERIOD) * TAU) + 1) / 2;
  const rotation = (time / ROTATION_PERIOD) * TAU;
  const radiusX = cellSize * 0.32;
  const radiusY = cellSize * 0.2;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x + cellSize * 0.5, y + cellSize * 0.56);

  ctx.shadowColor = `rgba(87, 220, 211, ${0.5 + pulse * 0.3})`;
  ctx.shadowBlur = cellSize * (0.12 + pulse * 0.08);
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, TAU);
  ctx.fillStyle = "rgba(5, 13, 20, 0.94)";
  ctx.fill();
  ctx.strokeStyle = "#7bd8d0";
  ctx.lineWidth = Math.max(2, cellSize * 0.055);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.ellipse(
    0,
    0,
    radiusX * (0.68 + pulse * 0.08),
    radiusY * (0.58 + pulse * 0.1),
    0,
    0,
    TAU,
  );
  ctx.fillStyle = `rgba(35, 112, 126, ${0.34 + pulse * 0.2})`;
  ctx.fill();
  ctx.strokeStyle = "rgba(193, 246, 232, 0.78)";
  ctx.lineWidth = Math.max(1, cellSize * 0.018);
  ctx.stroke();

  // The runes rotate slowly around the elliptical ring.
  ctx.strokeStyle = "rgba(207, 250, 239, 0.88)";
  ctx.lineWidth = Math.max(1, cellSize * 0.016);
  ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU + rotation;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(cos * radiusX * 0.8, sin * radiusY * 0.8);
    ctx.lineTo(cos * radiusX * 0.94, sin * radiusY * 0.94);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawExits(ctx, {
  cam,
  world,
  exitCell,
  cellSize,
  viewCols,
  viewRows,
  viewportWidth,
  viewportHeight,
  time = 0,
}) {
  const animationTime = Number.isFinite(time) ? time : 0;
  const startCol = Math.max(0, Math.floor(cam.px / cellSize) - 1);
  const startRow = Math.max(0, Math.floor(cam.py / cellSize) - 1);
  const endCol = Math.min(world.width - 1, startCol + viewCols + 2);
  const endRow = Math.min(world.height - 1, startRow + viewRows + 2);

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const progress = getExitRevealProgress(world.at(col, row), animationTime);
      if (progress <= 0) continue;
      const opacity = progress * progress * (3 - 2 * progress);
      drawPortal(
        ctx,
        col * cellSize - cam.px,
        row * cellSize - cam.py,
        cellSize,
        animationTime,
        opacity,
      );
    }
  }

  drawRevealAnnouncement(ctx, {
    exit: exitCell?.exit,
    cellSize,
    viewportWidth,
    viewportHeight,
    time: animationTime,
  });
}

function drawRevealAnnouncement(ctx, {
  exit,
  cellSize,
  viewportWidth,
  viewportHeight,
  time = 0,
}) {
  if (
    exit?.kind !== "exit" ||
    exit.phase !== EXIT_PHASES.REVEALING ||
    !Number.isFinite(time) ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    !Number.isFinite(exit.revealStartedAt) ||
    !Number.isFinite(exit.revealDuration) ||
    exit.revealDuration <= 0
  ) return;

  const progress = (time - exit.revealStartedAt) / exit.revealDuration;
  if (progress < 0 || progress >= 1) return;

  const eased = 1 - ((1 - progress) ** 3);
  const scale = (
    ANNOUNCEMENT_START_SCALE +
    (ANNOUNCEMENT_END_SCALE - ANNOUNCEMENT_START_SCALE) * eased
  );
  const opacity = 0.75 * (1 - progress);

  ctx.save();
  ctx.translate(viewportWidth / 2, viewportHeight / 2);
  ctx.scale(scale, scale);
  drawPortal(
    ctx,
    -cellSize * 0.5,
    -cellSize * 0.56,
    cellSize,
    time,
    opacity,
  );
  ctx.restore();
}
