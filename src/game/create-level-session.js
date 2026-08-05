import { placeCorpse } from "../world/corpse.js";
import { isExitOpen, placeExit } from "../world/exit.js";
import { generateMaze } from "../world/maze.js";
import { generateWorld } from "../world/world.js";
import { createActionAdapter } from "./actions/adapter.js";
import { createAttack } from "./actions/attack.js";
import { createConsume } from "./actions/consume.js";
import { createMovement } from "./actions/movement.js";
import { createActionScheduler } from "./actions/scheduler.js";
import { createCamera } from "./camera.js";
import { createCombat } from "./combat.js";
import { createEnemySystem, spawnMeatMonsters } from "./enemies/enemy-system.js";
import { createExitController } from "./exit-controller.js";

function levelSeed(seed, levelNumber, salt) {
  return (seed ^ Math.imul(levelNumber, salt)) >>> 0;
}

// Builds everything that captures a specific world. The run-level character,
// clocks, input and wear accumulator are deliberately injected and preserved.
export function createLevelSession({
  level,
  config,
  mazeSeed,
  character,
  statWear,
  input,
  onStatsDirty,
  onActionRejected,
}) {
  const worldSeed = levelSeed(config.worldSeed, level.number, 0x9e3779b9);
  const concreteMazeSeed = levelSeed(mazeSeed, level.number, 0x85ebca6b);
  const world = generateWorld({
    width: level.width,
    height: level.height,
    seed: worldSeed,
  });
  generateMaze(world, {
    density: config.wallDensity,
    seed: concreteMazeSeed,
    baseHealth: config.baseWallHealth,
    defense: config.baseWallDefense,
    impactWear: config.wallImpactWear,
  });
  const player = {
    col: Math.floor(level.width / 2),
    row: Math.floor(level.height / 2),
    facing: "down",
  };
  // A hidden exit does not reserve its cell: the hero may start on it.
  const exitCell = placeExit(world, {
    seed: (concreteMazeSeed ^ 0x9e3779b9) >>> 0,
  });

  const movement = createMovement({ player, cellSize: config.cellSize });
  const enemySeed = (concreteMazeSeed ^ 0x6d2b79f5) >>> 0;
  const monsters = spawnMeatMonsters({
    world,
    player,
    count: level.monsterCount,
    seed: enemySeed,
    idPrefix: `level-${level.number}:meat-monster`,
  });
  const exitController = createExitController({
    cell: exitCell,
    monsterIds: monsters.map(({ id }) => id),
  });
  let frameStartedAt = 0;
  const combat = createCombat({
    player,
    character,
    monsters,
    getPlayerMove: () => movement.move,
    statWear,
    onPlayerDamage: onStatsDirty,
    onPlayerStatChange: onStatsDirty,
    onMonsterDeath: (event) => {
      placeCorpse(world, event.monster);
      exitController.onMonsterDeath({
        ...event,
        at: event.at === null ? null : frameStartedAt + event.at,
      });
    },
  });
  const enemies = createEnemySystem({
    world,
    player,
    getPlayerMove: () => movement.move,
    monsters,
    seed: (enemySeed ^ 0x85ebca6b) >>> 0,
    onImpact: combat.queueImpact,
  });
  const attack = createAttack({
    world,
    character,
    statWear,
    onStatChange: onStatsDirty,
    onImpact: combat.queueImpact,
  });
  const findEntityById = (id) => (
    monsters.find((monster) => monster.id === id) ?? null
  );
  const consume = createConsume({
    world,
    character,
    findEntityById,
    onStatChange: onStatsDirty,
  });
  const adapter = createActionAdapter({
    world,
    player,
    character,
    findEntryBlocker: enemies.findEntryBlocker,
    findEntityById,
    onActionRejected,
  });
  const reachedExit = () => isExitOpen(world.at(player.col, player.row));
  const scheduler = createActionScheduler({
    adapter,
    movement,
    attack,
    consume,
    input,
    onStep: reachedExit,
  });
  const camera = createCamera({
    player,
    movement,
    world,
    cellSize: config.cellSize,
    viewCols: config.viewCols,
    viewRows: config.viewRows,
    margin: config.cameraMargin,
  });

  return {
    level,
    world,
    exitCell,
    player,
    monsters,
    reachedExit,
    update({ dt, time }) {
      frameStartedAt = time - dt;
      scheduler.update(dt);
      enemies.update(dt);
      combat.resolve();
      exitController.advance(time);
    },
    updateCamera() { camera.update(); },
    get move() { return scheduler.move; },
    get attack() { return scheduler.attackState; },
    get consume() { return scheduler.consumeState; },
    get facing() { return scheduler.facing; },
    get cam() { return camera.state; },
  };
}
