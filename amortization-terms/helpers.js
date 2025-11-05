// Helper and utility functions

/**
 * Format currency for display
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

let notificationTimeout = null;

/**
 * Show notification message
 */
export function showNotification(message, type = "success") {
  const notification = document.getElementById("notification");
  const icon = document.getElementById("notificationIcon");
  const text = document.getElementById("notificationText");

  // Clear any existing timeout
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }

  notification.className = `notification ${type}`;
  text.textContent = message;

  // Update icon based on type
  if (type === "error") {
    icon.innerHTML = `
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="12" y1="9" x2="12" y2="13" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  } else {
    icon.innerHTML = `
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 4L12 14.01l-3-3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  notification.classList.add("visible");

  // Auto-hide after 5 seconds
  notificationTimeout = setTimeout(() => {
    notification.classList.remove("visible");
  }, 5000);
}
