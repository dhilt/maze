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

// Finite protection can always be worn down by a real hit; Infinity is the
// explicit contract for targets that cannot be damaged at all.
export function resolveDamage({ power, defense }) {
  nonNegative(power, "power");
  nonNegative(defense, "defense", { allowInfinity: true });

  if (power === 0 || defense === Infinity) return 0;
  return Math.min(power, Math.max(1, power - defense));
}

// Resolves one physical impact without mutating either participant.
export function resolveImpact({
  power,
  defense,
  impactWear,
  wearMultiplier = 1,
}) {
  nonNegative(impactWear, "impactWear");
  nonNegative(wearMultiplier, "wearMultiplier");

  const damage = resolveDamage({ power, defense });
  const blockedDamage = Math.min(power, defense);
  const statWear = Math.ceil(
    impactWear * wearMultiplier * (
      WEAR_RULES.contact +
      blockedDamage * WEAR_RULES.blocked +
      damage * WEAR_RULES.penetrating
    ),
  );

  return { rawDamage: power, blockedDamage, damage, statWear };
}
