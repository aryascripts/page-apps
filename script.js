// Security: Sanitize and validate URL to prevent XSS and open redirects
function sanitizeURL(url) {
  // Only allow relative paths starting with /
  if (!url || typeof url !== "string") {
    return "#";
  }
  // Remove any protocol, host, or javascript: schemes
  const cleaned = url.trim();
  if (
    cleaned.startsWith("http://") ||
    cleaned.startsWith("https://") ||
    cleaned.startsWith("javascript:") ||
    cleaned.startsWith("data:") ||
    cleaned.startsWith("vbscript:")
  ) {
    return "#";
  }
  // Only allow paths starting with /
  if (!cleaned.startsWith("/")) {
    return "#";
  }
  // Remove any null bytes or other dangerous characters
  return cleaned.replace(/[\x00-\x1F\x7F]/g, "");
}

// Security: Create SVG element safely
function createSVGIcon(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) {
    return null;
  }
  // Remove any script tags or event handlers as an extra safety measure
  const scripts = svg.querySelectorAll("script");
  scripts.forEach((script) => script.remove());
  // Remove event handlers
  const allElements = svg.querySelectorAll("*");
  allElements.forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return svg;
}

const tools = [
  {
    name: "Tap Counter",
    path: "/page-apps/counter",
    description: "A simple tap counter with dark mode support",
    icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 11l3 3L22 4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    name: "Image to BMP Converter",
    path: "/page-apps/bmp-convert",
    description:
      "Convert PNG/JPEG images to BMP format locally in your browser",
    icon: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="8.5" cy="8.5" r="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M21 15l-5-5L5 21" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
];

// Wait for DOM to be ready before accessing elements
document.addEventListener("DOMContentLoaded", () => {
  const toolsGrid = document.getElementById("toolsGrid");

  if (!toolsGrid) {
    console.error("toolsGrid element not found");
    return;
  }

  tools.forEach((tool) => {
    // Security: Use DOM methods instead of innerHTML to prevent XSS
    const toolCard = document.createElement("a");
    toolCard.href = sanitizeURL(tool.path);
    toolCard.className = "tool-card";

    const card = document.createElement("div");
    card.className = "card";

    const iconContainer = document.createElement("div");
    iconContainer.className = "tool-icon";
    const svgIcon = createSVGIcon(tool.icon);
    if (svgIcon) {
      iconContainer.appendChild(svgIcon);
    }

    const nameHeading = document.createElement("h3");
    nameHeading.className = "tool-name";
    nameHeading.textContent = tool.name; // textContent prevents XSS

    const descriptionPara = document.createElement("p");
    descriptionPara.className = "tool-description";
    descriptionPara.textContent = tool.description; // textContent prevents XSS

    card.appendChild(iconContainer);
    card.appendChild(nameHeading);
    card.appendChild(descriptionPara);
    toolCard.appendChild(card);

    toolsGrid.appendChild(toolCard);
  });
});
