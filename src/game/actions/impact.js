const WEAR_RULES = Object.freeze({
  contact: 4,
  blocked: 2,
  penetrating: 0.5,
});

function nonNegative(value, name, { allowInfinity = false } = {}) {
  if (value < 0 || (!Number.isFinite(value) && !(allowInfinity && value === Infinity))) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return value;
}

// Resolves one physical impact without mutating either participant.
export function resolveImpact({
  power,
  defense,
  impactWear,
  wearMultiplier = 1,
}) {
  nonNegative(power, "power");
  nonNegative(defense, "defense", { allowInfinity: true });
  nonNegative(impactWear, "impactWear");
  nonNegative(wearMultiplier, "wearMultiplier");

  const blockedDamage = Math.min(power, defense);
  const damage = Math.max(0, power - defense);
  const statWear = Math.ceil(
    impactWear * wearMultiplier * (
      WEAR_RULES.contact +
      blockedDamage * WEAR_RULES.blocked +
      damage * WEAR_RULES.penetrating
    ),
  );

  return { rawDamage: power, blockedDamage, damage, statWear };
}
