import assert from "node:assert/strict";
import test from "node:test";

import { createActionScheduler } from "../src/game/scheduler.js";

// Controllable fakes so we can drive the buffer logic deterministically.
function makeMovement() {
  const m = {
    active: false,
    facing: null,
    move: null,
    started: [],
    start(dir) { m.active = true; m.facing = dir; m.started.push(dir); },
    update() { return 0; }, // stays active until complete() is called
    complete() { m.active = false; },
  };
  return m;
}

function makeAttack() {
  const a = {
    active: false,
    state: null,
    started: 0,
    start() { a.active = true; a.started += 1; a.state = { t: 0 }; },
    update() { return 0; },
    complete() { a.active = false; a.state = null; },
  };
  return a;
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

test("an idle press starts that action", () => {
  const movement = makeMovement();
  const scheduler = createActionScheduler({ movement, attack: makeAttack(), input: (() => {
    const i = makeInput(); i.queue("right"); return i;
  })() });

  scheduler.update(0.1);
  assert.equal(scheduler.activeId, "right");
  assert.deepEqual(movement.started, ["right"]);
});

test("pressing the current action again is ignored (no double)", () => {
  const attack = makeAttack();
  const input = makeInput();
  const scheduler = createActionScheduler({ movement: makeMovement(), attack, input });

  input.queue("attack");
  scheduler.update(0.1); // attack starts
  assert.equal(scheduler.activeId, "attack");

  input.queue("attack"); // same as current → ignored
  scheduler.update(0.1);
  assert.equal(scheduler.buffered, null);
  assert.equal(attack.started, 1);
});

test("a different press buffers and runs after the current action", () => {
  const movement = makeMovement();
  const attack = makeAttack();
  const input = makeInput();
  const scheduler = createActionScheduler({ movement, attack, input });

  input.queue("right");
  scheduler.update(0.1); // stepping right
  input.queue("attack");
  scheduler.update(0.1); // attack buffered while stepping
  assert.equal(scheduler.activeId, "right");
  assert.equal(scheduler.buffered, "attack");

  movement.complete();
  scheduler.update(0.1); // step done → buffered attack starts
  assert.equal(scheduler.activeId, "attack");
  assert.equal(attack.started, 1);
});

test("the queue keeps the first next action; overflow is dropped (FIFO)", () => {
  const movement = makeMovement();
  const attack = makeAttack();
  const input = makeInput();
  const scheduler = createActionScheduler({ movement, attack, input });

  input.queue("right");
  scheduler.update(0.1); // stepping right
  input.queue("up");
  scheduler.update(0.1); // buffer up (first next)
  input.queue("attack");
  scheduler.update(0.1); // queue full → attack dropped
  assert.equal(scheduler.buffered, "up");

  movement.complete();
  scheduler.update(0.1);
  assert.equal(scheduler.activeId, "up"); // the first buffered action runs
  assert.equal(attack.started, 0); // the overflow attack never ran
  assert.deepEqual(movement.started, ["right", "up"]);
});

test("a fast down-left-attack runs down, left and drops the extra", () => {
  const movement = makeMovement();
  const attack = makeAttack();
  const input = makeInput();
  const scheduler = createActionScheduler({ movement, attack, input });

  input.queue("down");
  scheduler.update(0.1); // stepping down
  input.queue("left");
  scheduler.update(0.1); // left buffered
  input.queue("attack");
  scheduler.update(0.1); // dropped (queue full)

  movement.complete();
  scheduler.update(0.1); // down done → left runs
  assert.equal(scheduler.activeId, "left");
  assert.equal(attack.started, 0);
  assert.deepEqual(movement.started, ["down", "left"]);
});

test("a held direction auto-repeats when the buffer is empty", () => {
  const movement = makeMovement();
  const input = makeInput();
  input._held = "right";
  const scheduler = createActionScheduler({ movement, attack: makeAttack(), input });

  scheduler.update(0.1); // no press, held right → step
  assert.deepEqual(movement.started, ["right"]);

  movement.complete();
  scheduler.update(0.1); // still held, buffer empty → step again
  assert.deepEqual(movement.started, ["right", "right"]);
});
