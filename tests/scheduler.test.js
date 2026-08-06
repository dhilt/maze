import assert from "node:assert/strict";
import test from "node:test";

import { createActionScheduler } from "../src/game/actions/scheduler.js";

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
    queue(...ids) { presses.push(...ids); },
    drainPressed() { const out = presses.slice(); presses.length = 0; return out; },
    heldAction() { return this._held; },
  };
}

const stepOf = (dir) => ({ kind: "step", dx: 0, dy: 0, timeCost: 5, facing: dir });
const turnOf = (dir) => ({ kind: "turn", dx: 0, dy: 0, timeCost: 1, facing: dir });
const attackOf = () => ({ kind: "attack", dx: 0, dy: 0, timeCost: 5, facing: null });
const wallAttackOf = () => ({ kind: "wallAttack", timeCost: 5, facing: null });
const consumeOf = () => ({ kind: "consume", timeCost: 10 });

function resolveByKind(map) {
  return (id) => (id in map ? map[id]() : stepOf(id));
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

  assert.deepEqual(movement.log.map(({ kind }) => kind), ["turn", "step"]);
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

test("FIFO keeps the first next action; overflow is dropped", () => {
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
  scheduler.update(0.5); // queue full → attack dropped
  assert.equal(scheduler.buffered, "up");

  scheduler.update(3.5); // right completes → up runs
  assert.equal(scheduler.activeId, "up");
  assert.equal(attack.log.length, 0);
});

test("an explicit consume replaces a full buffered slot without interrupting the active action", () => {
  const movement = makeExecutor();
  const consume = makeExecutor();
  const input = makeInput();
  const adapter = makeAdapter(resolveByKind({ consume: consumeOf }));
  const scheduler = createActionScheduler({
    adapter,
    movement,
    attack: makeExecutor(),
    consume,
    input,
  });

  input.queue("right");
  scheduler.update(0.5);
  input.queue("up", "consume");
  scheduler.update(0.5);

  assert.equal(scheduler.activeId, "right");
  assert.equal(scheduler.buffered, "consume");
  assert.equal(consume.log.length, 0);

  scheduler.update(4);
  assert.equal(scheduler.activeId, "consume");
  assert.equal(consume.log.length, 1);
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
    { id: "attack", resolve: wallAttackOf, executorName: "attack", kind: "wallAttack" },
    { id: "consume", resolve: consumeOf, executorName: "consume", kind: "consume" },
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
    if (id === "consume") {
      assert.equal(scheduler.consumeState.kind, "consume");
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
