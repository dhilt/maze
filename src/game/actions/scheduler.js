import { ACTION } from "./intent.js";

// Drives the character through a two-slot queue of desired intents. Right
// before an action runs it goes through the adapter, which resolves it against
// the live world into a concrete action — possibly transformed (blocked move →
// face) or cancelled (dropped from the queue).
//
// The active action is never interrupted. Each new manual press replaces the
// not-yet-started action; if several presses arrive together, the first starts
// and the last is buffered. Equal directions can still mean face + step.
// Held input and automatic combat refill only an empty queue.
// An automatic intent is considered only when no player control is pending.
// Zero-cost actions flush within the same frame; leftover game-time units carry
// into the next action to keep motion smooth.
export function createActionScheduler({
  adapter,
  movement,
  attack,
  consume,
  input,
  automatic,
  onStep,
}) {
  const queue = []; // active intent and at most one pending intent
  let running = null; // the executor advancing queue[0], or null

  // Registry of executors by resolved-action kind. Adding an action kind means
  // adding an entry here; an unknown kind is a bug, so fail loudly.
  const executors = {
    [ACTION.step]: movement,
    [ACTION.face]: movement,
    [ACTION.attack]: attack,
    [ACTION.eat]: consume,
  };

  function queueManual(pressed) {
    if (pressed.length === 0) return;
    if (running) {
      queue[1] = pressed[pressed.length - 1];
      return;
    }
    // An old head may still be waiting after onStep stopped the previous frame.
    queue.length = 0;
    queue.push(pressed[0]);
    if (pressed.length > 1) queue.push(pressed[pressed.length - 1]);
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

  function update(deltaUnits, realTimestamp) {
    const pressed = input.drainPressed();
    if (pressed.length > 0) automatic?.onManualIntent?.();
    queueManual(pressed);

    let budget = deltaUnits;
    let elapsed = 0;
    let heldTried = false; // auto-repeat pulls a held action at most once/frame
    let autoTried = false; // a cancelled automatic intent cannot spin this frame
    let guard = 0;
    while (guard++ < 16) {
      if (!running) {
        if (queue.length === 0) {
          if (!heldTried) {
            const held = input.heldAction(realTimestamp);
            heldTried = true;
            if (held !== null) queue.push(held);
          }
          if (queue.length === 0) {
            if (!automatic || autoTried || input.hasHeldControl()) break;
            const intent = automatic.nextIntent();
            if (intent === null || intent === undefined) break;
            queue.push(intent);
            autoTried = true;
          }
        }
        if (!startHead()) continue; // cancelled → try the next head
      }

      const leftover = running.update(budget, elapsed);
      if (running.active) break; // still running this frame

      queue.shift();
      running = null;
      // Check for a terminal condition (e.g. the exit reached) the instant the
      // action lands — before leftover time can carry into the next action and
      // step the player past it.
      if (onStep && onStep()) break;
      const consumed = budget - leftover;
      elapsed += consumed;
      budget = leftover;
      // A real (time-consuming) action ran: allow one more held refill so held
      // movement and attacks keep flowing. A zero-cost action with an empty
      // queue must stop — otherwise a held action spins the loop each frame.
      if (consumed > 0) {
        heldTried = false;
        autoTried = false;
      } else if (queue.length === 0) break;
    }
  }

  return {
    update,
    get facing() { return movement.facing; },
    get move() { return movement.move; },
    get attackState() { return attack.state; },
    get consumeState() { return consume?.state ?? null; },
    getPixelPosition() { return movement.getPixelPosition(); },
    get activeId() { return running ? queue[0] : null; },
    get buffered() { return queue.length > 1 ? queue[1] : null; },
  };
}
