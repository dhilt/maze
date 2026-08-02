import assert from "node:assert/strict";
import test from "node:test";

import { createActionScheduler } from "../src/game/scheduler.js";

// A timer-based fake executor (matches the real begin/update contract), so
// zero-duration resolved actions flush instantly here too.
function makeExecutor() {
  let a = null;
  const log = [];
  return {
    log,
    begin(resolved) { a = { ...resolved, t: 0 }; log.push(resolved); },
    update(dt) {
      if (!a) return 0;
      a.t += dt;
      if (a.t >= a.duration) { const l = a.t - a.duration; a = null; return l; }
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

const stepOf = (dir) => ({ kind: "step", dx: 0, dy: 0, duration: 0.5, facing: dir });
const turnOf = (dir) => ({ kind: "turn", dx: 0, dy: 0, duration: 0, facing: dir });
const attackOf = () => ({ kind: "attack", dx: 0, dy: 0, duration: 0.5, facing: null });

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
  scheduler.update(0.5); // down completes, left starts
  assert.equal(scheduler.activeId, "left");
  assert.deepEqual(movement.log.map((a) => a.facing), ["down", "left"]);
});

test("an instant (transformed) action flushes and the next runs the same frame", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  const adapter = makeAdapter(resolveByKind({ left: turnOf, attack: attackOf }));
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  input.queue("left", "attack"); // left → instant turn, then attack
  scheduler.update(0.1);
  assert.equal(scheduler.activeId, "attack"); // turn flushed, attack now running
  assert.equal(movement.log.length, 1); // the turn
  assert.equal(attack.log.length, 1); // the attack
});

test("the adapter can cancel a declared action (dropped from the queue)", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  const adapter = makeAdapter((id) => (id === "up" ? null : stepOf(id)));
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  input.queue("up", "right"); // up cancelled, right runs
  scheduler.update(0.1);
  assert.equal(scheduler.activeId, "right");
  assert.deepEqual(movement.log.map((a) => a.facing), ["right"]);
});

test("FIFO keeps the first next action; overflow is dropped", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  const adapter = makeAdapter(resolveByKind({ attack: attackOf }));
  const scheduler = createActionScheduler({ adapter, movement, attack, input });

  input.queue("right");
  scheduler.update(0.1); // right running
  input.queue("up");
  scheduler.update(0.1); // up buffered
  input.queue("attack");
  scheduler.update(0.1); // queue full → attack dropped
  assert.equal(scheduler.buffered, "up");

  scheduler.update(0.4); // right completes → up runs
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

  scheduler.update(0.1);
  assert.equal(calls, 1); // was 16 (guard limit) before the fix
  assert.equal(scheduler.activeId, null);
});

test("an unknown resolved kind throws instead of silently moving", () => {
  const movement = makeExecutor();
  const attack = makeExecutor();
  const input = makeInput();
  input.queue("weird");
  const adapter = { adapt: () => ({ kind: "teleport", duration: 0.5 }) };
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

  scheduler.update(0.5); // held right → step, completes, refills → step again
  assert.ok(movement.log.length >= 2);
  assert.equal(movement.log[0].facing, "right");
});
