// Converts the physical clock stream (seconds) into the game's own timeline.
// Action executors know only logical units; real seconds remain available on the
// returned frame context for presentation-only effects that explicitly need them.
export function createGameTime({ secondsPerUnit, speed = 1 }) {
  if (!Number.isFinite(secondsPerUnit) || secondsPerUnit <= 0) {
    throw new RangeError("secondsPerUnit must be a positive finite number");
  }
  if (!Number.isFinite(speed) || speed < 0) {
    throw new RangeError("speed must be a non-negative finite number");
  }

  let time = 0;

  function advance(realTick) {
    if (!realTick || !Number.isFinite(realTick.dt) || realTick.dt < 0) {
      throw new TypeError("realTick.dt must be a non-negative finite number");
    }

    const dt = (realTick.dt * speed) / secondsPerUnit;
    time += dt;
    return {
      dt,
      time,
      realDt: realTick.dt,
      realTime: realTick.time,
      realTimestamp: realTick.timestamp,
    };
  }

  return {
    advance,
    get time() { return time; },
    get secondsPerUnit() { return secondsPerUnit; },
    get speed() { return speed; },
  };
}
