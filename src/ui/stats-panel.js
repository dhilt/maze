// Stats panel — a pure view that reflects a character state object into a DOM
// panel beside the viewport. Rebuild it when a whole stat changes; fractional
// Health and Attack remainders update independently between rebuilds.
//
// Stat rows are declarative, so adding a stat is one entry here.

const ROWS = [
  { type: "bar",   label: "Health",  key: "health", remainder: true },
  { type: "bar",   label: "Attack",  key: "attack", remainder: true },
  { type: "value", label: "Defense", key: "defense" },
  { type: "bar",   label: "Morale",  key: "morale" },
];

// Bar colour by fill fraction: full → green, ~50% → yellow, near 0 → red.
// Muted/desaturated so the bars read without grabbing attention.
const RED = [172, 102, 102];
const YELLOW = [182, 164, 104];
const GREEN = [104, 156, 112];

function barColor(frac) {
  const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const c = frac >= 0.5
    ? lerp(YELLOW, GREEN, (frac - 0.5) / 0.5)  // upper half: yellow → green
    : lerp(RED, YELLOW, frac / 0.5);           // lower half: red → yellow
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function barRow(label, key, value, max, withRemainder) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const color = barColor(frac);
  const bar = `<div class="stats-bar"><div class="stats-fill" style="width:${frac * 100}%;background:${color}"></div></div>`;
  const remainder = withRemainder
    ? `<div class="stats-remainder"><div class="stats-remainder-fill" data-stat="${key}" style="width:${value > 0 ? 100 : 0}%;background:${color}"></div></div>`
    : "";
  return (
    `<div class="stats-row">` +
      `<div class="stats-head"><span data-stat-label="${key}">${label}</span><span class="stats-value">${value} / ${max}</span></div>` +
      bar +
      remainder +
    `</div>`
  );
}

function valueRow(label, value) {
  return (
    `<div class="stats-row">` +
      `<div class="stats-head"><span>${label}</span><span class="stats-value">${value}</span></div>` +
    `</div>`
  );
}

function levelRow(level) {
  const progress = Math.max(0, Math.min(1, level.progress));
  const color = `rgb(${GREEN[0]}, ${GREEN[1]}, ${GREEN[2]})`;
  return (
    `<div class="stats-row stats-level">` +
      `<div class="stats-head"><span>Level</span><span class="stats-value">${level.number} / ${level.total}</span></div>` +
      `<div class="stats-bar"><div class="stats-fill" style="width:${progress * 100}%;background:${color}"></div></div>` +
    `</div>`
  );
}

export function createStatsPanel(root) {
  let current = null;
  let currentLevel = null;
  let debugVisible = null;
  const remainderFills = new Map();

  function setDebug(enabled) {
    const visible = Boolean(enabled);
    if (visible === debugVisible) return;
    debugVisible = visible;
    root.classList?.toggle("is-debug", visible);
  }

  function update(ch) {
    current = ch;
    const characterRows = ROWS.map((row) =>
      row.type === "bar"
        ? barRow(
            row.label,
            row.key,
            ch.stats[row.key],
            ch.statsMax[row.key],
            row.remainder,
          )
        : valueRow(row.label, ch.stats[row.key])
    ).join("");
    const rows = (currentLevel ? levelRow(currentLevel) : "") + characterRows;

    root.innerHTML =
      `<div class="stats-name">${ch.name}</div>` +
      `<div class="stats-rows">${rows}</div>`;

    remainderFills.clear();
    for (const row of ROWS.filter((candidate) => candidate.remainder)) {
      const fill = root.querySelector(`.stats-remainder-fill[data-stat="${row.key}"]`);
      if (fill) remainderFills.set(row.key, fill);
    }
  }

  function setLevel(level) {
    currentLevel = level;
    if (current) update(current);
  }

  // Remaining is the fraction of the current sub-point still available.
  function setRemainder(stat, remaining) {
    const fill = remainderFills.get(stat);
    if (!fill || !current) return;
    const r = current.stats[stat] > 0
      ? Math.max(0, Math.min(1, remaining))
      : 0;
    const max = current.statsMax[stat];
    const frac = max > 0 ? current.stats[stat] / max : 0;
    fill.style.width = `${r * 100}%`;
    fill.style.background = barColor(frac);
  }

  function notify(stat) {
    const label = root.querySelector(`[data-stat-label="${stat}"]`);
    if (!label) return;
    label.classList.remove("is-rejected");
    void label.offsetWidth; // restart the animation on repeated attempts
    label.classList.add("is-rejected");
  }

  return { update, setRemainder, setDebug, setLevel, notify };
}
