// Drives the character through a FIFO queue (max 2) of DESIRED actions. Right
// before an action runs it goes through the adapter, which resolves it against
// the live world into a concrete action — possibly transformed (blocked move →
// instant turn) or cancelled (dropped from the queue).
//
// Queue rules: run in order pressed; cap 2 (overflow dropped); no two consecutive
// equal entries. When idle & empty, a held direction refills it (auto-repeat).
// Zero-duration (instant) actions flush within the same frame; leftover time
// carries into the next action to keep motion smooth.
export function createActionScheduler({ adapter, movement, attack, input }) {
  const queue = []; // desired action ids, in order
  let running = null; // the executor advancing queue[0], or null

  // Registry of executors by resolved-action kind. Adding an action kind means
  // adding an entry here; an unknown kind is a bug, so fail loudly.
  const executors = { step: movement, turn: movement, attack };

  function enqueue(id) {
    if (queue.length >= 2) return;
    const last = queue.length ? queue[queue.length - 1] : null;
    if (id === last) return;
    queue.push(id);
  }

  function executorFor(kind) {
    const executor = executors[kind];
    if (!executor) throw new Error(`No executor for action kind: ${kind}`);
    return executor;
  }

  // Resolve queue[0] and start it. Returns false if the adapter cancelled it
  // (dropped) so the caller can try the next head.
  function startHead() {
    const resolved = adapter.adapt(queue[0]);
    if (resolved === null) {
      queue.shift();
      running = null;
      return false;
    }
    running = executorFor(resolved.kind);
    running.begin(resolved);
    return true;
  }

  function update(dt) {
    for (const id of input.drainPressed()) enqueue(id);

    let budget = dt;
    let heldTried = false; // auto-repeat pulls a held direction at most once/frame
    let guard = 0;
    while (guard++ < 16) {
      if (!running) {
        if (queue.length === 0) {
          if (heldTried) break; // already resolved the held direction this frame
          const held = input.heldDirection();
          if (held === null) break;
          enqueue(held);
          heldTried = true;
        }
        if (!startHead()) continue; // cancelled → try the next head
      }

      const leftover = running.update(budget);
      if (running.active) break; // still running this frame

      queue.shift();
      running = null;
      const consumed = budget - leftover;
      budget = leftover;
      // A real (time-consuming) action ran: allow one more held refill so held
      // movement keeps flowing. An instant action (or a cancel) with an empty
      // queue must stop — otherwise a held direction spins the loop each frame.
      if (consumed > 0) heldTried = false;
      else if (queue.length === 0) break;
    }
  }

  return {
    update,
    get facing() { return movement.facing; },
    get move() { return movement.move; },
    get attackState() { return attack.state; },
    getPixelPosition() { return movement.getPixelPosition(); },
    get activeId() { return running ? queue[0] : null; },
    get buffered() { return queue.length > 1 ? queue[1] : null; },
  };
}
