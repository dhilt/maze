import { ACTION } from "./intent.js";

// Executes a concrete locomotion action produced by the adapter: a step (moves a
// cell over its time cost) or a face (changes only facing). Does no wall logic
// itself — it just runs the resolved action in logical game-time units.
export function createMovement({ player, cellSize }) {
  let action = null; // resolved action + { elapsed }; all time is in game units

  function begin(resolved) {
    action = { ...resolved, elapsed: 0 };
    if (resolved.facing) player.facing = resolved.facing;
  }

  // Advance by logical units; return leftover units on completion (else 0).
  function update(deltaUnits) {
    if (!action) return 0;
    action.elapsed += deltaUnits;
    if (action.elapsed >= action.timeCost) {
      if (action.kind === ACTION.step) {
        player.col += action.dx;
        player.row += action.dy;
      }
      const leftover = action.elapsed - action.timeCost;
      action = null;
      return leftover;
    }
    return 0;
  }

  function getPixelPosition() {
    const stepping = action && action.kind === ACTION.step;
    const progress = stepping ? Math.min(action.elapsed / action.timeCost, 1) : 0;
    return {
      x: player.col * cellSize + (stepping ? action.dx * cellSize * progress : 0),
      y: player.row * cellSize + (stepping ? action.dy * cellSize * progress : 0),
    };
  }

  return {
    begin,
    update,
    getPixelPosition,
    get move() { return action && action.kind === ACTION.step ? action : null; },
    get active() { return action !== null; },
    get facing() { return player.facing; },
  };
}
