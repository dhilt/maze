import {
  ATTACK_ACTIVE_END_PROGRESS,
  ATTACK_CONTACT_PROGRESS,
} from "./attack-timing.js";
import { ACTION } from "./intent.js";

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

// When during this update the attack connected. Null if it did not.
export function attackContactElapsed(action, previousElapsed) {
  const contactElapsed = action.timeCost * ATTACK_CONTACT_PROGRESS;
  // Wall attack: damage lands once, at the midpoint of the swing.
  if (action.kind === ACTION.attack && action.target) {
    return action.elapsed >= contactElapsed && !action.contactResolved
      ? contactElapsed
      : null;
  }
  // Not a creature attack, or this swing already connected.
  if (action.kind !== ACTION.attack || action.hitResolved || !action.targetCell) {
    return null;
  }
  // Attack on a creature: the hit stays open a bit after the midpoint,
  // so someone stepping into that cell still gets cut.
  const activeEnd = action.timeCost * ATTACK_ACTIVE_END_PROGRESS;
  if (action.elapsed >= contactElapsed && previousElapsed < activeEnd) {
    return Math.max(previousElapsed, contactElapsed);
  }
  return null;
}
