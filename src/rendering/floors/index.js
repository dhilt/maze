import { createStoneFloor } from "./stone.js";
import { createCryptFloor } from "./crypt.js";

const FLOOR_FACTORIES = Object.freeze({
  stone: createStoneFloor,
  crypt: createCryptFloor,
});

export const FLOOR_STYLES = Object.freeze(Object.keys(FLOOR_FACTORIES));

export function createFloor(style, options) {
  const factory = FLOOR_FACTORIES[style] || FLOOR_FACTORIES.stone;
  return factory(options);
}

export function isFloorStyle(style) {
  return Object.hasOwn(FLOOR_FACTORIES, style);
}
