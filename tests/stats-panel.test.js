import assert from "node:assert/strict";
import test from "node:test";

import { createStatsPanel } from "../src/ui/stats-panel.js";

function createPanelCharacter({ health = 4, healthMax = 13 } = {}) {
  return {
    name: "Test Hero",
    stats: { health, attack: 3, defense: 2, morale: 5 },
    statsMax: { health: healthMax, attack: 6, defense: 4, morale: 10 },
  };
}

function createRoot() {
  const classes = new Set();
  return {
    innerHTML: "",
    querySelector() { return null; },
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains(name) { return classes.has(name); },
    },
  };
}

function occurrences(text, token) {
  return text.split(token).length - 1;
}

test("removes both health bars when health reaches zero", () => {
  const root = createRoot();
  const panel = createStatsPanel(root);
  const character = createPanelCharacter({ health: 1, healthMax: 13 });

  panel.update(character);
  assert.equal(occurrences(root.innerHTML, 'class="stats-bar"'), 3);
  assert.equal(occurrences(root.innerHTML, 'class="stats-remainder"'), 2);

  character.stats.health = 0;
  panel.update(character);

  assert.match(root.innerHTML, />0 \/ 13</);
  assert.equal(occurrences(root.innerHTML, 'class="stats-bar"'), 2);
  assert.equal(occurrences(root.innerHTML, 'class="stats-remainder"'), 1);
});

test("updates Health and Attack remainders independently", () => {
  const fills = {
    health: { style: {} },
    attack: { style: {} },
  };
  const root = {
    innerHTML: "",
    querySelector(selector) {
      if (selector.includes('data-stat="health"')) return fills.health;
      if (selector.includes('data-stat="attack"')) return fills.attack;
      return null;
    },
  };
  const panel = createStatsPanel(root);
  panel.update(createPanelCharacter());

  panel.setRemainder("health", 0.25);
  panel.setRemainder("attack", 0.7);

  assert.equal(fills.health.style.width, "25%");
  assert.equal(fills.attack.style.width, "70%");
});

test("shows numeric stat values only in debug mode", () => {
  const root = createRoot();
  const panel = createStatsPanel(root);

  panel.setDebug(false);
  assert.equal(root.classList.contains("is-debug"), false);

  panel.setDebug(true);
  assert.equal(root.classList.contains("is-debug"), true);

  panel.setDebug(false);
  assert.equal(root.classList.contains("is-debug"), false);
});

test("renders Level as a green bar from one fifth through full", () => {
  const root = createRoot();
  const panel = createStatsPanel(root);
  panel.setLevel({ number: 1, total: 5, progress: 0.2 });
  panel.update(createPanelCharacter());

  assert.match(root.innerHTML, />Level</);
  assert.match(root.innerHTML, />1 \/ 5</);
  assert.match(root.innerHTML, /width:20%/);
  assert.match(root.innerHTML, /background:rgb\(104, 156, 112\)/);

  panel.setLevel({ number: 5, total: 5, progress: 1 });
  assert.match(root.innerHTML, />5 \/ 5</);
  assert.match(root.innerHTML, /width:100%/);
});
