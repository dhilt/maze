import { damageWall, getWall } from "../../world/maze.js";
import { resolveImpact } from "./impact.js";
import { advanceAction, attackContactElapsed } from "./runner.js";

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
  damageRoll,
  statWear,
  onStatChange,
  onImpact,
}) {
  let state = null;

  function begin(resolved) {
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
        powerEfficiency: character.attackEfficiency,
        defense: wall.stats.defense,
        defenseEfficiency: 1,
        impactWear: wall.impactWear,
        roll: damageRoll(),
        wearMultiplier: SWORD_IMPACT.wearMultiplier,
      });
      damageWall(world, x, y, dx, dy, impact.damage);
      const wear = statWear.apply(SWORD_IMPACT.wearStat, impact.statWear);
      if (wear.lost > 0) onStatChange?.(wear);
    }
  }

  function update(deltaUnits, startOffset = 0) {
    if (!state) return 0;
    const { previousElapsed, leftover, done } = advanceAction(state, deltaUnits);
    const evaluationElapsed = attackContactElapsed(state, previousElapsed);
    if (evaluationElapsed !== null) {
      if (state.kind === "wallAttack") {
        state.contactResolved = true;
        resolveWallContact(state);
      } else {
        onImpact({
          at: startOffset + evaluationElapsed - previousElapsed,
          attacker: { type: "player" },
          targetCell: state.targetCell,
          strike: state,
        });
      }
    }
    if (!done) return 0;
    state = null;
    return leftover;
  }

  return {
    begin,
    update,
    get active() { return state !== null; },
    get state() { return state; },
  };
}
