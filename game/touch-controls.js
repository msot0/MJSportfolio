// Wires the on-screen buttons to the same `keys` object and player
// methods that keyboard controls use, so mobile play behaves identically.
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll("#touch-controls button[data-key]");

  function press(k, btn) {
    keys[k] = true;
    btn.classList.add("pressed");
    if (typeof runner1 !== "undefined" && typeof runner2 !== "undefined") {
      if (k === "f") runner1.startJump();
      if (k === "h") runner2.startJump();
      if (k === "q" && !togglePlayer1) {
        runner1.toggleSprite();
        togglePlayer1 = true;
      }
      if (k === "p" && !togglePlayer2) {
        runner2.toggleSprite();
        togglePlayer2 = true;
      }
    }
  }

  function release(k, btn) {
    keys[k] = false;
    btn.classList.remove("pressed");
    if (k === "q") togglePlayer1 = false;
    if (k === "p") togglePlayer2 = false;
  }

  buttons.forEach((btn) => {
    const k = btn.dataset.key;

    btn.addEventListener("touchstart", (e) => { e.preventDefault(); press(k, btn); }, { passive: false });
    btn.addEventListener("touchend", (e) => { e.preventDefault(); release(k, btn); }, { passive: false });
    btn.addEventListener("touchcancel", (e) => { e.preventDefault(); release(k, btn); }, { passive: false });

    // also support mouse, so it works with a trackpad/mouse too
    btn.addEventListener("mousedown", () => press(k, btn));
    btn.addEventListener("mouseup", () => release(k, btn));
    btn.addEventListener("mouseleave", () => release(k, btn));
  });

  // Tapping the canvas area itself still needs to trigger the start/restart
  // buttons drawn by the sketch (mousePressed already handles this via
  // p5's built-in touch-to-mouse mapping, no extra code needed here).
});
