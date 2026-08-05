import { EXIT_PHASES, isExitOpen } from "../world/exit.js";

export const EXIT_REVEAL_RATIO = 0.5;

export function createExitController({
  cell,
  monsterIds,
  revealDuration,
  revealRatio = EXIT_REVEAL_RATIO,
}) {
  if (cell?.exit?.kind !== "exit") {
    throw new Error("Exit controller requires a cell with an exit marker");
  }
  if (!Array.isArray(monsterIds)) {
    throw new Error("Exit controller requires initial monster ids");
  }
  if (!Number.isFinite(revealDuration) || revealDuration <= 0) {
    throw new Error("Exit revealDuration must be a positive number");
  }
  if (!Number.isFinite(revealRatio) || revealRatio < 0 || revealRatio > 1) {
    throw new Error("Exit revealRatio must be a number in [0, 1]");
  }

  const remaining = new Set(monsterIds);
  if (remaining.size !== monsterIds.length) {
    throw new Error("Exit controller requires unique monster ids");
  }
  const exit = cell.exit;
  const initialMonsterCount = remaining.size;
  const revealAtOrBelow = Math.floor(initialMonsterCount * revealRatio);
  exit.revealDuration = revealDuration;

  function onMonsterDeath({ monster, killer, at }) {
    if (killer !== "player" || !remaining.has(monster?.id)) return false;
    if (!Number.isFinite(at) || at < 0) {
      throw new Error("Monster defeat time must be a non-negative number");
    }

    remaining.delete(monster.id);
    if (
      remaining.size <= revealAtOrBelow &&
      exit.phase === EXIT_PHASES.HIDDEN
    ) {
      exit.phase = EXIT_PHASES.REVEALING;
      exit.revealStartedAt = at;
      return true;
    }
    return false;
  }

  function advance(time) {
    if (!Number.isFinite(time) || time < 0) {
      throw new Error("Exit time must be a non-negative number");
    }
    if (
      exit.phase === EXIT_PHASES.REVEALING &&
      time >= exit.revealStartedAt + exit.revealDuration
    ) exit.phase = EXIT_PHASES.OPEN;
    return exit.phase;
  }

  return {
    onMonsterDeath,
    advance,
    get initialMonsterCount() { return initialMonsterCount; },
    get remainingMonsterCount() { return remaining.size; },
    get revealAtOrBelow() { return revealAtOrBelow; },
    get phase() { return exit.phase; },
    get open() { return isExitOpen(cell); },
  };
}
