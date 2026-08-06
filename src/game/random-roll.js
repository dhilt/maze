const CENTER = 0.5;
const DEVIATION = 0.2;
const MAX_SAMPLE_ATTEMPTS = 1000;

// Produces a normal roll constrained to [0, 1]. Consumers map the normalized
// value into their own ranges and may inject a different roller when needed.
export function createBoundedNormalRoll({ random }) {
  function standardNormal() {
    const radius = Math.sqrt(-2 * Math.log(1 - random()));
    const angle = 2 * Math.PI * random();
    return radius * Math.cos(angle);
  }

  return function boundedNormalRoll() {
    for (let attempt = 0; attempt < MAX_SAMPLE_ATTEMPTS; attempt += 1) {
      const value = CENTER + standardNormal() * DEVIATION;
      if (value >= 0 && value <= 1) return value;
    }
    throw new Error("Could not sample the configured bounded normal distribution");
  };
}
