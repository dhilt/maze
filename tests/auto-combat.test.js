import assert from "node:assert/strict";
import test from "node:test";

import { createActionAdapter } from "../src/game/actions/adapter.js";
import { createAttack } from "../src/game/actions/attack.js";
import { createAutomaticActions } from "../src/game/actions/automatic-actions.js";
import { createMovement } from "../src/game/actions/movement.js";
import { createActionScheduler } from "../src/game/actions/scheduler.js";
import { createStatWear } from "../src/game/stat-wear.js";
import { generateWorld } from "../src/world/world.js";
import { createCharacterFixture } from "./fixtures/character.js";
import { createCombatFixture } from "./fixtures/combat.js";
import { createMeatMonsterFixture } from "./fixtures/meat-monster.js";

function passingMonsterHits(heldAttack) {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  const player = { col: 0, row: 1, facing: "right" };
  const character = createCharacterFixture({ actionCosts: { face: 1, attack: 9 } });
  const monster = createMeatMonsterFixture({
    col: 1, row: 0,
    stats: { health: 100, defense: 0 },
    impactWear: 0,
    move: { kind: "step", dx: 0, dy: 1, elapsed: 10, timeCost: 16 },
  });
  const statWear = createStatWear({ character });
  const movement = createMovement({ player, cellSize: 16 });
  const combat = createCombatFixture({
    player, character, monsters: [monster], statWear,
    getPlayerMove: () => movement.move,
  });
  const attack = createAttack({
    world, character, damageRoll: () => 0.5, statWear,
    onImpact: combat.queueImpact,
  });
  const scheduler = createActionScheduler({
    adapter: createActionAdapter({
      world, player, character,
      findEntryBlocker: () => null,
      findEntityById: (id) => id === monster.id ? monster : null,
    }),
    movement, attack,
    input: {
      drainPressed: () => [],
      heldAction: () => heldAttack ? "attack" : null,
      hasHeldControl: () => heldAttack,
    },
    automatic: createAutomaticActions({ world, player, monsters: [monster], character }),
  });

  const hits = [];
  for (let tick = 1; tick <= 22; tick += 1) {
    scheduler.update(1);
    // The enemy advances after the player scheduler, as in the level session.
    if (monster.move) {
      monster.move.elapsed += 1;
      if (monster.move.elapsed === monster.move.timeCost) {
        monster.row += monster.move.dy;
        monster.move = monster.row === 1
          ? { kind: "step", dx: 0, dy: 1, elapsed: 0, timeCost: 16 }
          : null;
      }
    }
    for (const impact of combat.resolve().impacts) {
      if (impact.attacker.type === "player") hits.push(tick);
    }
  }
  return hits;
}

test("automatic combat catches the same two hits as held attack on a passing monster", () => {
  const manualHits = passingMonsterHits(true);
  const automaticHits = passingMonsterHits(false);

  assert.deepEqual(manualHits, [5, 14]);
  assert.deepEqual(automaticHits, manualHits);
  assert.ok(automaticHits[0] < 6, "the first hit lands before the monster enters its reserved cell");
});
