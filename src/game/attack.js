// Executes one attack at a time. Started by the scheduler; mirrors movement's
// update() contract (returns leftover dt on completion) so actions chain smoothly.
export function createAttack({ duration }) {
  let state = null;

  function start() {
    state = { t: 0, duration };
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
    start,
    update,
    get active() { return state !== null; },
    get state() { return state; },
  };
}
