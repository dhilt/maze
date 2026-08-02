import { createCharacter } from "../entities/character.js";
import { createRenderer } from "../rendering/renderer.js";
import { createStatsPanel } from "../ui/stats-panel.js";
import { generateMaze } from "../world/maze.js";
import { generateWorld } from "../world/world.js";
import { createActionAdapter } from "./actions.js";
import { createAttack } from "./attack.js";
import { createCamera } from "./camera.js";
import { createClock } from "./clock.js";
import { createKeyboardInput } from "./input.js";
import { createMovement } from "./movement.js";
import { createActionScheduler } from "./scheduler.js";

export function createGame({ canvas, statsRoot, debugControl, config }) {
  const ctx = canvas.getContext("2d");
  canvas.width = config.viewCols * config.cellSize;
  canvas.height = config.viewRows * config.cellSize;

  const renderer = createRenderer(ctx, {
    cellSize: config.cellSize,
    viewCols: config.viewCols,
    viewRows: config.viewRows,
    worldCols: config.worldCols,
    worldRows: config.worldRows,
    phases: config.phases,
    cellTime: config.actionTime,
    margin: config.cameraMargin,
    debug: config.debug,
    floorStyle: config.floorStyle,
  });

  const world = generateWorld({
    width: config.worldCols,
    height: config.worldRows,
    seed: config.worldSeed,
  });
  generateMaze(world, {
    density: config.wallDensity,
    seed: config.wallSeed ?? (Math.random() * 0x100000000) >>> 0,
  });

  const character = createCharacter({ name: "Sir Roland" });
  const statsPanel = createStatsPanel(statsRoot);
  statsPanel.update(character);

  const player = {
    col: Math.floor(config.worldCols / 2),
    row: Math.floor(config.worldRows / 2),
  };
  const input = createKeyboardInput(window);
  const movement = createMovement({ player, cellSize: config.cellSize });
  const attack = createAttack();
  const adapter = createActionAdapter({
    world,
    player,
    durations: config.actionDurations,
  });
  const scheduler = createActionScheduler({ adapter, movement, attack, input });
  const camera = createCamera({
    player,
    movement,
    world,
    cellSize: config.cellSize,
    viewCols: config.viewCols,
    viewRows: config.viewRows,
    margin: config.cameraMargin,
  });

  const clock = createClock({ maxDelta: 0.1 });
  let frameId = null;

  function frame(now) {
    const tick = clock.tick(now); // { dt, time } — the shared time stream

    scheduler.update(tick.dt);
    camera.update();
    renderer.render({
      player,
      move: scheduler.move,
      attack: scheduler.attackState,
      facing: scheduler.facing,
      cam: camera.state,
      world,
      tick,
      debug: debugControl?.checked ?? config.debug,
      floorStyle: config.floorStyle,
    });
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (frameId !== null) return;
    clock.reset(performance.now());
    frameId = requestAnimationFrame(frame);
  }

  function stop() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    input.destroy();
  }

  function getState() {
    return {
      player,
      move: scheduler.move,
      attack: scheduler.attackState,
      facing: scheduler.facing,
      cam: camera.state,
      world,
      character,
    };
  }

  return { start, stop, getState };
}
