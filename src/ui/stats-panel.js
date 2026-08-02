// Stats panel — a pure view that reflects a character state object into a DOM
// panel beside the viewport. Give it the character; call update() whenever the
// state changes (once now; per-hit later when combat exists).
//
// Stat rows are declarative, so adding a stat is one entry here.

const ROWS = [
  { type: "bar",   label: "Health",  key: "health", drain: true, hideWhenEmpty: true },
  { type: "value", label: "Attack",  key: "attack" },
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

function barRow(label, value, max, withDrain, hideWhenEmpty) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const color = barColor(frac);
  // At zero health the numeric value is sufficient; neither the empty track nor
  // its drain indicator represents anything useful.
  const visible = !hideWhenEmpty || value > 0;
  const bar = visible
    ? `<div class="stats-bar"><div class="stats-fill" style="width:${frac * 100}%;background:${color}"></div></div>`
    : "";
  // A 1px drain bar under Health: time until the next -1 HP, updated live.
  const drain = withDrain && visible
    ? `<div class="stats-drain"><div class="stats-drain-fill" style="width:100%;background:${color}"></div></div>`
    : "";
  return (
    `<div class="stats-row">` +
      `<div class="stats-head"><span>${label}</span><span class="stats-value">${value} / ${max}</span></div>` +
      bar +
      drain +
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

export function createStatsPanel(root) {
  let current = null; // last character, for the live drain colour
  let drainFill = null; // the 1px drain fill element (re-cached on rebuild)

  function update(ch) {
    current = ch;
    const rows = ROWS.map((row) =>
      row.type === "bar"
        ? barRow(
            row.label,
            ch.stats[row.key],
            ch.statsMax[row.key],
            row.drain,
            row.hideWhenEmpty,
          )
        : valueRow(row.label, ch.stats[row.key])
    ).join("");

    root.innerHTML =
      `<div class="stats-name">${ch.name}</div>` +
      `<div class="stats-rows">${rows}</div>`;

    drainFill = root.querySelector(".stats-drain-fill");
  }

  // remaining ∈ [0,1]: fraction of the current drain interval left. The bar
  // empties right-to-left; its colour tracks the (wide) health bar.
  function setDrain(remaining) {
    if (!drainFill || !current) return;
    const r = Math.max(0, Math.min(1, remaining));
    const healthMax = current.statsMax.health;
    const frac = healthMax > 0 ? current.stats.health / healthMax : 0;
    drainFill.style.width = `${r * 100}%`;
    drainFill.style.background = barColor(frac);
  }

  return { update, setDrain };
}
