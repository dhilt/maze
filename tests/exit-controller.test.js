import assert from "node:assert/strict";
import test from "node:test";

import { createExitController } from "../src/game/exit-controller.js";
import { EXIT_PHASES, placeExit } from "../src/world/exit.js";
import { generateWorld } from "../src/world/world.js";

function setup({ monsterCount = 5, revealDuration = 5 } = {}) {
  const world = generateWorld({ width: 1, height: 1, seed: 1 });
  const cell = placeExit(world, { seed: 1 });
  const monsters = Array.from({ length: monsterCount }, (_, index) => ({
    id: `m${index + 1}`,
  }));
  const controller = createExitController({
    cell,
    monsterIds: monsters.map(({ id }) => id),
    revealDuration,
  });
  return { cell, monsters, controller };
}

test("player victories start revealing only when the initial population reaches half", () => {
  const { cell, monsters, controller } = setup();

  assert.equal(controller.initialMonsterCount, 5);
  assert.equal(controller.revealAtOrBelow, 2);
  assert.equal(controller.phase, EXIT_PHASES.HIDDEN);

  controller.onMonsterDeath({ monster: monsters[0], killer: "player", at: 1 });
  controller.onMonsterDeath({ monster: monsters[1], killer: "player", at: 2 });
  assert.equal(controller.phase, EXIT_PHASES.HIDDEN);

  assert.equal(controller.onMonsterDeath({
    monster: monsters[2],
    killer: "player",
    at: 3,
  }), true);
  assert.equal(controller.remainingMonsterCount, 2);
  assert.equal(cell.exit.phase, EXIT_PHASES.REVEALING);
  assert.equal(cell.exit.revealStartedAt, 3);
});

test("time alone cannot start a hidden portal", () => {
  const { cell, controller } = setup({ monsterCount: 1 });

  controller.advance(1000);

  assert.equal(cell.exit.phase, EXIT_PHASES.HIDDEN);
});

test("only a unique player victory advances the portal objective", () => {
  const { monsters, controller } = setup({ monsterCount: 1 });

  assert.equal(controller.onMonsterDeath({
    monster: monsters[0],
    killer: "environment",
    at: 1,
  }), false);
  assert.equal(controller.remainingMonsterCount, 1);

  assert.equal(controller.onMonsterDeath({
    monster: { id: "not-initial" },
    killer: "player",
    at: 2,
  }), false);
  assert.equal(controller.remainingMonsterCount, 1);

  assert.equal(controller.onMonsterDeath({
    monster: monsters[0],
    killer: "player",
    at: 3,
  }), true);
  assert.equal(controller.onMonsterDeath({
    monster: monsters[0],
    killer: "player",
    at: 4,
  }), false);
  assert.equal(controller.remainingMonsterCount, 0);
});

test("a revealing portal opens only after its full duration", () => {
  const { cell, monsters, controller } = setup({ monsterCount: 1, revealDuration: 5 });
  controller.onMonsterDeath({ monster: monsters[0], killer: "player", at: 7 });

  assert.equal(controller.advance(11.999), EXIT_PHASES.REVEALING);
  assert.equal(controller.open, false);
  assert.equal(controller.advance(12), EXIT_PHASES.OPEN);
  assert.equal(controller.open, true);
  assert.equal(cell.exit.phase, EXIT_PHASES.OPEN);
});
