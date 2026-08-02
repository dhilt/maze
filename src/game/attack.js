// Executes a concrete attack action produced by the adapter. Mirrors movement's
// begin()/update() contract (update returns leftover dt on completion).
export function createAttack() {
  let state = null;

  function begin(resolved) {
    state = { t: 0, duration: resolved.duration };
  }

  function update(dt) {
    if (!state) return 0;
    state.t += dt;
    if (state.t >= state.duration) {
      const leftover = state.t - state.duration;
      state = null;
      return leftover;
    }
    return 0;
  }

  return {
    begin,
    update,
    get active() { return state !== null; },
    get state() { return state; },
  };
}
