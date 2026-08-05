export function createActionCosts(defaults, overrides = {}) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    throw new Error("Action cost overrides must be an object");
  }
  const actionCosts = { ...defaults, ...overrides };
  for (const [action, cost] of Object.entries(actionCosts)) {
    if (!Number.isInteger(cost) || cost <= 0) {
      throw new Error(`${action} action cost must be a positive integer`);
    }
  }
  return actionCosts;
}
