import { defineAssetPack } from "../asset-pack.js";

const DIRECTIONS = Object.freeze(["down", "up", "left", "right"]);

export const MEAT_MONSTER_ASSET_PACK = defineAssetPack({
  id: "meat-monster",
  root: "./assets/enemies/meat-monster",
  revision: "meat-monster-1",
  animations: {
    walk: { directions: DIRECTIONS, frames: 4 },
    attack: { directions: DIRECTIONS, frames: 8 },
  },
  images: {
    corpse: "corpse.png",
  },
});
