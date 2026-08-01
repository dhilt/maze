const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createCamera({
  player,
  movement,
  world,
  cellSize,
  viewCols,
  viewRows,
  margin,
}) {
  const maxX = Math.max(0, (world.width - viewCols) * cellSize);
  const maxY = Math.max(0, (world.height - viewRows) * cellSize);
  const state = {
    px: clamp((player.col - Math.floor(viewCols / 2)) * cellSize, 0, maxX),
    py: clamp((player.row - Math.floor(viewRows / 2)) * cellSize, 0, maxY),
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

    state.px = clamp(state.px, 0, maxX);
    state.py = clamp(state.py, 0, maxY);
  }

  return { state, update };
}
