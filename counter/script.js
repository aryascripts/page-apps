// DOM elements
const countArea = document.getElementById("countArea");
const counter = document.getElementById("counter");
const resetBtn = document.getElementById("resetBtn");
const themeToggle = document.getElementById("themeToggle");
const tapPulse = document.getElementById("tapPulse");

// State
let count = 0;
let isDarkMode = false;
let firstVisit = true;

// Start pulse animation on first load
window.addEventListener("load", () => {
  tapPulse.classList.add("animate");

  // Remove animation after a few seconds
  setTimeout(() => {
    tapPulse.classList.remove("animate");
  }, 5000);
});

// Increment counter on tap/click
document.body.addEventListener("click", (e) => {
  // Don't increment if clicking on buttons
  if (e.target.tagName === "BUTTON") return;

  count++;
  counter.textContent = count;

  // Add and remove animation class
  counter.classList.add("animate");
  setTimeout(() => {
    counter.classList.remove("animate");
  }, 150);

  // Stop the pulse animation if it's still running
  tapPulse.classList.remove("animate");
});

// Reset counter
resetBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // Prevent body click handler from firing
  count = 0;
  counter.textContent = count;
});

// Toggle dark/light mode
themeToggle.addEventListener("click", (e) => {
  e.stopPropagation(); // Prevent body click handler from firing
  isDarkMode = !isDarkMode;
  document.body.classList.toggle("dark-mode", isDarkMode);
  themeToggle.textContent = isDarkMode ? "Light Mode" : "Dark Mode";
});
