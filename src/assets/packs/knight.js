import { defineAssetPack } from "../asset-pack.js";

const DIRECTIONS = Object.freeze(["down", "up", "left", "right"]);

export const KNIGHT_ASSET_PACK = defineAssetPack({
  id: "knight",
  root: "./assets/characters/knight-pixel64",
  revision: "knight-pixel64-1",
  animations: {
    idle: { directions: DIRECTIONS, frames: 1 },
    walk: { directions: DIRECTIONS, frames: 4 },
    attack: { directions: DIRECTIONS, frames: 10 },
    consume: { directions: ["down"], frames: 8 },
  },
});
