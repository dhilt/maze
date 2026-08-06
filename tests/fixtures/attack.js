import { createAttack } from "../../src/game/actions/attack.js";
import { createStatWear } from "../../src/game/stat-wear.js";
import { createCharacterFixture } from "./character.js";

export function createAttackFixture({
  world = {},
  character = createCharacterFixture(),
  damageRoll = () => 0.5,
  statWear = createStatWear({ character }),
  onImpact = () => {},
  ...callbacks
} = {}) {
  return createAttack({
    world,
    character,
    damageRoll,
    statWear,
    onImpact,
    ...callbacks,
  });
}
