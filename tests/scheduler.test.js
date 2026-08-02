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
    get state() { return a && a.kind === "attack" ? a : null; },
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
    heldDirection() { return this._held; },
  };
}

const stepOf = (dir) => ({ kind: "step", dx: 0, dy: 0, timeCost: 5, facing: dir });
const turnOf = (dir) => ({ kind: "turn", dx: 0, dy: 0, timeCost: 1, facing: dir });
const attackOf = () => ({ kind: "attack", dx: 0, dy: 0, timeCost: 5, facing: null });

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
