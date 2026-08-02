// End-of-run overlay: dims the viewport canvas and shows the outcome text with a
// restart control on top. A transparent overlay — no popup box. Reused for both
// endings; show(outcome) swaps the headline.
const TITLES = {
  escaped: "You escaped the maze",
  died: "Game over",
};

export function createCompletion({ element, canvas, onRestart }) {
  const title = element.querySelector(".completion-title");
  const restart = element.querySelector("#restart");
  if (restart && onRestart) restart.addEventListener("click", onRestart);

  return {
    show(outcome) {
      if (title && TITLES[outcome]) title.textContent = TITLES[outcome];
      canvas.classList.add("is-dimmed");
      element.hidden = false;
    },
    hide() {
      canvas.classList.remove("is-dimmed");
      element.hidden = true;
    },
  };
}
