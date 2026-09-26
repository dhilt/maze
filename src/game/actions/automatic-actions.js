import { hasWall } from "../../world/maze.js";
import { ACTION, DIRS, directionToAdjacent } from "./intent.js";

// Chooses an intent only when the scheduler has no newer player command.
// A manual face can lead to one immediate directional intent; otherwise a fresh
// attacker takes precedence over the passive attack on the front cell.
export function createAutomaticActions({ world, player, monsters }) {
  let attackerId = null;

  function adjacentMonster(id) {
    return monsters.find((monster) => (
      monster.id === id &&
      monster.stats.health > 0 &&
      directionToAdjacent(player, monster) !== null
    )) ?? null;
  }

  function hasFacingThreat() {
    return monsters.some((monster) => {
      if (monster.stats.health <= 0) return false;
      const direction = directionToAdjacent(monster, player);
      if (direction === null || monster.facing !== direction) return false;
      const { dx, dy } = DIRS[direction];
      return !hasWall(world, monster.col, monster.row, dx, dy);
    });
  }

  function onAttackStart({ monsterId }) {
    const current = adjacentMonster(attackerId);
    const incoming = adjacentMonster(monsterId);
    if (current === null) {
      attackerId = monsterId;
      return;
    }
    const currentIsFront = directionToAdjacent(player, current) === player.facing;
    const incomingIsSide = incoming !== null &&
      directionToAdjacent(player, incoming) !== player.facing;
    if (currentIsFront && incomingIsSide) attackerId = monsterId;
  }

  function onManualIntent() {
    attackerId = null;
  }

  function nextIntent({ afterManualFace = null, allowCombat = true } = {}) {
    if (afterManualFace !== null && hasFacingThreat()) return afterManualFace;
    if (!allowCombat) return null;

    const attacker = adjacentMonster(attackerId);
    attackerId = attacker?.id ?? null;
    if (attacker !== null) {
      // The reaction has reached its attack phase; later threats may replace it.
      if (player.facing === directionToAdjacent(player, attacker)) attackerId = null;
      return { kind: ACTION.engage, targetId: attacker.id };
    }

    const front = monsters.find((monster) => (
      monster.stats.health > 0 &&
      directionToAdjacent(player, monster) === player.facing
    ));
    return front ? { kind: ACTION.engage, targetId: front.id } : null;
  }

  return { onAttackStart, onManualIntent, nextIntent };
}
