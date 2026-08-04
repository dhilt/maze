import { damageWall, getWall } from "../../world/maze.js";
import {
  ATTACK_ACTIVE_END_PROGRESS,
  ATTACK_CONTACT_PROGRESS,
} from "./attack-timing.js";
import { resolveImpact } from "./impact.js";

const SWORD_IMPACT = Object.freeze({
  powerStat: "attack",
  wearStat: "attack",
  wearMultiplier: 1,
});

// Executes concrete attack and wallAttack actions produced by the adapter.
// Entity contacts are queued for the shared combat phase; walls resolve here.
export function createAttack({
  world,
  character,
  statWear,
  onStatChange,
  onImpact,
} = {}) {
  let state = null;

  function begin(resolved) {
    if (resolved.kind === "wallAttack" && (!world || !character || !statWear)) {
      throw new Error("wallAttack requires a world, character and statWear");
    }
    state = { ...resolved, elapsed: 0 };
    if (resolved.kind === "wallAttack") state.contactResolved = false;
    if (resolved.kind === "attack") state.hitResolved = false;
  }

  function resolveWallContact(action) {
    const { x, y, dx, dy } = action.target;
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

  function update(deltaUnits, startOffset = 0) {
    if (!state) return 0;
    const previousElapsed = state.elapsed;
    state.elapsed += deltaUnits;
    const contactElapsed = state.timeCost * ATTACK_CONTACT_PROGRESS;
    if (
      state.kind === "wallAttack" &&
      !state.contactResolved &&
      state.elapsed >= contactElapsed
    ) {
      state.contactResolved = true;
      resolveWallContact(state);
    } else if (state.kind === "attack" && state.targetCell && !state.hitResolved) {
      const activeEnd = state.timeCost * ATTACK_ACTIVE_END_PROGRESS;
      if (state.elapsed >= contactElapsed && previousElapsed < activeEnd) {
        const evaluationElapsed = Math.max(previousElapsed, contactElapsed);
        onImpact?.({
          at: startOffset + evaluationElapsed - previousElapsed,
          attacker: { type: "player" },
          targetCell: state.targetCell,
          strike: state,
        });
      }
    }
    if (state.elapsed >= state.timeCost) {
      const leftover = state.elapsed - state.timeCost;
      state = null;
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
