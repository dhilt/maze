import { createCharacter } from "../entities/character.js";
import { createRenderer } from "../rendering/renderer.js";
import { createStatsPanel } from "../ui/stats-panel.js";
import { placeCorpse } from "../world/corpse.js";
import { placeExit } from "../world/exit.js";
import { generateMaze } from "../world/maze.js";
import { generateWorld } from "../world/world.js";
import { createActionAdapter } from "./actions/adapter.js";
import { createAttack } from "./actions/attack.js";
import { createConsume } from "./actions/consume.js";
import { createCamera } from "./camera.js";
import { createClock } from "./clock.js";
import { createCombat } from "./combat.js";
import { createHealthDrain } from "./health-drain.js";
import { createEnemySystem, spawnMeatMonsters } from "./enemies/enemy-system.js";
import { createKeyboardInput } from "./input.js";
import { createMovement } from "./actions/movement.js";
import { createActionScheduler } from "./actions/scheduler.js";
import { createStatWear } from "./stat-wear.js";
import { createGameTime } from "./time.js";

export function createGame({ canvas, statsRoot, debugControl, config, onFinish }) {
  const ctx = canvas.getContext("2d");
  canvas.width = config.viewCols * config.cellSize;
  canvas.height = config.viewRows * config.cellSize;

  const renderer = createRenderer(ctx, {
    cellSize: config.cellSize,
    viewCols: config.viewCols,
    viewRows: config.viewRows,
    worldCols: config.worldCols,
    worldRows: config.worldRows,
    margin: config.cameraMargin,
    debug: config.debug,
    floorStyle: config.floorStyle,
  });

  const spawn = {
    x: Math.floor(config.worldCols / 2),
    y: Math.floor(config.worldRows / 2),
  };
  const world = generateWorld({
    width: config.worldCols,
    height: config.worldRows,
    seed: config.worldSeed,
  });
  const mazeSeed = config.wallSeed ?? (Math.random() * 0x100000000) >>> 0;
  generateMaze(world, {
    density: config.wallDensity,
    seed: mazeSeed,
    baseHealth: config.baseWallHealth,
    defense: config.baseWallDefense,
    impactWear: config.wallImpactWear,
  });
  placeExit(world, {
    seed: (mazeSeed ^ 0x9e3779b9) >>> 0,
  });

  const character = createCharacter({ name: "Hero" });
  const statWear = createStatWear({ character });
  const statsPanel = createStatsPanel(statsRoot);
  statsPanel.update(character);

  const player = {
    col: spawn.x,
    row: spawn.y,
    facing: "down",
  };
  // True when the hero stands on the exit cell. Used as the scheduler's per-step
  // hook (so a fast frame can't overshoot the exit) and at end of frame.
  const reachedExit = () => Boolean(world.at(player.col, player.row)?.exit);

  const input = createKeyboardInput(window);
  const movement = createMovement({ player, cellSize: config.cellSize });
  const enemySeed = (mazeSeed ^ 0x6d2b79f5) >>> 0;
  const monsters = spawnMeatMonsters({
    world,
    player,
    count: config.enemies.meatMonster.count,
    seed: enemySeed,
  });
  let statsDirty = false;
  const combat = createCombat({
    player,
    character,
    monsters,
    getPlayerMove: () => movement.move,
    onPlayerDamage: () => { statsDirty = true; },
    onMonsterDeath: (monster) => placeCorpse(world, monster),
  });
  const enemies = createEnemySystem({
    world,
    player,
    getPlayerMove: () => movement.move,
    monsters,
    stepCost: config.enemies.meatMonster.stepCost,
    turnCost: config.actionCosts.turn,
    attackCost: config.actionCosts.attack,
    seed: (enemySeed ^ 0x85ebca6b) >>> 0,
    onImpact: combat.queueImpact,
  });
  const attack = createAttack({
    world,
    character,
    statWear,
    onStatChange: () => { statsDirty = true; },
    onImpact: combat.queueImpact,
  });
  const consume = createConsume({
    world,
    character,
    findEntityById: (id) => monsters.find((monster) => monster.id === id) ?? null,
    onStatChange: () => { statsDirty = true; },
  });
  const adapter = createActionAdapter({
    world,
    player,
    character,
    costs: config.actionCosts,
    findEntryBlocker: enemies.findEntryBlocker,
  });
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

  const realClock = createClock({ maxDelta: 0.1 });
  const gameTime = createGameTime(config.gameTime);
  const healthDrain = createHealthDrain({ character });
  let frameId = null;
  let finished = false;

  function frame(now) {
    const tick = gameTime.advance(realClock.tick(now));

    if (healthDrain.advance(tick.dt) > 0) statsDirty = true;
    // Death is terminal at the instant the drain reaches zero. Do not let the
    // same frame spend its action budget and move a dead hero onto the exit.
    let died = character.stats.health <= 0;
    if (!died) {
      scheduler.update(tick.dt);
      enemies.update(tick.dt);
      combat.resolve();
      died = character.stats.health <= 0;
    }
    if (statsDirty) {
      statsPanel.update(character);
      statsDirty = false;
    }
    statsPanel.setRemainder("health", healthDrain.remaining);
    statsPanel.setRemainder("attack", statWear.remaining("attack"));
    camera.update();
    renderer.render({
      player,
      move: scheduler.move,
      attack: scheduler.attackState,
      facing: scheduler.facing,
      cam: camera.state,
      world,
      monsters,
      tick,
      debug: debugControl?.checked ?? config.debug,
      floorStyle: config.floorStyle,
    });

    // Draw the final state first, then finish. Death takes priority over an exit
    // when both conditions are present in the same frame.
    if (died) {
      finish("died");
      return;
    }
    if (reachedExit()) {
      finish("escaped");
      return;
    }
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (finished || frameId !== null) return;
    realClock.reset(performance.now());
    frameId = requestAnimationFrame(frame);
  }

  function stop() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    input.destroy();
  }

  // Terminal transition: tear the loop down cleanly (loop cancelled, frameId
  // cleared, input released) so the lifecycle is consistent, then notify.
  function finish(outcome) {
    if (finished) return;
    finished = true;
    stop();
    onFinish?.(outcome);
  }

  function getState() {
    return {
      player,
      move: scheduler.move,
      attack: scheduler.attackState,
      facing: scheduler.facing,
      cam: camera.state,
      world,
      monsters,
      character,
      gameTime: gameTime.time,
    };
  }

  return { start, stop, getState };
}
