import { GAME_CONFIG, VERSION } from "./config.js";
import { createGame } from "./game/game.js";
import { createCompletion } from "./ui/completion.js";

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

const completion = createCompletion({
  element: requireElement("completion"),
  canvas,
  onRestart: () => location.reload(),
});

const game = createGame({
  canvas,
  statsRoot,
  debugControl,
  config: GAME_CONFIG,
  onFinish: (outcome) => completion.show(outcome),
});

game.start();
