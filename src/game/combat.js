import { resolveDamage, resolveImpact } from "./actions/impact.js";

const SAME_TIME_EPSILON = 1e-9;

function isAlive(combatant) {
  return combatant !== null && combatant.stats.health > 0;
}

// Collects contacts from every action system, then resolves equal-time hits
// from one unchanged snapshot. Update order therefore cannot decide a duel.
export function createCombat({
  player,
  character,
  monsters,
  getPlayerMove = () => null,
  statWear,
  onPlayerDamage,
  onPlayerStatChange,
  onMonsterDeath,
}) {
  let queued = [];
  const handledDeaths = new Set();

  function findCombatant(ref) {
    if (ref?.type === "player") {
      return {
        key: character,
        ref,
        position: player,
        move: getPlayerMove(),
        stats: character.stats,
      };
    }
    if (ref?.type === "entity") {
      const monster = monsters.find(({ id }) => id === ref.id) ?? null;
      return monster === null
        ? null
        : {
            key: monster,
            ref,
            position: monster,
            move: monster.move,
            stats: monster.stats,
          };
    }
    return null;
  }

  function occupiesCell(combatant, cell) {
    const move = combatant.move;
    const col = combatant.position.col + (move?.kind === "step" ? move.dx : 0);
    const row = combatant.position.row + (move?.kind === "step" ? move.dy : 0);
    return col === cell.col && row === cell.row;
  }

  function findTarget(event, attacker) {
    if (attacker.ref.type === "player") {
      for (const monster of monsters) {
        const candidate = findCombatant({ type: "entity", id: monster.id });
        if (isAlive(candidate) && occupiesCell(candidate, event.targetCell)) return candidate;
      }
      return null;
    }
    return findCombatant({ type: "player" });
  }

  function queueImpact({ at = 0, attacker, targetCell, strike }) {
    if (!Number.isFinite(at) || at < 0) {
      throw new Error("Combat impact time must be a non-negative number");
    }
    if (!attacker) {
      throw new Error("Combat impact requires an attacker");
    }
    if (!Number.isInteger(targetCell?.col) || !Number.isInteger(targetCell?.row)) {
      throw new Error("Combat impact requires an integer target cell");
    }
    queued.push({ at, attacker, targetCell, strike });
  }

  function resolveGroup(events, impacts) {
    const pending = [];

    for (const event of events) {
      if (event.strike?.hitResolved) continue;
      const attacker = findCombatant(event.attacker);
      if (!isAlive(attacker)) continue;
      const target = findTarget(event, attacker);
      if (!isAlive(target)) continue;
      if (!occupiesCell(target, event.targetCell)) continue;

      const impact = attacker.ref.type === "player"
        ? resolveImpact({
            power: attacker.stats.attack,
            defense: target.stats.defense,
            impactWear: target.key.impactWear ?? 0,
          })
        : {
            damage: resolveDamage({
              power: attacker.stats.attack,
              defense: target.stats.defense,
            }),
            statWear: 0,
          };
      pending.push({
        event,
        target,
        damage: impact.damage,
        attackWear: impact.statWear,
      });
    }

    const totals = new Map();
    for (const hit of pending) {
      if (hit.event.strike) hit.event.strike.hitResolved = true;
      if (hit.attackWear > 0 && statWear) {
        const wear = statWear.apply("attack", hit.attackWear);
        if (wear.lost > 0) onPlayerStatChange?.(wear);
      }
      const total = totals.get(hit.target.key) ?? { target: hit.target, damage: 0 };
      total.damage += hit.damage;
      totals.set(hit.target.key, total);
      impacts.push({
        at: hit.event.at,
        attacker: hit.event.attacker,
        target: hit.target.ref,
        damage: hit.damage,
      });
    }

    let playerDamage = 0;
    for (const { target, damage } of totals.values()) {
      const before = target.stats.health;
      target.stats.health = Math.max(0, before - damage);
      if (target.ref.type === "player") playerDamage += before - target.stats.health;
    }
    return playerDamage;
  }

  function resolve() {
    const events = queued.sort((left, right) => left.at - right.at);
    queued = [];
    const impacts = [];
    let playerDamage = 0;

    for (let start = 0; start < events.length;) {
      let end = start + 1;
      while (
        end < events.length &&
        Math.abs(events[end].at - events[start].at) <= SAME_TIME_EPSILON
      ) end += 1;
      playerDamage += resolveGroup(events.slice(start, end), impacts);
      start = end;
    }

    // Dead entities remain in the collection for history and corpse references.
    const deadMonsterIds = [];
    for (const monster of monsters) {
      if (monster.stats.health > 0 || handledDeaths.has(monster.id)) continue;
      handledDeaths.add(monster.id);
      onMonsterDeath?.(monster);
      deadMonsterIds.push(monster.id);
    }
    if (playerDamage > 0) onPlayerDamage?.(playerDamage);

    return { impacts, deadMonsterIds, playerDamage };
  }

  return { queueImpact, resolve };
}
