import {
  ATTACK_ACTIVE_END_PROGRESS,
  ATTACK_CONTACT_PROGRESS,
} from "./attack-timing.js";

export function advanceAction(action, deltaUnits) {
  const previousElapsed = action.elapsed;
  action.elapsed += deltaUnits;
  if (action.elapsed < action.timeCost) {
    return { previousElapsed, leftover: 0, done: false };
  }
  const leftover = action.elapsed - action.timeCost;
  action.elapsed = action.timeCost;
  return { previousElapsed, leftover, done: true };
}

export function attackContactElapsed(action, previousElapsed) {
  const contactElapsed = action.timeCost * ATTACK_CONTACT_PROGRESS;
  if (action.kind === "wallAttack") {
    return action.elapsed >= contactElapsed && !action.contactResolved
      ? contactElapsed
      : null;
  }
  if (action.kind !== "attack" || action.hitResolved || !action.targetCell) {
    return null;
  }
  const activeEnd = action.timeCost * ATTACK_ACTIVE_END_PROGRESS;
  if (action.elapsed >= contactElapsed && previousElapsed < activeEnd) {
    return Math.max(previousElapsed, contactElapsed);
  }
  return null;
}
