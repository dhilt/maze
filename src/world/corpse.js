export const CORPSE_KIND = "corpse";

function occupiedCell(entity) {
  const moving = entity.move?.kind === "step";
  return {
    col: entity.col + (moving ? entity.move.dx : 0),
    row: entity.row + (moving ? entity.move.dy : 0),
  };
}

// Corpses are ordinary background objects: serialisable and non-blocking.
// A combat death supplies the hit cell; other deaths retain occupied-cell placement.
export function placeCorpse(world, entity, targetCell = null) {
  const { col, row } = targetCell ?? occupiedCell(entity);
  const cell = world.at(col, row);
  if (cell === null) return null;

  const corpse = {
    id: `corpse-${entity.id}`,
    kind: CORPSE_KIND,
    layer: "background",
    entityId: entity.id,
  };
  cell.objects.push(corpse);
  return corpse;
}
