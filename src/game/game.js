import { createCharacter } from "../entities/character.js";
import { createRenderer } from "../rendering/renderer.js";
import { createStatsPanel } from "../ui/stats-panel.js";
import { createClock } from "./clock.js";
import { createLevelSession } from "./create-level-session.js";
import { createHealthDrain } from "./health-drain.js";
import { createKeyboardInput } from "./input.js";
import { createLevelBus } from "./levels.js";
import { createStatWear } from "./stat-wear.js";
import { createGameTime } from "./time.js";

export function createGame({
  canvas,
  statsRoot,
  debugControl,
  config,
  assets,
  character = createCharacter({ name: "Hero" }),
  levelBus = createLevelBus(),
  onFinish,
}) {
  if (typeof assets?.get !== "function") {
    throw new Error("Game requires preloaded assets");
  }
  const ctx = canvas.getContext("2d");
  canvas.width = config.viewCols * config.cellSize;
  canvas.height = config.viewRows * config.cellSize;

  const renderer = createRenderer(ctx, {
    cellSize: config.cellSize,
    viewCols: config.viewCols,
    viewRows: config.viewRows,
    margin: config.cameraMargin,
    debug: config.debug,
    floorStyle: config.floorStyle,
    assets,
  });
  const statWear = createStatWear({ character });
  const statsPanel = createStatsPanel(statsRoot);
  const input = createKeyboardInput(window);
  const monsterHistory = [];
  const runMazeSeed = config.wallSeed ?? (Math.random() * 0x100000000) >>> 0;
  let statsDirty = false;

  function buildLevelSession() {
    return createLevelSession({
      level: levelBus.current,
      config,
      mazeSeed: runMazeSeed,
      character,
      statWear,
      input,
      onStatsDirty: () => { statsDirty = true; },
    });
  }

  let session = buildLevelSession();
  statsPanel.setLevel(levelBus.state);
  statsPanel.update(character);
  statsPanel.setDebug(debugControl?.checked ?? config.debug);

  const realClock = createClock({ maxDelta: 0.1 });
  const gameTime = createGameTime(config.gameTime);
  const healthDrain = createHealthDrain({ character });
  let frameId = null;
  let finished = false;

  function advanceLevel() {
    monsterHistory.push(...session.monsters);
    if (!levelBus.advance()) return false;
    session = buildLevelSession();
    statsPanel.setLevel(levelBus.state);
    statsPanel.setRemainder("health", healthDrain.remaining);
    statsPanel.setRemainder("attack", statWear.remaining("attack"));
    return true;
  }

  function frame(now) {
    const tick = gameTime.advance(realClock.tick(now));
    const debug = debugControl?.checked ?? config.debug;
    statsPanel.setDebug(debug);

    if (healthDrain.advance(tick.dt) > 0) statsDirty = true;
    let died = character.stats.health <= 0;
    if (!died) {
      session.update(tick);
      died = character.stats.health <= 0;
    }
    if (statsDirty) {
      statsPanel.update(character);
      statsDirty = false;
    }
    statsPanel.setRemainder("health", healthDrain.remaining);
    statsPanel.setRemainder("attack", statWear.remaining("attack"));
    session.updateCamera();
    renderer.render({
      player: session.player,
      move: session.move,
      attack: session.attack,
      facing: session.facing,
      cam: session.cam,
      world: session.world,
      monsters: session.monsters,
      tick,
      debug,
      floorStyle: config.floorStyle,
    });

    // Render the landed portal frame before replacing its world. Death keeps
    // priority over both a level transition and final escape.
    if (died) {
      finish("died");
      return;
    }
    if (session.reachedExit()) {
      if (levelBus.isLast) {
        levelBus.complete();
        statsPanel.setLevel(levelBus.state);
        finish("escaped");
        return;
      }
      advanceLevel();
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

  function finish(outcome) {
    if (finished) return;
    finished = true;
    stop();
    onFinish?.(outcome);
  }

  function getState() {
    return {
      level: levelBus.state,
      player: session.player,
      move: session.move,
      attack: session.attack,
      facing: session.facing,
      cam: session.cam,
      world: session.world,
      monsters: session.monsters,
      monsterHistory,
      allMonsters: [...monsterHistory, ...session.monsters],
      character,
      gameTime: gameTime.time,
    };
  }

  return { start, stop, getState };
}
