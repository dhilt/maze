import { createMeatMonster } from "../../entities/meat-monster.js";
import { ACTION, DIR_IDS, actorBlocksEntry, resolveIntent } from "../actions/intent.js";
import { advanceAction, attackContactElapsed } from "../actions/runner.js";
import { createRandom } from "../../world/random.js";

const DIRECTION_CHANGE_CHANCE = 0.2;

export function spawnMeatMonsters({
  world,
  player,
  count,
  seed,
  idPrefix = "meat-monster",
}) {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Meat monster count must be a non-negative integer");
  }
  const random = createRandom(seed >>> 0);
  const statsRandom = createRandom((seed ^ 0x51ed270b) >>> 0);
  const available = world.cells.filter((cell) => (
    cell.x !== player.col || cell.y !== player.row
  ));
  const spawnCount = Math.min(count, available.length);
  const monsters = [];

  function createAt(cell) {
    const facing = DIR_IDS[Math.floor(random() * DIR_IDS.length)];
    return createMeatMonster({
      id: `${idPrefix}-${monsters.length + 1}`,
      col: cell.x,
      row: cell.y,
      facing,
      random: statsRandom,
    });
  }

  // Keep one early encounter visible while the rest remain distributed globally.
  const nearby = available.filter((cell) => {
    const dx = Math.abs(cell.x - player.col);
    const dy = Math.abs(cell.y - player.row);
    return Math.max(dx, dy) <= 3 && dx + dy >= 2;
  });
  if (spawnCount > 0 && nearby.length > 0) {
    const cell = nearby[Math.floor(random() * nearby.length)];
    available.splice(available.indexOf(cell), 1);
    monsters.push(createAt(cell));
  }

  // Partial Fisher-Yates gives unique deterministic spawn cells without retries.
  const remaining = spawnCount - monsters.length;
  for (let index = 0; index < remaining; index += 1) {
    const selected = index + Math.floor(random() * (available.length - index));
    [available[index], available[selected]] = [available[selected], available[index]];
    monsters.push(createAt(available[index]));
  }
  return monsters;
}

export function createEnemySystem({
  world,
  player,
  getPlayerMove,
  monsters,
  seed,
  directionChangeChance = DIRECTION_CHANGE_CHANCE,
  onImpact,
}) {
  if (
    !Number.isFinite(directionChangeChance) ||
    directionChangeChance < 0 ||
    directionChangeChance > 1
  ) {
    throw new Error("Enemy directionChangeChance must be a number in [0, 1]");
  }
  const random = createRandom(seed >>> 0);

  function isAlive(monster) {
    return monster.stats.health > 0;
  }

  function findBlockingMonster(fromCol, fromRow, toCol, toRow, ignored = null) {
    return monsters.find((monster) => (
      monster !== ignored &&
      isAlive(monster) &&
      actorBlocksEntry(monster, fromCol, fromRow, toCol, toRow)
    )) ?? null;
  }

  function playerBlocksEntry(fromCol, fromRow, toCol, toRow) {
    return actorBlocksEntry(
      { ...player, move: getPlayerMove() },
      fromCol,
      fromRow,
      toCol,
      toRow,
    );
  }

  function adaptIntent(monster, desired) {
    return resolveIntent({
      actor: monster,
      desired,
      world,
      towardBlocked: false,
      cell(toCol, toRow) {
        if (playerBlocksEntry(monster.col, monster.row, toCol, toRow)) return "hostile";
        if (findBlockingMonster(monster.col, monster.row, toCol, toRow, monster)) {
          return "blocked";
        }
        return null;
      },
    });
  }

  function beginAction(monster) {
    const frontAction = adaptIntent(monster, monster.facing);
    if (frontAction?.kind === ACTION.attack) {
      monster.attack = { ...frontAction, elapsed: 0, hitResolved: false };
      return true;
    }

    const available = DIR_IDS
      .map((id) => ({ id, action: adaptIntent(monster, id) }))
      .filter(({ action }) => action !== null);
    if (available.length === 0) return false;

    const current = available.find(({ id }) => id === monster.facing);
    let choices = available;
    if (current?.action.kind === ACTION.step) {
      const alternatives = available.filter(({ id }) => id !== monster.facing);
      const changesDirection = (
        alternatives.length > 0 &&
        random() < directionChangeChance
      );
      choices = changesDirection ? alternatives : [current];
    }
    const resolved = choices[Math.floor(random() * choices.length)].action;
    monster.facing = resolved.facing;
    monster.move = { ...resolved, elapsed: 0 };
    return true;
  }

  function updateMonster(monster, deltaUnits) {
    if (!isAlive(monster)) return;
    let budget = deltaUnits;
    let origin = 0;
    let guard = 0;
    while (budget > 0 && guard++ < 16) {
      if (!monster.move && !monster.attack && !beginAction(monster)) return;
      const action = monster.attack ?? monster.move;
      const { previousElapsed, leftover, done } = advanceAction(action, budget);
      if (monster.attack) {
        const evaluationElapsed = attackContactElapsed(action, previousElapsed);
        if (evaluationElapsed !== null) {
          onImpact({
            at: origin + evaluationElapsed - previousElapsed,
            attacker: { type: "entity", id: monster.id },
            targetCell: action.targetCell,
            strike: action,
          });
        }
      }
      if (!done) return;
      origin += budget - leftover;
      budget = leftover;
      if (monster.attack) {
        monster.attack = null;
        continue;
      }
      monster.col += monster.move.dx;
      monster.row += monster.move.dy;
      monster.move = null;
    }
  }

  function update(deltaUnits) {
    if (!Number.isFinite(deltaUnits) || deltaUnits < 0) {
      throw new Error("Enemy delta must be a non-negative number");
    }
    for (const monster of monsters) updateMonster(monster, deltaUnits);
  }

  return {
    monsters,
    update,
    findEntryBlocker(fromCol, fromRow, toCol, toRow) {
      return findBlockingMonster(fromCol, fromRow, toCol, toRow);
    },
  };
}
