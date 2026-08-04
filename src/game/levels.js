export const LEVELS = Object.freeze([
  Object.freeze({ number: 1, width: 5, height: 5, monsterCount: 1 }),
  Object.freeze({ number: 2, width: 10, height: 10, monsterCount: 3 }),
  Object.freeze({ number: 3, width: 20, height: 20, monsterCount: 7 }),
  Object.freeze({ number: 4, width: 30, height: 30, monsterCount: 10 }),
  Object.freeze({ number: 5, width: 50, height: 50, monsterCount: 15 }),
]);

export function createLevelBus() {
  let index = 0;

  function snapshot() {
    return Object.freeze({
      number: index + 1,
      total: LEVELS.length,
      progress: (index + 1) / LEVELS.length,
      isLast: index === LEVELS.length - 1,
      definition: LEVELS[index],
    });
  }

  function advance() {
    if (index >= LEVELS.length - 1) return false;
    index += 1;
    return true;
  }

  return {
    advance,
    get current() { return LEVELS[index]; },
    get number() { return index + 1; },
    get total() { return LEVELS.length; },
    get progress() { return (index + 1) / LEVELS.length; },
    get isLast() { return index === LEVELS.length - 1; },
    get state() { return snapshot(); },
  };
}
