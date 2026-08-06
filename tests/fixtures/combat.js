import { createCombat } from "../../src/game/combat.js";
import { createStatWear } from "../../src/game/stat-wear.js";

export function createCombatFixture({
  player,
  character,
  monsters,
  getPlayerMove = () => null,
  damageRoll = () => 0.5,
  statWear = createStatWear({ character }),
  ...callbacks
}) {
  return createCombat({
    player,
    character,
    monsters,
    getPlayerMove,
    damageRoll,
    statWear,
    ...callbacks,
  });
}
