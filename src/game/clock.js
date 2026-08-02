// The single source of time. Everything that lives or animates reads its pace
// from here instead of touching performance.now directly.
//
// tick(now) returns the shared frame context:
//   dt   — seconds since the previous tick, clamped (frame-rate independent,
//          and guarded against tab-refocus jumps / clock skew)
//   time — total seconds elapsed since the clock started (monotonic)
//
// `time` is what enables action-independent animation (idle bob, flicker,
// ripples) and, later, any number of living objects sharing one timeline.

export function createClock({ maxDelta = 0.1 } = {}) {
  let last = null;
  let time = 0;

  function tick(now) {
    if (last === null) last = now;
    const dt = Math.min(Math.max(now - last, 0) / 1000, maxDelta);
    last = now;
    time += dt;
    return { dt, time };
  }

  // Call when (re)starting the loop so the first frame's dt isn't a huge gap.
  function reset(now = null) {
    last = now;
  }

  return { tick, reset };
}
