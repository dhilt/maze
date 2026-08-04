import assert from "node:assert/strict";
import test from "node:test";

import { createCharacter, damage } from "../src/entities/character.js";
import { createStatsPanel } from "../src/ui/stats-panel.js";

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
  const character = createCharacter({ stats: { health: 1 } });

  panel.update(character);
  assert.equal(occurrences(root.innerHTML, 'class="stats-bar"'), 3);
  assert.equal(occurrences(root.innerHTML, 'class="stats-remainder"'), 2);

  damage(character, 1);
  panel.update(character);

  assert.match(root.innerHTML, />0 \/ 20</);
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
  panel.update(createCharacter());

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
