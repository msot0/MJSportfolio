// Wires the on-screen buttons to the same `keys` object game.js reads from,
// so touch input behaves exactly like the matching keyboard key.
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll("#touch-controls button[data-key]");

  function press(k, btn) {
    keys[k] = true;
    btn.classList.add("pressed");
  }
  function release(k, btn) {
    keys[k] = false;
    btn.classList.remove("pressed");
  }

  buttons.forEach((btn) => {
    const k = btn.dataset.key;
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); press(k, btn); }, { passive: false });
    btn.addEventListener("touchend", (e) => { e.preventDefault(); release(k, btn); }, { passive: false });
    btn.addEventListener("touchcancel", (e) => { e.preventDefault(); release(k, btn); }, { passive: false });
    btn.addEventListener("mousedown", () => press(k, btn));
    btn.addEventListener("mouseup", () => release(k, btn));
    btn.addEventListener("mouseleave", () => release(k, btn));
  });
});
