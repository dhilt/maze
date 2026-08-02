const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function axisBounds(worldCells, viewCells, cellSize) {
  const overflow = (worldCells - viewCells) * cellSize;
  if (overflow >= 0) return { min: 0, max: overflow };

  // A world smaller than the viewport has one fixed, centred camera position.
  const centered = overflow / 2;
  return { min: centered, max: centered };
}

export function createCamera({
  player,
  movement,
  world,
  cellSize,
  viewCols,
  viewRows,
  margin,
}) {
  const xBounds = axisBounds(world.width, viewCols, cellSize);
  const yBounds = axisBounds(world.height, viewRows, cellSize);
  const state = {
    px: clamp(
      (player.col - Math.floor(viewCols / 2)) * cellSize,
      xBounds.min,
      xBounds.max,
    ),
    py: clamp(
      (player.row - Math.floor(viewRows / 2)) * cellSize,
      yBounds.min,
      yBounds.max,
    ),
  };

  function update() {
    const position = movement.getPixelPosition();
    const left = state.px + margin * cellSize;
    const right = state.px + (viewCols - 1 - margin) * cellSize;
    if (position.x < left) state.px = position.x - margin * cellSize;
    else if (position.x > right) state.px = position.x - (viewCols - 1 - margin) * cellSize;

    const top = state.py + margin * cellSize;
    const bottom = state.py + (viewRows - 1 - margin) * cellSize;
    if (position.y < top) state.py = position.y - margin * cellSize;
    else if (position.y > bottom) state.py = position.y - (viewRows - 1 - margin) * cellSize;

    state.px = clamp(state.px, xBounds.min, xBounds.max);
    state.py = clamp(state.py, yBounds.min, yBounds.max);
  }

  return { state, update };
}
