export function createAttack({ input, duration }) {
  let state = null;

  function tryStart(isIdle) {
    if (state || !isIdle || !input.consumeAttack()) return false;
    state = { t: 0, duration };
    return true;
  }

  function update(dt) {
    if (!state) return;
    state.t += dt;
    if (state.t >= state.duration) state = null;
  }

  return {
    tryStart,
    update,
    get active() { return state !== null; },
    get state() { return state; },
  };
}
