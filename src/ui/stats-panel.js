// Stats panel — a pure view that reflects a character state object into a DOM
// panel beside the viewport. Give it the character; call update() whenever the
// state changes (once now; per-hit later when combat exists).
//
// Stat rows are declarative, so adding a stat is one entry here.

const ROWS = [
  { type: "bar",   label: "Health",  value: "health", max: "healthMax" },
  { type: "value", label: "Attack",  value: "attack" },
  { type: "value", label: "Defense", value: "defense" },
  { type: "bar",   label: "Morale",  value: "morale", max: "moraleMax" },
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

function barRow(label, value, max) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    `<div class="stats-row">` +
      `<div class="stats-head"><span>${label}</span><span class="stats-value">${value} / ${max}</span></div>` +
      `<div class="stats-bar"><div class="stats-fill" style="width:${frac * 100}%;background:${barColor(frac)}"></div></div>` +
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
  function update(ch) {
    const rows = ROWS.map((row) =>
      row.type === "bar"
        ? barRow(row.label, ch[row.value], ch[row.max])
        : valueRow(row.label, ch[row.value])
    ).join("");

    root.innerHTML =
      `<div class="stats-name">${ch.name}</div>` +
      `<div class="stats-rows">${rows}</div>`;
  }

  return { update };
}
