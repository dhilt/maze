// Executes a concrete locomotion action produced by the adapter: a step (moves a
// cell over its duration) or a turn (instant, changes only facing). Does no wall
// logic itself — it just runs the resolved action.
export function createMovement({ player, cellSize }) {
  let action = null; // resolved action: { kind, dx, dy, duration, facing, t }
  let facing = "down";

  function begin(resolved) {
    action = { ...resolved, t: 0 };
    if (resolved.facing) facing = resolved.facing;
  }

  // Advance; returns leftover dt on completion (else 0). A step applies its cell
  // move when it lands; a turn (duration 0) completes on the first tick.
  function update(dt) {
    if (!action) return 0;
    action.t += dt;
    if (action.t >= action.duration) {
      if (action.kind === "step") {
        player.col += action.dx;
        player.row += action.dy;
      }
      const leftover = action.t - action.duration;
      action = null;
      return leftover;
    }
    return 0;
  }

  function getPixelPosition() {
    const stepping = action && action.kind === "step";
    const progress = stepping ? Math.min(action.t / action.duration, 1) : 0;
    return {
      x: player.col * cellSize + (stepping ? action.dx * cellSize * progress : 0),
      y: player.row * cellSize + (stepping ? action.dy * cellSize * progress : 0),
    };
  }

  return {
    begin,
    update,
    getPixelPosition,
    get move() { return action && action.kind === "step" ? action : null; },
    get active() { return action !== null; },
    get facing() { return facing; },
  };
}
