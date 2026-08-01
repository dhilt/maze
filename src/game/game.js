import { createCharacter } from "../entities/character.js";
import { createRenderer } from "../rendering/renderer.js";
import { createStatsPanel } from "../ui/stats-panel.js";
import { generateMaze } from "../world/maze.js";
import { generateWorld } from "../world/world.js";
import { createAttack } from "./attack.js";
import { createCamera } from "./camera.js";
import { createKeyboardInput } from "./input.js";
import { createMovement } from "./movement.js";

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
    cellTime: config.cellTime,
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
  const input = createKeyboardInput(window, {
    canQueueAttack: () => !attack.active,
  });
  const movement = createMovement({
    world,
    player,
    input,
    cellSize: config.cellSize,
    cellTime: config.cellTime,
  });
  const attack = createAttack({
    input,
    duration: config.attackTime,
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

  let frameId = null;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (attack.active) {
      attack.update(dt);
    } else {
      attack.tryStart(movement.isIdle);
      if (!attack.active) {
        movement.update(dt, { stopAtBoundary: input.hasAttackRequest() });
        attack.tryStart(movement.isIdle);
      }
    }
    camera.update();
    renderer.render({
      player,
      move: movement.move,
      attack: attack.state,
      facing: movement.facing,
      cam: camera.state,
      world,
      debug: debugControl?.checked ?? config.debug,
      floorStyle: config.floorStyle,
    });
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (frameId !== null) return;
    last = performance.now();
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
      move: movement.move,
      attack: attack.state,
      facing: movement.facing,
      cam: camera.state,
      world,
      character,
    };
  }

  return { start, stop, getState };
}
