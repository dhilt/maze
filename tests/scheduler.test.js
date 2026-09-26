import assert from "node:assert/strict";
import test from "node:test";

import { createActionScheduler } from "../src/game/actions/scheduler.js";
import { createActionAdapter } from "../src/game/actions/adapter.js";
import { createAutomaticActions } from "../src/game/actions/automatic-actions.js";
import { createMovement } from "../src/game/actions/movement.js";
import { generateWorld } from "../src/world/world.js";

// A timer-based fake executor (matches the real begin/update contract), so
// logical time-cost and leftover-unit behavior are exercised here too.
function makeExecutor() {
  let a = null;
  const log = [];
  return {
    log,
    begin(resolved) { a = { ...resolved, elapsed: 0 }; log.push(resolved); },
    update(deltaUnits) {
      if (!a) return 0;
      a.elapsed += deltaUnits;
      if (a.elapsed >= a.timeCost) { const l = a.elapsed - a.timeCost; a = null; return l; }
      return 0;
    },
    get active() { return a !== null; },
    get move() { return a && a.kind === "step" ? a : null; },
    get state() { return a; },
    facing: "down",
  };
}

// Adapter driven by a resolver map: id → resolved | null (null = cancel).
function makeAdapter(resolve) {
  return { adapt: resolve };
}

function makeInput() {
  const presses = [];
  return {
    _held: null,
    _pendingHeld: false,
    queue(...ids) { presses.push(...ids); },
    drainPressed() { const out = presses.slice(); presses.length = 0; return out; },
    heldAction() { return this._held; },
    hasHeldControl() { return this._held !== null || this._pendingHeld; },
  };
}

const stepOf = (dir) => ({ kind: "step", dx: 0, dy: 0, timeCost: 5, facing: dir });
const turnOf = (dir) => ({ kind: "face", dx: 0, dy: 0, timeCost: 1, facing: dir });
const attackOf = () => ({ kind: "attack", dx: 0, dy: 0, timeCost: 5, facing: null });
const wallAttackOf = () => ({ kind: "attack", timeCost: 5, facing: null, target: { x: 0, y: 0, dx: 1, dy: 0 } });
const eatOf = () => ({ kind: "eat", timeCost: 10 });

function resolveByKind(map) {
  return (id) => (id in map ? map[id]() : stepOf(id));
}

function makeFacingAdapter(initialFacing = "down", occupiedDirection = null) {
  let facing = initialFacing;
  return makeAdapter((id) => {
    if (id === "attack") return attackOf();
    if (id !== facing) {
      facing = id;
      return turnOf(id);
    }
    return id === occupiedDirection ? attackOf() : stepOf(id);
  });
}

function makeRetreatChoice(isThreat) {
  return {
    nextIntent({ afterManualFace } = {}) {
      return afterManualFace && isThreat() ? afterManualFace : null;
    },
  };
}

test("declared actions run in the order pressed", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  const adapter = makeAdapter(resolveByKind({}));
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  input.queue("down", "left");
  scheduler.update(5); // down completes, left starts
  assert.equal(scheduler.activeId, "left");
  assert.deepEqual(movement.log.map((a) => a.facing), ["down", "left"]);
});

test("a one-unit turn consumes time then carries leftover into the next action", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  const adapter = makeAdapter(resolveByKind({ left: turnOf, attack: attackOf }));
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  input.queue("left", "attack");
  scheduler.update(0.5);
  assert.equal(scheduler.activeId, "left");
  assert.equal(attack.log.length, 0);

  scheduler.update(0.75); // turn finishes; 0.25 enters the attack
  assert.equal(scheduler.activeId, "attack");
  assert.equal(movement.log.length, 1);
  assert.equal(attack.log.length, 1);
});

test("two equal direction presses buffer a turn followed by a step", () => {
  const movement = makeExecutor();
  const input = makeInput();
  let resolutions = 0;
  const scheduler = createActionScheduler({
    adapter: makeAdapter((id) => {
      resolutions += 1;
      return resolutions === 1 ? turnOf(id) : stepOf(id);
    }),
    movement,
    attack: makeExecutor(),
    input,
  });

  input.queue("right", "right");
  scheduler.update(1);

  assert.deepEqual(movement.log.map(({ kind }) => kind), ["face", "step"]);
  assert.equal(scheduler.activeId, "right");
});

test("the adapter can cancel a declared action (dropped from the queue)", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  const adapter = makeAdapter((id) => (id === "up" ? null : stepOf(id)));
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  input.queue("up", "right"); // up cancelled, right runs
  scheduler.update(1);
  assert.equal(scheduler.activeId, "right");
  assert.deepEqual(movement.log.map((a) => a.facing), ["right"]);
  assert.equal(scheduler.move.elapsed, 1); // cancellation consumed no budget
});

test("the latest manual press replaces the pending action without interrupting the active one", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  const adapter = makeAdapter(resolveByKind({ attack: attackOf }));
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  input.queue("right");
  scheduler.update(0.5); // right running
  input.queue("up");
  scheduler.update(0.5); // up buffered
  input.queue("attack");
  scheduler.update(0.5); // attack replaces up
  assert.equal(scheduler.activeId, "right");
  assert.equal(scheduler.buffered, "attack");

  scheduler.update(3.5); // right completes → attack runs
  assert.equal(scheduler.activeId, "attack");
  assert.equal(attack.log.length, 1);
  assert.deepEqual(movement.log.map((a) => a.facing), ["right"]);
});

test("an explicit consume replaces a full buffered slot without interrupting the active action", () => {
  const movement = makeExecutor();
  const consume = makeExecutor();
  const input = makeInput();
  const adapter = makeAdapter(resolveByKind({ eat: eatOf }));
  const scheduler = createActionScheduler({
    adapter,
    movement,
    attack: makeExecutor(),
    consume,
    input,
  });

  input.queue("right");
  scheduler.update(0.5);
  input.queue("up", "eat");
  scheduler.update(0.5);

  assert.equal(scheduler.activeId, "right");
  assert.equal(scheduler.buffered, "eat");
  assert.equal(consume.log.length, 0);

  scheduler.update(4);
  assert.equal(scheduler.activeId, "eat");
  assert.equal(consume.log.length, 1);
});

test("a direction can replace a pending consume action", () => {
  const movement = makeExecutor();
  const consume = makeExecutor();
  const input = makeInput();
  const scheduler = createActionScheduler({
    adapter: makeAdapter(resolveByKind({ eat: eatOf })),
    movement,
    attack: makeExecutor(),
    consume,
    input,
  });

  input.queue("right");
  scheduler.update(1);
  input.queue("eat");
  scheduler.update(1);
  input.queue("left");
  scheduler.update(1);

  assert.equal(scheduler.activeId, "right");
  assert.equal(scheduler.buffered, "left");
  scheduler.update(2);
  assert.equal(scheduler.activeId, "left");
  assert.equal(consume.log.length, 0);
});

test("the first press starts and the last press waits when several arrive in one frame", () => {
  const movement = makeExecutor();
  const input = makeInput();
  const scheduler = createActionScheduler({
    adapter: makeAdapter(resolveByKind({})),
    movement,
    attack: makeExecutor(),
    input,
  });

  input.queue("right", "up", "left");
  scheduler.update(1);

  assert.equal(scheduler.activeId, "right");
  assert.equal(scheduler.buffered, "left");
});

test("a combat tap waits for an active attack and retreats if threatened after its face", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  let adjacent = false;
  let autoCalls = 0;
  const scheduler = createActionScheduler({
    adapter: makeFacingAdapter(),
    movement,
    attack,
    input,
    automatic: {
      nextIntent({ afterManualFace } = {}) {
        if (afterManualFace) return adjacent ? afterManualFace : null;
        return autoCalls++ === 0 ? "attack" : null;
      },
      onManualIntent() {},
    },
  });

  scheduler.update(1); // automatic attack starts
  input.queue("right");
  scheduler.update(1); // the attack continues; the tap is pending
  assert.equal(scheduler.activeId, "attack");
  assert.equal(scheduler.buffered, "right");

  adjacent = true;
  scheduler.update(3); // attack finishes; face starts with no leftover time
  assert.deepEqual(movement.log.map(({ kind }) => kind), ["face"]);
  scheduler.update(1); // face finishes; the live threat starts a step immediately
  assert.deepEqual(movement.log.map(({ kind }) => kind), ["face", "step"]);
  assert.equal(scheduler.move.elapsed, 0);
  assert.equal(attack.log.length, 1);
});

test("a threat that leaves during a manual face does not trigger a stale retreat", () => {
  const movement = makeExecutor();
  const input = makeInput();
  let adjacent = true;
  const scheduler = createActionScheduler({
    adapter: makeFacingAdapter(),
    movement,
    attack: makeExecutor(),
    input,
    automatic: makeRetreatChoice(() => adjacent),
  });

  input.queue("right");
  scheduler.update(0.25);
  adjacent = false;
  scheduler.update(0.75);

  assert.deepEqual(movement.log.map(({ kind }) => kind), ["face"]);
  assert.equal(scheduler.activeId, null);
});

test("a second short direction is re-evaluated after the first retreat lands", () => {
  for (const newThreat of [false, true]) {
    const world = generateWorld({ width: 4, height: 4, seed: 1 });
    const player = { col: 1, row: 1, facing: "right" };
    const monster = { id: "m1", col: 2, row: 1, facing: "left", stats: { health: 10 } };
    const input = makeInput();
    const scheduler = createActionScheduler({
      adapter: createActionAdapter({
        world,
        player,
        character: { actionCosts: { face: 1, step: 5, attack: 5 } },
        findEntryBlocker: () => null,
        findEntityById: (id) => id === monster.id ? monster : null,
      }),
      movement: createMovement({ player, cellSize: 16 }),
      attack: makeExecutor(),
      input,
      automatic: createAutomaticActions({ world, player, monsters: [monster] }),
    });

    input.queue("down");
    scheduler.update(1); // manual face ends; first retreat step begins
    assert.equal(scheduler.move?.kind, "step");
    input.queue("left");
    scheduler.update(1); // second short press waits for the active step
    scheduler.update(4); // first step lands; second manual face begins
    assert.deepEqual({ col: player.col, row: player.row }, { col: 1, row: 2 });

    if (newThreat) {
      monster.row = 2; // a fresh face-to-face encounter in the new cell
    }
    scheduler.update(1); // second face ends; choose from the live positions
    assert.equal(player.facing, "left");
    assert.equal(scheduler.move?.kind ?? null, newThreat ? "step" : null);
  }
});

test("an automatic face does not trigger the manual retreat continuation", () => {
  const movement = makeExecutor();
  const choices = [];
  const scheduler = createActionScheduler({
    adapter: makeFacingAdapter(),
    movement,
    attack: makeExecutor(),
    input: makeInput(),
    automatic: {
      nextIntent(context) {
        choices.push(context);
        return choices.length === 1 ? "right" : null;
      },
    },
  });

  scheduler.update(1);
  assert.deepEqual(movement.log.map(({ kind }) => kind), ["face"]);
  assert.deepEqual(choices, [undefined, undefined]);
  assert.equal(scheduler.activeId, null);
});

test("a newer manual press during a combat turn suppresses its continuation", () => {
  const movement = makeExecutor();
  const input = makeInput();
  let adjacent = true;
  const scheduler = createActionScheduler({
    adapter: makeFacingAdapter(),
    movement,
    attack: makeExecutor(),
    input,
    automatic: makeRetreatChoice(() => adjacent),
  });

  input.queue("right");
  scheduler.update(0.25);
  input.queue("left");
  scheduler.update(0.75);
  assert.equal(scheduler.activeId, "left");
  assert.deepEqual(movement.log.map(({ facing }) => facing), ["right", "left"]);

  adjacent = false;
  scheduler.update(1);
  assert.equal(scheduler.activeId, null);
  assert.deepEqual(movement.log.map(({ kind }) => kind), ["face", "face"]);
});

test("a newer manual press replaces a committed direction before its turn starts", () => {
  const movement = makeExecutor();
  const input = makeInput();
  let adjacent = true;
  const scheduler = createActionScheduler({
    adapter: makeFacingAdapter(),
    movement,
    attack: makeExecutor(),
    input,
    automatic: makeRetreatChoice(() => adjacent),
  });

  input.queue("attack");
  scheduler.update(1);
  input.queue("right");
  scheduler.update(1);
  adjacent = false;
  input.queue("left");
  scheduler.update(1);
  scheduler.update(2);

  assert.equal(scheduler.activeId, "left");
  assert.deepEqual(movement.log.map(({ facing }) => facing), ["left"]);
  scheduler.update(1);
  assert.equal(scheduler.activeId, null);
});

test("a combat turn attacks when its re-resolved direction is occupied", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  const scheduler = createActionScheduler({
    adapter: makeFacingAdapter("down", "right"),
    movement,
    attack,
    input,
    automatic: makeRetreatChoice(() => true),
  });

  input.queue("right");
  scheduler.update(1);

  assert.deepEqual(movement.log.map(({ kind }) => kind), ["face"]);
  assert.deepEqual(attack.log.map(({ kind }) => kind), ["attack"]);
  assert.equal(scheduler.activeId, "right");
});

test("a combat tap already facing its direction does not schedule a second action", () => {
  for (const { occupied, kind } of [
    { occupied: null, kind: "step" },
    { occupied: "right", kind: "attack" },
  ]) {
    const movement = makeExecutor();
    const attack = makeExecutor();
    const input = makeInput();
    const scheduler = createActionScheduler({
      adapter: makeFacingAdapter("right", occupied),
      movement,
      attack,
      input,
      automatic: makeRetreatChoice(() => true),
    });

    input.queue("right");
    scheduler.update(5);
    assert.deepEqual([...movement.log, ...attack.log].map((action) => action.kind), [kind]);
    assert.equal(scheduler.activeId, null);
  }
});

test("a combat turn does not continue past a terminal condition or blocked route", () => {
  for (const terminal of [false, true]) {
    const movement = makeExecutor();
    const input = makeInput();
    let adaptations = 0;
    const scheduler = createActionScheduler({
      adapter: makeAdapter(() => (++adaptations === 1 ? turnOf("right") : null)),
      movement,
      attack: makeExecutor(),
      input,
      automatic: makeRetreatChoice(() => true),
      onStep: () => terminal,
    });

    input.queue("right");
    scheduler.update(1);
    assert.equal(scheduler.activeId, null);
    assert.equal(adaptations, terminal ? 1 : 2);
    assert.deepEqual(movement.log.map(({ kind }) => kind), ["face"]);
  }
});

test("holding a combat direction repeats only after its committed step", () => {
  const movement = makeExecutor();
  const input = makeInput();
  input._held = "right";
  const scheduler = createActionScheduler({
    adapter: makeFacingAdapter(),
    movement,
    attack: makeExecutor(),
    input,
    automatic: makeRetreatChoice(() => true),
  });

  input.queue("right");
  scheduler.update(1);
  assert.deepEqual(movement.log.map(({ kind }) => kind), ["face", "step"]);
  scheduler.update(5);
  assert.deepEqual(movement.log.map(({ kind }) => kind), ["face", "step", "step"]);
});

test("one repeated attack can be buffered for a durable target", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  const adapter = makeAdapter(resolveByKind({ attack: attackOf }));
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  input.queue("attack", "attack", "attack");
  scheduler.update(1);

  assert.equal(scheduler.activeId, "attack");
  assert.equal(scheduler.buffered, "attack");
  assert.equal(attack.log.length, 1);

  scheduler.update(4);
  assert.equal(attack.log.length, 2, "the buffered strike starts after the first");
  assert.equal(scheduler.activeId, "attack");
});

test("a cancelled held direction is adapted once per frame, not spun", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  input._held = "up";
  let calls = 0;
  const adapter = { adapt: () => { calls += 1; return null; } }; // always cancel
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  scheduler.update(1);
  assert.equal(calls, 1); // was 16 (guard limit) before the fix
  assert.equal(scheduler.activeId, null);
});

test("automatic intent runs only after manual and held input", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  let automaticCalls = 0;
  const scheduler = createActionScheduler({
    adapter: makeAdapter(resolveByKind({ attack: attackOf })),
    movement,
    attack,
    input,
    automatic: { nextIntent: () => { automaticCalls += 1; return "attack"; } },
  });

  input.queue("right");
  scheduler.update(1);
  assert.equal(automaticCalls, 0);
  input._held = "right";
  scheduler.update(4);
  assert.equal(automaticCalls, 0);
  input._held = null;
  scheduler.update(5);
  assert.equal(attack.log.length, 1);
  assert.equal(automaticCalls, 1);
});

test("a pending direction hold suppresses automatic intent before repeat starts", () => {
  const input = makeInput();
  input._pendingHeld = true;
  let automaticCalls = 0;
  const scheduler = createActionScheduler({
    adapter: makeAdapter(resolveByKind({ attack: attackOf })),
    movement: makeExecutor(),
    attack: makeExecutor(),
    input,
    automatic: { nextIntent: () => { automaticCalls += 1; return "attack"; } },
  });

  scheduler.update(1);
  assert.equal(automaticCalls, 0);
  assert.equal(scheduler.activeId, null);
});

test("a cancelled automatic intent is adapted only once per frame", () => {
  const input = makeInput();
  let calls = 0;
  const scheduler = createActionScheduler({
    adapter: makeAdapter(() => { calls += 1; return null; }),
    movement: makeExecutor(),
    attack: makeExecutor(),
    input,
    automatic: { nextIntent: () => ({ kind: "auto-attack", targetId: "monster" }) },
  });

  scheduler.update(1);
  assert.equal(calls, 1);
  assert.equal(scheduler.activeId, null);
});

test("an automatic side reaction turns, then starts its strike with leftover time", () => {
  const world = generateWorld({ width: 3, height: 3, seed: 1 });
  const player = { col: 1, row: 1, facing: "right" };
  const monster = { id: "side", col: 1, row: 0, stats: { health: 10 } };
  const auto = createAutomaticActions({ world, player, monsters: [monster] });
  const attack = makeExecutor();
  const scheduler = createActionScheduler({
    adapter: createActionAdapter({
      world,
      player,
      character: { actionCosts: { face: 1, attack: 5 } },
      findEntryBlocker: () => null,
      findEntityById: (id) => id === monster.id ? monster : null,
    }),
    movement: createMovement({ player, cellSize: 16 }),
    attack,
    input: makeInput(),
    automatic: auto,
  });
  auto.onAttackStart({ monsterId: monster.id });

  scheduler.update(1.25);

  assert.equal(player.facing, "up");
  assert.equal(attack.log.length, 1);
  assert.equal(attack.state.elapsed, 0.25);
});

test("a manual press buffered during automatic attack runs before another automatic strike", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  let autoCalls = 0;
  const scheduler = createActionScheduler({
    adapter: makeAdapter(resolveByKind({ attack: attackOf })),
    movement,
    attack,
    input,
    automatic: {
      nextIntent: () => { autoCalls += 1; return "attack"; },
      onManualIntent() {},
    },
  });

  scheduler.update(1);
  input.queue("up");
  scheduler.update(4);

  assert.equal(scheduler.activeId, "up");
  assert.equal(movement.log.length, 1);
  assert.equal(attack.log.length, 1);
  assert.equal(autoCalls, 1);
});

test("an unknown resolved kind throws instead of silently moving", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  input.queue("weird");
  const adapter = { adapt: () => ({ kind: "teleport", timeCost: 5 }) };
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  assert.throws(() => scheduler.update(0.1), /No executor for action kind: teleport/);
});

test("resolved action kinds route to their registered executors", () => {
  for (const { id, resolve, executorName, kind } of [
    { id: "attack", resolve: wallAttackOf, executorName: "attack", kind: "attack" },
    { id: "eat", resolve: eatOf, executorName: "consume", kind: "eat" },
  ]) {
    const input = makeInput();
    const executors = {
      movement: makeExecutor(),
      attack: makeExecutor(),
      consume: makeExecutor(),
    };
    input.queue(id);
    const scheduler = createActionScheduler({
      adapter: makeAdapter(resolveByKind({ [id]: resolve })),
      ...executors,
      input,
    });

    scheduler.update(1);

    assert.equal(executors[executorName].log.length, 1);
    assert.equal(executors[executorName].log[0].kind, kind);
    assert.equal(scheduler.activeId, id);
    if (id === "eat") {
      assert.equal(scheduler.consumeState.kind, "eat");
      assert.equal(scheduler.consumeState.elapsed, 1);
    }
  }
});

test("a held direction auto-repeats when the queue is empty", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  input._held = "right";
  const adapter = makeAdapter(resolveByKind({}));
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  scheduler.update(5); // held right → step, completes, refills → step again
  assert.ok(movement.log.length >= 2);
  assert.equal(movement.log[0].facing, "right");
});

test("a held attack auto-repeats and release does not cancel the active strike", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  input._held = "attack";
  const scheduler = createActionScheduler({
    adapter: makeAdapter(resolveByKind({ attack: attackOf })),
    movement,
    attack,
    input,
  });

  scheduler.update(5); // first attack lands; held Space starts the next one
  assert.equal(attack.log.length, 2);
  assert.equal(scheduler.activeId, "attack");

  input._held = null;
  scheduler.update(5); // second attack lands, but no third attack starts
  assert.equal(attack.log.length, 2);
  assert.equal(scheduler.activeId, null);
});

test("onStep halts the loop the instant a step lands (no time-carry overshoot)", () => {
  const runSteps = (onStep) => {
    const movement = makeExecutor();
    const input = makeInput();
    input.queue("right", "up");
    const scheduler = createActionScheduler({
      adapter: makeAdapter(resolveByKind({})),
      movement,
      attack: makeExecutor(),
      input,
      onStep,
    });
    scheduler.update(100); // budget large enough to finish both steps in one call
    return movement.log.length;
  };

  assert.equal(runSteps(null), 2); // no hook → leftover carries, both steps run
  assert.equal(runSteps(() => true), 1); // hook halts right after the first lands
});

test("a manual press replaces an unstarted action left after onStep halts the frame", () => {
  const movement = makeExecutor();
  const input = makeInput();
  const scheduler = createActionScheduler({
    adapter: makeAdapter(resolveByKind({})),
    movement,
    attack: makeExecutor(),
    input,
    onStep: () => true,
  });

  input.queue("right", "up");
  scheduler.update(5);
  assert.equal(scheduler.activeId, null);
  input.queue("left");
  scheduler.update(1);

  assert.equal(scheduler.activeId, "left");
  assert.deepEqual(movement.log.map((a) => a.facing), ["right", "left"]);
});
