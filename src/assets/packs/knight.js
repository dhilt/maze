import { defineAssetPack } from "../asset-pack.js";

const DIRECTIONS = Object.freeze(["down", "up", "left", "right"]);

export const KNIGHT_ASSET_PACK = defineAssetPack({
  id: "knight",
  root: "./assets/characters/knight",
  revision: "knight-1",
  animations: {
    idle: { directions: DIRECTIONS, frames: 4 },
    walk: { directions: DIRECTIONS, frames: 4 },
    attack: { directions: DIRECTIONS, frames: 9 },
    consume: { directions: ["down"], frames: 8 },
  },
});
