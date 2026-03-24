function showSection(id) {

  // hide all sections
  document.querySelectorAll(".content").forEach(section => {
    section.classList.add("hidden");
  });

  // show clicked one
  document.getElementById(id).classList.remove("hidden");
}