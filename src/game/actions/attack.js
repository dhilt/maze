import { damageWall, getWall } from "../../world/maze.js";
import { resolveImpact } from "./impact.js";

const SWORD_IMPACT = Object.freeze({
  powerStat: "attack",
  wearStat: "attack",
  wearMultiplier: 1,
});

// Executes concrete attack and wallAttack actions produced by the adapter.
// Both use the same animation/timing; a wall hit lands only on completion.
export function createAttack({ world, character, statWear, onStatChange } = {}) {
  let state = null;

  function begin(resolved) {
    if (resolved.kind === "wallAttack" && (!world || !character || !statWear)) {
      throw new Error("wallAttack requires a world, character and statWear");
    }
    state = { ...resolved, elapsed: 0 };
  }

  function update(deltaUnits) {
    if (!state) return 0;
    state.elapsed += deltaUnits;
    if (state.elapsed >= state.timeCost) {
      const completed = state;
      const leftover = state.elapsed - state.timeCost;
      state = null;
      if (completed.kind === "wallAttack") {
        const { x, y, dx, dy } = completed.target;
        const wall = getWall(world, x, y, dx, dy);
        if (wall !== null) {
          const impact = resolveImpact({
            power: character.stats[SWORD_IMPACT.powerStat],
            defense: wall.stats.defense,
            impactWear: wall.impactWear,
            wearMultiplier: SWORD_IMPACT.wearMultiplier,
          });
          damageWall(world, x, y, dx, dy, impact.damage);
          const wear = statWear.apply(SWORD_IMPACT.wearStat, impact.statWear);
          if (wear.lost > 0) onStatChange?.(wear);
        }
      }
      return leftover;
    }
    return 0;
  }

  return {
    begin,
    update,
    get active() { return state !== null; },
    get state() { return state; },
  };
}
