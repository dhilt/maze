const ATTACK = "attack";

// Drives the character through a FIFO action queue of at most 2 entries:
//   queue[0] — the action currently executing (locked for its actionTime)
//   queue[1] — one buffered "next" action, which must differ from queue[0]
//
// Rules:
//   * Actions run in the order pressed.
//   * The queue is capped at 2; presses that overflow it are dropped (so a fast
//     "down, left, attack" runs "down, left" and drops the extra attack).
//   * No two consecutive-equal entries (no double-step / double-attack).
//   * When the queue drains, a held direction refills it (auto-repeat). Leftover
//     time carries into the next action so motion stays smooth.
export function createActionScheduler({ movement, attack, input }) {
  const queue = []; // action ids, in order; queue[0] is (or will be) executing
  let running = false; // whether queue[0] has been started on its executor

  function enqueue(id) {
    if (queue.length >= 2) return; // cap at 2
    const last = queue.length ? queue[queue.length - 1] : null;
    if (id === last) return; // no consecutive duplicate (2nd must differ from 1st)
    queue.push(id);
  }

  function executor() {
    return queue[0] === ATTACK ? attack : movement;
  }

  // Advance the head; on completion pop it and return leftover dt, else 0.
  function step(dt) {
    const exec = executor();
    const leftover = exec.update(dt);
    if (!exec.active) {
      queue.shift();
      running = false;
      return leftover;
    }
    return 0;
  }

  function startHead(carryDt) {
    const id = queue[0];
    if (id === ATTACK) attack.start();
    else movement.start(id);
    running = true;
    if (carryDt > 0) step(carryDt);
  }

  function update(dt) {
    for (const id of input.drainPressed()) enqueue(id);

    let carry = 0;
    if (running) carry = step(dt);

    if (queue.length === 0) {
      const held = input.heldDirection();
      if (held !== null) enqueue(held);
    }

    if (queue.length > 0 && !running) startHead(carry);
  }

  return {
    update,
    get facing() { return movement.facing; },
    get move() { return movement.move; },
    get attackState() { return attack.state; },
    get activeId() { return queue.length ? queue[0] : null; },
    get buffered() { return queue.length > 1 ? queue[1] : null; },
  };
}
