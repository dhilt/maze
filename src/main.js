import { createAssetRegistry } from "./assets/asset-registry.js";
import { ASSET_PACKS } from "./assets/catalog.js";
import { GAME_CONFIG, VERSION } from "./config.js";
import { createGame } from "./game/game.js";
import { startGameAfterAssets } from "./game/startup.js";
import { createCompletion } from "./ui/completion.js";

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element;
}

const canvas = requireElement("game");
const debugControl = requireElement("debug");
const statsRoot = requireElement("stats");
const loading = requireElement("loading");

requireElement("ver").textContent = VERSION;
debugControl.checked = GAME_CONFIG.debug;

const completion = createCompletion({
  element: requireElement("completion"),
  canvas,
  onRestart: () => location.reload(),
});

try {
  const assets = createAssetRegistry({ packs: ASSET_PACKS });
  await startGameAfterAssets({
    assets,
    create: (readyAssets) => createGame({
      canvas,
      statsRoot,
      debugControl,
      config: GAME_CONFIG,
      assets: readyAssets,
      onFinish: (outcome) => completion.show(outcome),
    }),
  });
  loading.hidden = true;
} catch (error) {
  loading.textContent = "Unable to load game assets";
  loading.classList.add("is-error");
  console.error(error);
}
