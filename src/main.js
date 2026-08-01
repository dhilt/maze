import { GAME_CONFIG, VERSION } from "./config.js";
import { createGame } from "./game/game.js";

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element;
}

const canvas = requireElement("game");
const debugControl = requireElement("debug");
const statsRoot = requireElement("stats");

requireElement("ver").textContent = VERSION;
debugControl.checked = GAME_CONFIG.debug;

const game = createGame({
  canvas,
  statsRoot,
  debugControl,
  config: GAME_CONFIG,
});

game.start();
