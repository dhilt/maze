export async function startGameAfterAssets({ assets, create }) {
  if (typeof assets?.preloadAll !== "function") {
    throw new Error("Game startup requires an asset registry");
  }
  if (typeof create !== "function") {
    throw new Error("Game startup requires a game factory");
  }

  await assets.preloadAll();
  const game = create(assets);
  game.start();
  return game;
}
