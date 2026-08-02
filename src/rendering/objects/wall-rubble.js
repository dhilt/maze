import { createRandom } from "../../world/random.js";

const STONE_COLORS = [
  "rgba(126, 130, 132, 0.34)",
  "rgba(105, 111, 115, 0.30)",
  "rgba(143, 139, 130, 0.25)",
];

function edgePoint(vertical, x, y, along, normal) {
  return vertical ? [x + normal, y + along] : [x + along, y + normal];
}

export function drawWallRubble(ctx, { object, x, y, cellSize }) {
  const edge = object.placement?.type === "edge" ? object.placement.edge : null;
  if (edge !== "right" && edge !== "down") return;

  const vertical = edge === "right";
  const edgeX = vertical ? x + cellSize : x;
  const edgeY = vertical ? y : y + cellSize;
  const rand = createRandom(object.visualSeed >>> 0);

  ctx.save();
  for (let index = 0; index < 8; index++) {
    const along = cellSize * (0.08 + (index + rand() * 0.55) * 0.105);
    const normal = (rand() - 0.5) * cellSize * 0.105;
    const alongRadius = cellSize * (0.045 + rand() * 0.025);
    const normalRadius = cellSize * (0.025 + rand() * 0.018);
    const points = [
      [-0.7, -1], [0.65, -0.82], [1, 0.05],
      [0.45, 1], [-0.75, 0.76], [-1, -0.12],
    ];

    ctx.beginPath();
    for (let point = 0; point < points.length; point++) {
      const [normalFactor, alongFactor] = points[point];
      const coords = edgePoint(
        vertical,
        edgeX,
        edgeY,
        along + alongFactor * alongRadius,
        normal + normalFactor * normalRadius,
      );
      if (point === 0) ctx.moveTo(...coords);
      else ctx.lineTo(...coords);
    }
    ctx.closePath();
    ctx.fillStyle = STONE_COLORS[index % STONE_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "rgba(52, 57, 61, 0.22)";
    ctx.lineWidth = Math.max(0.55, cellSize * 0.01);
    ctx.stroke();
  }
  ctx.restore();
}
