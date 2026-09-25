export const BLOOD_DURATION_SECONDS = 0.34;

const BRIGHT_PHASE_SECONDS = 0.09;
const PARTICLE_COUNT = 7;
const COLORS = ["#b5232b", "#d4383e", "#8e1824"];
const BRIGHT_RED = "#ff4b54";

// All variation is sampled once at impact; drawing the same time twice is stable.
export function createBloodEffects({ cellSize, random = Math.random }) {
  let bursts = [];

  function spawn({ target, attacker }, now) {
    const x = target.x + cellSize / 2;
    const y = target.y + cellSize / 2;
    const awayX = target.x - attacker.x;
    const awayY = target.y - attacker.y;
    const baseAngle = Math.atan2(awayY, awayX);
    const particles = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = baseAngle + (random() - 0.5) * 2.2;
      const distance = cellSize * (0.19 + random() * 0.25);
      const offset = cellSize * random() * 0.06;
      particles.push({
        x: x + Math.cos(angle) * offset,
        y: y + Math.sin(angle) * offset,
        dx: Math.cos(angle) * (distance + (i < 2 ? cellSize * 0.06 : 0)),
        dy: Math.sin(angle) * (distance + (i < 2 ? cellSize * 0.06 : 0)),
        size: Math.max(2, Math.round(cellSize * (0.025 + random() * 0.015)))
          + (i < 2 ? 1 : 0),
        color: i < 2 ? BRIGHT_RED : COLORS[Math.floor(random() * COLORS.length)],
      });
    }
    bursts.push({
      startedAt: now,
      x,
      y,
      accentSize: Math.max(4, Math.round(cellSize * 0.09)),
      particles,
    });
  }

  function draw(ctx, cam, now) {
    bursts = bursts.filter(({ startedAt }) => now - startedAt < BLOOD_DURATION_SECONDS);
    for (const { startedAt, x, y, accentSize, particles } of bursts) {
      const age = Math.max(0, now - startedAt);
      const progress = Math.min(age / BLOOD_DURATION_SECONDS, 1);
      const travel = progress * (2 - progress);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (BLOOD_DURATION_SECONDS - age)
        / (BLOOD_DURATION_SECONDS - BRIGHT_PHASE_SECONDS));
      for (const particle of particles) {
        ctx.fillStyle = particle.color;
        ctx.fillRect(
          Math.round(particle.x + particle.dx * travel - cam.px),
          Math.round(particle.y + particle.dy * travel - cam.py),
          particle.size,
          particle.size,
        );
      }
      if (age < BRIGHT_PHASE_SECONDS) {
        const centerX = Math.round(x - cam.px);
        const centerY = Math.round(y - cam.py);
        ctx.globalAlpha = 1 - age / BRIGHT_PHASE_SECONDS;
        ctx.fillStyle = BRIGHT_RED;
        ctx.fillRect(centerX - 2, centerY - 2, accentSize, accentSize - 1);
        ctx.fillRect(centerX + accentSize - 2, centerY - 1, 2, 2);
        ctx.fillRect(centerX - 3, centerY + accentSize - 3, 2, 2);
      }
      ctx.restore();
    }
    return bursts.length > 0;
  }

  function clear() { bursts = []; }

  return { spawn, draw, clear };
}
