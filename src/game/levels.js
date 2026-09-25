export const LEVELS = Object.freeze([
  Object.freeze({ number: 1, width: 5, height: 5, monsterCount: 1 }),
  Object.freeze({ number: 2, width: 10, height: 10, monsterCount: 3 }),
  Object.freeze({ number: 3, width: 20, height: 20, monsterCount: 7 }),
  Object.freeze({ number: 4, width: 30, height: 30, monsterCount: 10 }),
  Object.freeze({ number: 5, width: 50, height: 50, monsterCount: 15 }),
]);

export function createLevelBus() {
  let index = 0;
  let completed = false;

  function progress() {
    // The bar measures cleared levels, not the number of the active level.
    return completed ? 1 : index / LEVELS.length;
  }

  function snapshot() {
    return Object.freeze({
      number: index + 1,
      total: LEVELS.length,
      progress: progress(),
      isLast: index === LEVELS.length - 1,
      isComplete: completed,
      definition: LEVELS[index],
    });
  }

  function advance() {
    if (completed || index >= LEVELS.length - 1) return false;
    index += 1;
    return true;
  }

  function complete() {
    if (completed || index !== LEVELS.length - 1) return false;
    completed = true;
    return true;
  }

  return {
    advance,
    complete,
    get current() { return LEVELS[index]; },
    get number() { return index + 1; },
    get total() { return LEVELS.length; },
    get progress() { return progress(); },
    get isLast() { return index === LEVELS.length - 1; },
    get isComplete() { return completed; },
    get state() { return snapshot(); },
  };
}
