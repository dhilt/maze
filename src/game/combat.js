import { resolveDamage, resolveImpact } from "./actions/impact.js";
import { ACTION } from "./actions/intent.js";

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
  getPlayerMove,
  damageRoll,
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
    const col = combatant.position.col + (move?.kind === ACTION.step ? move.dx : 0);
    const row = combatant.position.row + (move?.kind === ACTION.step ? move.dy : 0);
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

  function resolveGroup(events, impacts, playerDefeats) {
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
            powerEfficiency: attacker.key.attackEfficiency,
            defense: target.stats.defense,
            defenseEfficiency: target.key.defenseEfficiency,
            impactWear: target.key.impactWear ?? 0,
            roll: damageRoll(),
          })
        : {
            damage: resolveDamage({
              power: attacker.stats.attack,
              powerEfficiency: attacker.key.attackEfficiency,
              defense: target.stats.defense,
              defenseEfficiency: target.key.defenseEfficiency,
              roll: damageRoll(),
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
      if (hit.attackWear > 0) {
        const wear = statWear.apply("attack", hit.attackWear);
        if (wear.lost > 0) onPlayerStatChange?.(wear);
      }
      const total = totals.get(hit.target.key) ?? {
        target: hit.target,
        damage: 0,
        playerHitAt: null,
      };
      total.damage += hit.damage;
      if (hit.event.attacker.type === "player" && hit.damage > 0) {
        total.playerHitAt ??= hit.event.at;
      }
      totals.set(hit.target.key, total);
      impacts.push({
        at: hit.event.at,
        attacker: hit.event.attacker,
        target: hit.target.ref,
        damage: hit.damage,
      });
    }

    let playerDamage = 0;
    for (const { target, damage, playerHitAt } of totals.values()) {
      const before = target.stats.health;
      target.stats.health = Math.max(0, before - damage);
      if (target.ref.type === "player") playerDamage += before - target.stats.health;
      else if (before > 0 && target.stats.health === 0 && playerHitAt !== null) {
        playerDefeats.set(target.key, playerHitAt);
      }
    }
    return playerDamage;
  }

  function rewardMorale(monster) {
    const reward = monster.moraleReward;
    if (!Number.isFinite(reward) || reward <= 0) return 0;
    const before = character.stats.morale;
    character.stats.morale = Math.min(character.statsMax.morale, before + reward);
    const gained = character.stats.morale - before;
    if (gained > 0) {
      onPlayerStatChange?.({ stat: "morale", gained, sourceId: monster.id });
    }
    return gained;
  }

  function resolve() {
    const events = queued.sort((left, right) => left.at - right.at);
    queued = [];
    const impacts = [];
    const playerDefeats = new Map();
    let playerDamage = 0;

    for (let start = 0; start < events.length;) {
      let end = start + 1;
      while (
        end < events.length &&
        Math.abs(events[end].at - events[start].at) <= SAME_TIME_EPSILON
      ) end += 1;
      playerDamage += resolveGroup(events.slice(start, end), impacts, playerDefeats);
      start = end;
    }

    // Dead entities remain in the collection for history and corpse references.
    const deathEvents = [];
    for (const [index, monster] of monsters.entries()) {
      if (monster.stats.health > 0 || handledDeaths.has(monster.id)) continue;
      handledDeaths.add(monster.id);
      const defeatedByPlayer = playerDefeats.has(monster);
      deathEvents.push({
        index,
        monster,
        killer: defeatedByPlayer ? "player" : null,
        at: defeatedByPlayer ? playerDefeats.get(monster) : null,
      });
    }
    // Victory order matters to time-based reactions such as the exit reveal.
    deathEvents.sort((left, right) => (
      (left.at ?? -Infinity) - (right.at ?? -Infinity) || left.index - right.index
    ));
    for (const event of deathEvents) {
      if (event.killer === "player") rewardMorale(event.monster);
      onMonsterDeath?.(event);
    }
    const deadMonsterIds = deathEvents.map(({ monster }) => monster.id);
    if (playerDamage > 0) onPlayerDamage?.(playerDamage);

    return { impacts, deadMonsterIds, playerDamage };
  }

  return { queueImpact, resolve };
}
