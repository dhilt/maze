import { KNIGHT_ASSET_PACK } from "./packs/knight.js";
import { MEAT_MONSTER_ASSET_PACK } from "./packs/meat-monster.js";

export const ASSET_PACKS = Object.freeze({
  [KNIGHT_ASSET_PACK.id]: KNIGHT_ASSET_PACK,
  [MEAT_MONSTER_ASSET_PACK.id]: MEAT_MONSTER_ASSET_PACK,
});

export function getAssetPack(id) {
  return ASSET_PACKS[id] ?? null;
}
