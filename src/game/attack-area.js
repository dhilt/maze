// Combat uses compact shapes in cell units, independent of transparent sprite margins.
const BODY_HALF_SIZE = 0.25;
const ATTACK_REACH = 0.85;
const ATTACK_HALF_WIDTH = 0.25;

export function inAttackArea(attackerCell, targetCell, targetPoint) {
  const dx = targetCell.col - attackerCell.col;
  const dy = targetCell.row - attackerCell.row;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;

  const offsetX = targetPoint.x - attackerCell.col;
  const offsetY = targetPoint.y - attackerCell.row;
  const forward = offsetX * dx + offsetY * dy;
  const sideways = offsetX * dy - offsetY * dx;
  return forward >= 0 &&
    forward <= ATTACK_REACH + BODY_HALF_SIZE &&
    Math.abs(sideways) <= ATTACK_HALF_WIDTH + BODY_HALF_SIZE;
}
