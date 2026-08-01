// Terrain registry — the catalog of cell types.
// A cell stores only a terrain id (string); this maps that id → appearance and
// behaviour. Separating "which terrain" (data on the cell) from "how it looks /
// behaves" (this table) keeps cells tiny and the world JSON-serialisable.
//
// Extend by adding an entry here; nothing else needs to change. `walkable` is
// ready for collisions later (knight can't enter water/mountains).

export const TERRAIN = {
  stone:    { name: "Stone floor", color: "#34373d", walkable: true },
  grass:    { name: "Grass",       color: "#3f7d43", walkable: true },
  sand:     { name: "Sand",        color: "#d9c48a", walkable: true },
  forest:   { name: "Forest",      color: "#2e5d34", walkable: true },
  water:    { name: "Water",       color: "#2f6fb0", walkable: false },
  mountain: { name: "Mountain",    color: "#7b7b83", walkable: false },
};

// Fallback for cells whose terrain id is missing/unknown.
export const DEFAULT_TERRAIN = "stone";
