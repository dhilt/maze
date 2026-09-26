import { hasWall } from "../../world/maze.js";
import { actorPosition } from "../actor-position.js";
import { inAttackArea } from "../attack-area.js";
import { ATTACK_CONTACT_PROGRESS } from "./attack-timing.js";
import { ACTION, DIRS, directionToAdjacent } from "./intent.js";

// Chooses an intent only when the scheduler has no newer player command.
// A manual face can lead to one immediate directional intent. Otherwise the
// hero prefers current neighbours, then monsters entering neighbouring cells.
export function createAutomaticActions({ world, player, monsters, character }) {
  function openDirection(from, to) {
    const direction = directionToAdjacent(from, to);
    if (direction === null) return null;
    const { dx, dy } = DIRS[direction];
    return hasWall(world, from.col, from.row, dx, dy) ? null : direction;
  }

  function hasFacingThreat() {
    return monsters.some((monster) => (
      monster.stats.health > 0 &&
      openDirection(monster, player) === monster.facing
    ));
  }

  function engage(monster, targetCell) {
    return { kind: ACTION.engage, targetId: monster.id, targetCell };
  }

  function nextIntent({
    afterManualFace = null,
    allowCombat = true,
    frameElapsed = 0,
  } = {}) {
    if (afterManualFace !== null && hasFacingThreat()) return afterManualFace;
    if (!allowCombat) return null;

    let side = null;
    for (const monster of monsters) {
      if (monster.stats.health <= 0) continue;
      const direction = openDirection(player, monster);
      if (direction === player.facing) {
        return engage(monster, { col: monster.col, row: monster.row });
      }
      if (direction !== null && side === null) side = monster;
    }
    if (side !== null) return engage(side, { col: side.col, row: side.row });

    let approachingSide = null;
    for (const monster of monsters) {
      const move = monster.move;
      if (monster.stats.health <= 0 || move?.kind !== ACTION.step) continue;
      const targetCell = { col: monster.col + move.dx, row: monster.row + move.dy };
      const direction = openDirection(player, targetCell);
      if (direction === null) continue;

      const lead = frameElapsed +
        (direction === player.facing ? 0 : character.actionCosts.face) +
        character.actionCosts.attack * ATTACK_CONTACT_PROGRESS;
      // Enemies update after this choice; project only their committed step.
      const projected = actorPosition(monster, {
        ...move,
        elapsed: Math.min(move.elapsed + lead, move.timeCost),
      });
      if (!inAttackArea(player, targetCell, projected)) continue;
      if (direction === player.facing) return engage(monster, targetCell);
      approachingSide ??= { monster, targetCell };
    }
    return approachingSide === null
      ? null
      : engage(approachingSide.monster, approachingSide.targetCell);
  }

  return { nextIntent };
}
