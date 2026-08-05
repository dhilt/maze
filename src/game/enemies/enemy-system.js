import {
  createMeatMonster,
  MEAT_MONSTER_DIRECTION_CHANGE_CHANCE,
} from "../../entities/meat-monster.js";
import { hasWall } from "../../world/maze.js";
import { createRandom } from "../../world/random.js";
import {
  ATTACK_ACTIVE_END_PROGRESS,
  ATTACK_CONTACT_PROGRESS,
} from "../actions/attack-timing.js";

const DIRECTIONS = Object.freeze([
  Object.freeze({ id: "up", dx: 0, dy: -1 }),
  Object.freeze({ id: "down", dx: 0, dy: 1 }),
  Object.freeze({ id: "left", dx: -1, dy: 0 }),
  Object.freeze({ id: "right", dx: 1, dy: 0 }),
]);

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
    const facing = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)].id;
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
  getPlayerMove = () => null,
  monsters,
  seed,
  directionChangeChance = MEAT_MONSTER_DIRECTION_CHANGE_CHANCE,
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

  function actorBlocksEntry(actor, fromCol, fromRow, toCol, toRow) {
    if (!actor.move) return actor.col === toCol && actor.row === toRow;
    const targetCol = actor.col + actor.move.dx;
    const targetRow = actor.row + actor.move.dy;
    if (targetCol === toCol && targetRow === toRow) return true;
    // A vacated source is enterable, except for a head-on position swap.
    return (
      actor.col === toCol &&
      actor.row === toRow &&
      targetCol === fromCol &&
      targetRow === fromRow
    );
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

  function adaptIntent(monster, direction) {
    const col = monster.col + direction.dx;
    const row = monster.row + direction.dy;
    if (
      world.at(col, row) === null ||
      hasWall(world, monster.col, monster.row, direction.dx, direction.dy)
    ) return null;
    if (playerBlocksEntry(monster.col, monster.row, col, row)) {
      if (monster.facing !== direction.id) {
        return {
          kind: "turn",
          dx: 0,
          dy: 0,
          elapsed: 0,
          timeCost: monster.actionCosts.turn,
          facing: direction.id,
        };
      }
      return {
        kind: "attack",
        elapsed: 0,
        timeCost: monster.actionCosts.attack,
        hitResolved: false,
        targetCell: { col, row },
      };
    }
    if (findBlockingMonster(monster.col, monster.row, col, row, monster)) return null;
    return {
      kind: "step",
      dx: direction.dx,
      dy: direction.dy,
      elapsed: 0,
      timeCost: monster.actionCosts.step,
      facing: direction.id,
    };
  }

  function beginAction(monster) {
    const front = DIRECTIONS.find((direction) => direction.id === monster.facing);
    const frontAction = adaptIntent(monster, front);
    if (frontAction?.kind === "attack") {
      monster.attack = frontAction;
      return true;
    }

    const available = DIRECTIONS
      .map((direction) => ({ direction, action: adaptIntent(monster, direction) }))
      .filter(({ action }) => action !== null);
    if (available.length === 0) return false;

    const current = available.find(({ direction }) => direction.id === monster.facing);
    let choices = available;
    if (current?.action.kind === "step") {
      const alternatives = available.filter(({ direction }) => (
        direction.id !== monster.facing
      ));
      const changesDirection = (
        alternatives.length > 0 &&
        random() < directionChangeChance
      );
      choices = changesDirection ? alternatives : [current];
    }
    const resolved = choices[Math.floor(random() * choices.length)].action;
    if (resolved.kind === "attack") {
      monster.attack = resolved;
      return true;
    }
    monster.facing = resolved.facing;
    monster.move = resolved;
    return true;
  }

  function updateMonster(monster, deltaUnits) {
    if (!isAlive(monster)) return;
    let budget = deltaUnits;
    let elapsed = 0;
    let guard = 0;
    while (budget > 0 && guard++ < 16) {
      if (!monster.move && !monster.attack && !beginAction(monster)) return;
      const action = monster.attack ?? monster.move;
      const remaining = action.timeCost - action.elapsed;
      const consumed = Math.min(budget, remaining);
      action.elapsed += consumed;
      budget -= consumed;
      const actionStart = elapsed;
      elapsed += consumed;

      if (monster.attack && !action.hitResolved) {
        const contactElapsed = action.timeCost * ATTACK_CONTACT_PROGRESS;
        const activeEnd = action.timeCost * ATTACK_ACTIVE_END_PROGRESS;
        const previousElapsed = action.elapsed - consumed;
        if (action.elapsed >= contactElapsed && previousElapsed < activeEnd) {
          const evaluationElapsed = Math.max(previousElapsed, contactElapsed);
          onImpact?.({
            at: actionStart + evaluationElapsed - previousElapsed,
            attacker: { type: "entity", id: monster.id },
            targetCell: action.targetCell,
            strike: action,
          });
        }
      }
      if (action.elapsed < action.timeCost) return;

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
