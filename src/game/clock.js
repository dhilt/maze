// The single source of physical time. Nothing else touches performance.now;
// the game-time layer converts this stream into logical units for simulation.
//
// tick(timestamp) returns the shared frame context:
//   dt   — seconds since the previous tick, clamped (frame-rate independent,
//          and guarded against tab-refocus jumps / clock skew)
//   time — total seconds elapsed since the clock started (monotonic)
//
// The raw timestamp is forwarded for physical input-duration comparisons.
// Physical time stays available for presentation-only effects that must ignore
// game speed; gameplay and ordinary animation use the logical game timeline.

export function createClock({ maxDelta = 0.1 } = {}) {
  let last = null;
  let time = 0;

  function tick(timestamp) {
    if (last === null) last = timestamp;
    const dt = Math.min(Math.max(timestamp - last, 0) / 1000, maxDelta);
    last = timestamp;
    time += dt;
    return { dt, time, timestamp };
  }

  // Call when (re)starting the loop so the first frame's dt isn't a huge gap.
  function reset(now = null) {
    last = now;
  }

  return { tick, reset };
}
