// Helper and utility functions

// Security: Escape HTML to prevent XSS
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function downloadBMP(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Use original filename if available, otherwise default name
  // Security: Sanitize filename to prevent path traversal
  let baseName = "converted";
  if (fileName) {
    baseName = fileName.replace(/\.[^/.]+$/, "");
    // Remove any dangerous characters
    baseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");
    // Limit length
    baseName = baseName.substring(0, 100);
  }
  a.download = `${baseName}.bmp`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Security: Clean up object URL immediately after download starts
  // Using requestAnimationFrame for better cleanup timing
  requestAnimationFrame(() => {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // Return file size for notification
  const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
  return sizeMB;
}

let notificationTimeout = null;

export function showNotification(
  message,
  type = "info",
  notificationText,
  notificationIcon,
  notification
) {
  // Clear any existing timeout
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }

  // Update notification
  notificationText.textContent = message;
  notification.className = `notification visible ${type}`;

  // Update icon based on type
  if (notificationIcon) {
    if (type === "success") {
      notificationIcon.innerHTML = `
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 4L12 14.01l-3-3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    } else if (type === "error") {
      notificationIcon.innerHTML = `
        <circle cx="12" cy="12" r="10" stroke-width="2"/>
        <path d="M15 9l-6 6M9 9l6 6" stroke-width="2" stroke-linecap="round"/>
      `;
    } else {
      notificationIcon.innerHTML = `
        <circle cx="12" cy="12" r="10" stroke-width="2"/>
        <path d="M12 16v-4M12 8h.01" stroke-width="2" stroke-linecap="round"/>
      `;
    }
  }

  // Auto-hide after 5 seconds
  notificationTimeout = setTimeout(() => {
    notification.classList.remove("visible");
  }, 5000);
}
