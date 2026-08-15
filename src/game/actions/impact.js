const WEAR_RULES = Object.freeze({
  contact: 4,
  blocked: 2,
  penetrating: 0.5,
});
const MINIMUM_DAMAGE = 0.05;

function nonNegative(value, name, { allowInfinity = false } = {}) {
  if (value < 0 || (!Number.isFinite(value) && !(allowInfinity && value === Infinity))) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return value;
}

function efficiency(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a number in [0, 1]`);
  }
  return value;
}

function normalizedRoll(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Damage roll must be a number in [0, 1]");
  }
  return value;
}

// Efficiencies define the reliable fraction of each nominal stat. The attack
// floor and defense ceiling form the left edge; their opposites form the right.
export function resolveDamageRange({
  power,
  powerEfficiency,
  defense,
  defenseEfficiency,
}) {
  nonNegative(power, "power");
  nonNegative(defense, "defense", { allowInfinity: true });
  efficiency(powerEfficiency, "powerEfficiency");
  efficiency(defenseEfficiency, "defenseEfficiency");

  if (power === 0 || defense === Infinity) return { min: 0, max: 0 };
  return {
    min: power * powerEfficiency - defense,
    max: power - defense * defenseEfficiency,
  };
}

function resolveDamageOutcome(options) {
  const { min, max } = resolveDamageRange(options);
  const roll = normalizedRoll(options.roll);
  const rawDamage = min + roll * (max - min);
  return { rawDamage, damage: Math.max(MINIMUM_DAMAGE, rawDamage) };
}

export function resolveDamage(options) {
  return resolveDamageOutcome(options).damage;
}

// Resolves one physical impact without mutating either participant.
export function resolveImpact({
  power,
  powerEfficiency,
  defense,
  defenseEfficiency,
  impactWear,
  roll,
  wearMultiplier = 1,
}) {
  nonNegative(impactWear, "impactWear");
  nonNegative(wearMultiplier, "wearMultiplier");

  const { rawDamage, damage } = resolveDamageOutcome({
    power,
    powerEfficiency,
    defense,
    defenseEfficiency,
    roll,
  });
  const blockedDamage = Math.min(power, defense);
  const statWear = Math.ceil(
    impactWear * wearMultiplier * (
      WEAR_RULES.contact +
      blockedDamage * WEAR_RULES.blocked +
      damage * WEAR_RULES.penetrating
    ),
  );

  return { rawDamage, blockedDamage, damage, statWear };
}
