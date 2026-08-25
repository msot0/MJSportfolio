// ---------- SECTION NAV ----------
function showSection(id, el) {
  document.querySelectorAll(".content").forEach(section => {
    section.classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");

  document.querySelectorAll("nav li").forEach(li => li.classList.remove("active"));
  if (el) el.classList.add("active");

  const lookText = document.querySelector(".take-a-look");
  if (lookText) lookText.style.display = "none";

  window.scrollTo({ top: document.querySelector("nav").offsetTop, behavior: "smooth" });
}

// ---------- PARALLAX DOODLES ----------
const doodles = document.querySelectorAll(".doodle");

function updateParallax() {
  const scrollY = window.scrollY;
  doodles.forEach(el => {
    const speed = parseFloat(el.dataset.speed) || 0.2;
    el.style.transform = `translateY(${scrollY * speed}px) rotate(${scrollY * speed * 0.05}deg)`;
  });
}

let ticking = false;
window.addEventListener("scroll", () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      updateParallax();
      ticking = false;
    });
    ticking = true;
  }
});
updateParallax();

// ---------- SCROLL REVEAL FOR PROJECT CARDS ----------
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in-view");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll(".project").forEach(card => revealObserver.observe(card));

// ---------- RESPONSIVE GAME EMBEDS ----------
// Each embedded game is a fixed-size page. Scale it down to fit any screen
// width (phones included) while keeping everything proportional, instead
// of cropping or forcing horizontal scroll. Reads base size from data-*
// attributes so multiple games with different native sizes all work.
function resizeGameEmbeds() {
  document.querySelectorAll(".game-embed-inner").forEach(inner => {
    const frame = inner.querySelector("iframe");
    if (!frame) return;
    const baseWidth = parseInt(inner.dataset.baseWidth, 10) || frame.width || 1000;
    const baseHeight = parseInt(inner.dataset.baseHeight, 10) || frame.height || 560;
    const containerWidth = inner.parentElement.clientWidth;
    const scale = Math.min(1, containerWidth / baseWidth);

    frame.style.width = baseWidth + "px";
    frame.style.height = baseHeight + "px";
    frame.style.transform = `scale(${scale})`;
    inner.style.height = (baseHeight * scale) + "px";
  });
}

window.addEventListener("resize", resizeGameEmbeds);
window.addEventListener("load", resizeGameEmbeds);
resizeGameEmbeds();

// ---------- EVENT PHOTO CAROUSEL ----------
// Click arrows on desktop; swipe on mobile (native scroll-snap handles touch).
const carouselTrack = document.getElementById("carousel-track");

function carouselMove(direction) {
  if (!carouselTrack) return;
  const slide = carouselTrack.querySelector(".carousel-slide");
  if (!slide) return;
  const slideWidth = slide.getBoundingClientRect().width + 16; // + gap
  carouselTrack.scrollBy({ left: direction * slideWidth, behavior: "smooth" });
}
