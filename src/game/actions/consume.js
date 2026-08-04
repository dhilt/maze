import { heal } from "../../entities/character.js";
import { CORPSE_KIND } from "../../world/corpse.js";

export function createConsume({
  world,
  character,
  findEntityById,
  onStatChange,
}) {
  let state = null;

  function begin(resolved) {
    if (resolved.kind !== "consume") {
      throw new Error(`Consume cannot execute action kind: ${resolved.kind}`);
    }
    state = { ...resolved, elapsed: 0 };
  }

  function finish(action) {
    // Resolve the corpse link at completion; the action bus stores no entity copies.
    const cell = world.at(action.target.col, action.target.row);
    const corpseIndex = cell?.objects.findIndex((object) => (
      object.kind === CORPSE_KIND &&
      object.id === action.target.corpseId &&
      object.entityId === action.target.entityId
    )) ?? -1;
    if (corpseIndex < 0 || character.stats.morale <= 0) return;

    const corpse = cell.objects[corpseIndex];
    const entity = findEntityById(corpse.entityId);
    if (!entity) return;
    if (!Number.isFinite(entity.nutrition) || entity.nutrition < 0) {
      throw new Error("Consumed entity nutrition must be a non-negative number");
    }
    if (!Number.isFinite(entity.moraleCost) || entity.moraleCost < 0) {
      throw new Error("Consumed entity moraleCost must be a non-negative number");
    }

    const previousHealth = character.stats.health;
    const previousMorale = character.stats.morale;
    heal(character, entity.nutrition);
    character.stats.morale = Math.max(0, previousMorale - entity.moraleCost);
    cell.objects.splice(corpseIndex, 1);
    onStatChange?.({
      healthGained: character.stats.health - previousHealth,
      moraleLost: previousMorale - character.stats.morale,
      entityId: entity.id,
    });
  }

  function update(deltaUnits) {
    if (!state) return 0;
    state.elapsed += deltaUnits;
    if (state.elapsed < state.timeCost) return 0;

    const leftover = state.elapsed - state.timeCost;
    finish(state);
    state = null;
    return leftover;
  }

  return {
    begin,
    update,
    get active() { return state !== null; },
    get state() { return state; },
  };
}
