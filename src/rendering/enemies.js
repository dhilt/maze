import {
  selectMeatMonsterAttackFrame,
  selectMeatMonsterWalkFrame,
} from "./meat-monster-sprites.js";

const HEALTH_BAR_WIDTH = 28;
const HEALTH_BAR_HEIGHT = 2;
const HEALTH_BAR_BACKGROUND = "rgba(20, 8, 10, 0.58)";
const HEALTH_BAR_FILL = "rgba(184, 48, 56, 0.84)";
const DEBUG_STATS_COLOR = "rgba(255, 255, 255, 0.82)";

export const HEALTH_BAR_HIDE_DELAY_SECONDS = 1;

export function createEnemyRenderState() {
  return { healthBarVisibleUntil: new Map() };
}

function pixelPosition(monster, cellSize) {
  let x = monster.col * cellSize;
  let y = monster.row * cellSize;
  if (monster.move) {
    const progress = Math.min(monster.move.elapsed / monster.move.timeCost, 1);
    x += monster.move.dx * cellSize * progress;
    y += monster.move.dy * cellSize * progress;
  }
  return { x, y };
}

function drawHealthBar(ctx, monster, cellSize) {
  const health = monster.stats?.health;
  const maxHealth = monster.statsMax?.health;
  if (!Number.isFinite(health) || !Number.isFinite(maxHealth) || maxHealth <= 0) return;

  const ratio = Math.max(0, Math.min(1, health / maxHealth));
  const width = Math.min(HEALTH_BAR_WIDTH, Math.max(1, cellSize - 4));
  const x = -Math.floor(width / 2);
  const y = -cellSize / 2 + 9;
  ctx.fillStyle = HEALTH_BAR_BACKGROUND;
  ctx.fillRect(x, y, width, HEALTH_BAR_HEIGHT);
  if (ratio === 0) return;
  ctx.fillStyle = HEALTH_BAR_FILL;
  ctx.fillRect(x, y, Math.max(1, Math.round(width * ratio)), HEALTH_BAR_HEIGHT);
}

function drawDebugStats(ctx, monster, cellSize) {
  const { health, attack, defense } = monster.stats;
  const values = [health, attack, defense]
    .map(Math.round)
    .join(" ");
  ctx.fillStyle = DEBUG_STATS_COLOR;
  ctx.font = `600 ${Math.max(6, Math.round(cellSize * 0.11))}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(
    values,
    0,
    -cellSize / 2 + 13,
  );
}

function occupiedCell(actor, move = actor.move) {
  return {
    col: actor.col + (move?.kind === "step" ? move.dx : 0),
    row: actor.row + (move?.kind === "step" ? move.dy : 0),
  };
}

function isAlive(monster) {
  return (monster.stats?.health ?? 1) > 0;
}

function healthBarVisible(monster, adjacent, realTime, renderState) {
  const visibleUntil = renderState.healthBarVisibleUntil;
  if (adjacent) {
    visibleUntil.set(monster.id, realTime + HEALTH_BAR_HIDE_DELAY_SECONDS);
    return true;
  }
  if (realTime < (visibleUntil.get(monster.id) ?? -Infinity)) return true;
  visibleUntil.delete(monster.id);
  return false;
}

function drawMeatMonster(
  ctx,
  monster,
  cam,
  cellSize,
  sprites,
  player,
  playerMove,
  realTime,
  renderState,
  debug,
) {
  const position = pixelPosition(monster, cellSize);
  const x = position.x - cam.px + cellSize / 2;
  const y = position.y - cam.py + cellSize / 2;
  let frames = sprites?.walk?.[monster.facing];
  let image = frames?.[
    selectMeatMonsterWalkFrame(monster.move, frames.length)
  ];
  const attackFrames = sprites?.attack?.[monster.facing];
  if (monster.attack && attackFrames) {
    frames = attackFrames;
    image = frames[
      selectMeatMonsterAttackFrame(monster.attack, frames.length)
    ];
  }

  ctx.save();
  ctx.translate(x, y);
  if (image?.complete && image.naturalWidth) {
    ctx.drawImage(image, -cellSize / 2, -cellSize / 2, cellSize, cellSize);
  }
  if (player || debug) {
    const monsterCell = occupiedCell(monster);
    const playerCell = player ? occupiedCell(player, playerMove) : null;
    const adjacent = playerCell !== null && (
      Math.abs(monsterCell.col - playerCell.col) +
      Math.abs(monsterCell.row - playerCell.row)
    ) === 1;
    const contactVisible = player
      ? healthBarVisible(monster, adjacent, realTime, renderState)
      : false;
    if (debug || contactVisible) {
      drawHealthBar(ctx, monster, cellSize);
    }
    if (debug) drawDebugStats(ctx, monster, cellSize);
  }
  ctx.restore();
}

export function drawEnemies(ctx, {
  monsters,
  cam,
  cellSize,
  meatMonsterSprites,
  player,
  playerMove,
  realTime = 0,
  renderState = createEnemyRenderState(),
  debug = false,
}) {
  const liveIds = new Set(monsters
    .filter(isAlive)
    .map(({ id }) => id));
  for (const id of renderState.healthBarVisibleUntil.keys()) {
    if (!liveIds.has(id)) renderState.healthBarVisibleUntil.delete(id);
  }
  for (const monster of monsters) {
    if (isAlive(monster) && monster.kind === "meat-monster") {
      drawMeatMonster(
        ctx,
        monster,
        cam,
        cellSize,
        meatMonsterSprites,
        player,
        playerMove,
        realTime,
        renderState,
        debug,
      );
    }
  }
}
