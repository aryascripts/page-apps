// Main application logic and UI handlers
import { escapeHtml, downloadBMP, showNotification } from "./helpers.js";
import { encodeBMP, encodeBMP8Bit, encodeBMP4Bit } from "./encoder.js";
import {
  generatePreview24Bit,
  generatePreview8Bit,
  generatePreview4Bit,
} from "./preview.js";

// DOM Elements
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const previewSection = document.getElementById("previewSection");
const convertBtn = document.getElementById("convertBtn");
const clearBtn = document.getElementById("clearBtn");
const imageInfo = document.getElementById("imageInfo");
const notification = document.getElementById("notification");
const notificationText = document.getElementById("notificationText");
const notificationIcon = document.getElementById("notificationIcon");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const cropOriginal = document.getElementById("cropOriginal");
const cropXteink = document.getElementById("cropXteink");
const cropCustom = document.getElementById("cropCustom");
const cropFit = document.getElementById("cropFit");
const customCropInputs = document.getElementById("customCropInputs");
const fitOptions = document.getElementById("fitOptions");
const backgroundColorInput = document.getElementById("backgroundColor");
const customWidth = document.getElementById("customWidth");
const customHeight = document.getElementById("customHeight");
const cropPositionSelector = document.getElementById("cropPositionSelector");
const cropPositionButtons = document.querySelectorAll(".crop-position-btn");
const compressionLevel = document.getElementById("compressionLevel");
const compressionHelp = document.getElementById("compressionHelp");
const compressionHelpText = document.getElementById("compressionHelpText");
const tabOriginal = document.getElementById("tabOriginal");
const tabPreview = document.getElementById("tabPreview");
const tabContentOriginal = document.getElementById("tabContentOriginal");
const tabContentPreview = document.getElementById("tabContentPreview");

// State
let currentImage = null;
let currentFileName = null;

// Initialize - ensure DOM is ready (though modules are deferred)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function init() {
  // Reset crop options to default (Xteink) on page load
  // This prevents browsers from remembering the "custom" selection after refresh
  if (cropXteink) {
    cropXteink.checked = true;
  }
  if (cropCustom) {
    cropCustom.checked = false;
  }
  if (cropOriginal) {
    cropOriginal.checked = false;
  }
  // Ensure custom inputs are hidden on load
  if (customCropInputs) {
    customCropInputs.style.display = "none";
  }
  // Set initial crop position selector visibility
  handleCropOptionChange();

  setupEventListeners();
}

function setupEventListeners() {
  // Verify elements exist before adding listeners
  if (!dropZone || !fileInput) {
    console.error("Drop zone or file input not found!");
    return;
  }

  // Click to upload - primary handler for desktop (macOS, Windows, etc.)
  dropZone.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Trigger file input click - must be in same event loop as user interaction
      if (fileInput) {
        try {
          fileInput.click();
        } catch (error) {
          console.error("Failed to trigger file input:", error);
        }
      }
    },
    false
  );

  // Touch events for mobile (iOS Safari compatibility)
  // These only fire on actual touch devices, so they won't interfere with macOS
  let touchStarted = false;
  dropZone.addEventListener(
    "touchstart",
    () => {
      touchStarted = true;
    },
    { passive: true }
  );

  dropZone.addEventListener(
    "touchend",
    (e) => {
      if (touchStarted && fileInput) {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      }
      touchStarted = false;
    },
    { passive: false }
  );

  // File input change
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag and drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });

  // Convert button
  convertBtn.addEventListener("click", convertToBMP);

  // Clear button
  clearBtn.addEventListener("click", clearImage);

  // Tab switching
  if (tabOriginal) {
    tabOriginal.addEventListener("click", () => switchTab("original"));
  }
  if (tabPreview) {
    tabPreview.addEventListener("click", () => switchTab("preview"));
  }

  // Crop option radio buttons
  if (cropOriginal) {
    cropOriginal.addEventListener("change", () => {
      handleCropOptionChange();
      updatePreview();
    });
  }
  if (cropXteink) {
    cropXteink.addEventListener("change", () => {
      handleCropOptionChange();
      updatePreview();
    });
  }
  if (cropCustom) {
    cropCustom.addEventListener("change", () => {
      handleCropOptionChange();
      updatePreview();
    });
  }
  if (cropFit) {
    cropFit.addEventListener("change", () => {
      handleCropOptionChange();
      updatePreview();
    });
  }

  // Custom dimension inputs
  if (customWidth) {
    customWidth.addEventListener("input", debounce(updatePreview, 300));
  }
  if (customHeight) {
    customHeight.addEventListener("input", debounce(updatePreview, 300));
  }
  if (backgroundColorInput) {
    backgroundColorInput.addEventListener("input", debounce(updatePreview, 100));
  }

  // Compression level change handler
  if (compressionLevel) {
    compressionLevel.addEventListener("change", (e) => {
      handleCompressionLevelChange();
      // updatePreview is called inside handleCompressionLevelChange
    });
  }

  // Crop position button handlers
  if (cropPositionButtons && cropPositionButtons.length > 0) {
    cropPositionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Remove active class from all buttons
        cropPositionButtons.forEach((b) => b.classList.remove("active"));
        // Add active class to clicked button
        btn.classList.add("active");
        updatePreview();
      });
    });
  }
}

function switchTab(tabName) {
  if (tabName === "original") {
    tabOriginal?.classList.add("active");
    tabPreview?.classList.remove("active");
    tabContentOriginal?.classList.add("active");
    tabContentPreview?.classList.remove("active");
  } else if (tabName === "preview") {
    tabOriginal?.classList.remove("active");
    tabPreview?.classList.add("active");
    tabContentOriginal?.classList.remove("active");
    tabContentPreview?.classList.add("active");
    // Generate preview when switching to preview tab if not already generated
    if (currentImage) {
      updatePreview();
    }
  }
}

// Debounce helper for preview updates
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function handleCropOptionChange() {
  const isCustom = cropCustom && cropCustom.checked;
  const isXteink = cropXteink && cropXteink.checked;
  const isFit = cropFit && cropFit.checked;

  // Show position selector for any mode that involves resizing/placement
  const showCropPosition = isCustom || isXteink || isFit;

  // Show dimension inputs for Custom and Fit (so Fit has a box to fit into)
  if (customCropInputs) {
    customCropInputs.style.display = isCustom || isFit ? "flex" : "none";
  }
  // Show background color for Fit and Custom
  if (fitOptions) {
    fitOptions.style.display = isFit || isCustom ? "block" : "none";
  }
  if (cropPositionSelector) {
    cropPositionSelector.style.display = showCropPosition ? "block" : "none";
  }
}

// Get selected crop position from active button
function getSelectedCropPosition() {
  if (!cropPositionButtons || cropPositionButtons.length === 0) {
    return "center";
  }
  const activeButton = Array.from(cropPositionButtons).find((btn) =>
    btn.classList.contains("active")
  );
  return activeButton ? activeButton.dataset.position : "center";
}

// Calculate crop parameters for cover-style cropping with position selection
function calculateCropParams(
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  position = "center"
) {
  // Early return if no cropping needed
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return {
      sourceX: 0,
      sourceY: 0,
      sourceWidth,
      sourceHeight,
    };
  }

  // Calculate scale to cover (like CSS object-fit: cover)
  const scale = Math.max(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight
  );

  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;
  const excessWidth = scaledWidth - targetWidth;
  const excessHeight = scaledHeight - targetHeight;

  // Calculate crop offsets based on position
  let cropX = excessWidth / 2; // Default: center
  let cropY = excessHeight / 2; // Default: center

  switch (position) {
    case "top":
      cropX = excessWidth / 2;
      cropY = 0;
      break;
    case "bottom":
      cropX = excessWidth / 2;
      cropY = excessHeight;
      break;
    case "left":
      cropX = 0;
      cropY = excessHeight / 2;
      break;
    case "right":
      cropX = excessWidth;
      cropY = excessHeight / 2;
      break;
    case "center":
    default:
      // Already set above
      break;
  }

  // Convert back to source image coordinates
  return {
    sourceX: cropX / scale,
    sourceY: cropY / scale,
    sourceWidth: targetWidth / scale,
    sourceHeight: targetHeight / scale,
  };
}

// Parse hex color (#rgb, #rrggbb, #rrggbbaa) to RGBA object (alpha ignored -> 255)
function parseHexColorToRGBA(hex) {
  if (!hex) return { r: 0, g: 0, b: 0, a: 255 };
  let h = String(hex).trim().replace(/^#/, "");
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b, a: 255 };
  }
  if (h.length === 6 || h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b, a: 255 };
  }
  return { r: 0, g: 0, b: 0, a: 255 };
}

// Calculate fit (contain) parameters with position selection
function calculateFitParams(
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  position = "center"
) {
  // Scale to fit entirely within target (like CSS object-fit: contain)
  const scale = Math.min(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight
  );

  const drawWidth = Math.round(sourceWidth * scale);
  const drawHeight = Math.round(sourceHeight * scale);

  const extraX = targetWidth - drawWidth;
  const extraY = targetHeight - drawHeight;

  let dx = Math.floor(extraX / 2);
  let dy = Math.floor(extraY / 2);

  switch (position) {
    case "top":
      dx = Math.floor(extraX / 2);
      dy = 0;
      break;
    case "bottom":
      dx = Math.floor(extraX / 2);
      dy = extraY;
      break;
    case "left":
      dx = 0;
      dy = Math.floor(extraY / 2);
      break;
    case "right":
      dx = extraX;
      dy = Math.floor(extraY / 2);
      break;
    case "center":
    default:
      // already centered
      break;
  }

  return { dx, dy, drawWidth, drawHeight };
}

function handleCompressionLevelChange() {
  if (!compressionLevel || !compressionHelp || !compressionHelpText) {
    return;
  }

  const selectedValue = compressionLevel.value;
  const helpTexts = {
    24: {
      title: "24-bit",
      description:
        "Highest quality, no compression. Best for preserving exact colors.",
      size: "~1.1 MB",
    },
    8: {
      title: "8-bit (standard)",
      description:
        "Standard quality with color palette. Good balance of quality and file size.",
      size: "~376 KB",
    },
    "8-dithered": {
      title: "8-bit (dithered)",
      description:
        "8-bit with dithering for smoother gradients. Better visual quality than standard 8-bit.",
      size: "~350 KB",
    },
    4: {
      title: "4-bit",
      description:
        "Smaller file size with reduced colors. Suitable for simple images.",
      size: "~188 KB",
    },
    "4-aggressive": {
      title: "4-bit (aggressive)",
      description:
        "Maximum compression. Smallest file size, may reduce quality.",
      size: "~150 KB",
    },
  };

  const helpInfo = helpTexts[selectedValue];
  if (helpInfo) {
    compressionHelpText.innerHTML = `
      <strong>${helpInfo.title}:</strong> ${helpInfo.description}<br>
      <span style="opacity: 0.8; font-size: 0.9em;">Estimated size: ${helpInfo.size}</span>
    `;
    compressionHelp.style.display = "block";
  } else {
    compressionHelp.style.display = "none";
  }

  // Update preview when compression changes
  if (currentImage) {
    updatePreview();
  }
}

function handleFile(file) {
  // Validate file type
  if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
    showNotification(
      "Please upload a PNG or JPEG file",
      "error",
      notificationText,
      notificationIcon,
      notification
    );
    return;
  }

  // Validate file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    showNotification(
      "File is too large. Maximum size is 50MB",
      "error",
      notificationText,
      notificationIcon,
      notification
    );
    return;
  }

  // Validate filename (prevent path traversal attempts)
  if (
    file.name.includes("..") ||
    file.name.includes("/") ||
    file.name.includes("\\")
  ) {
    showNotification(
      "Invalid filename. Please use a valid image file.",
      "error",
      notificationText,
      notificationIcon,
      notification
    );
    return;
  }

  // Store filename
  currentFileName = file.name;

  const reader = new FileReader();

  reader.onload = (e) => {
    const img = new Image();

    img.onload = () => {
      // Security: Validate image dimensions to prevent memory exhaustion
      const MAX_DIMENSION = 10000; // Reasonable limit
      if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
        showNotification(
          `Image dimensions too large. Maximum is ${MAX_DIMENSION}px on any side.`,
          "error",
          notificationText,
          notificationIcon,
          notification
        );
        return;
      }

      // Security: Check total pixel count to prevent memory exhaustion
      const MAX_PIXELS = 250000000; // ~250MP (reasonable limit for processing)
      if (img.width * img.height > MAX_PIXELS) {
        showNotification(
          "Image is too large. Please resize before converting.",
          "error",
          notificationText,
          notificationIcon,
          notification
        );
        return;
      }

      currentImage = img;
      preview.src = e.target.result;
      previewSection.style.display = "flex";

      // Display image info with filename (safely escaped)
      const fileSizeKB = (file.size / 1024).toFixed(2);
      imageInfo.innerHTML = `
            <div><strong>File:</strong> ${escapeHtml(file.name)}</div>
            <div><strong>Dimensions:</strong> ${img.width} × ${
        img.height
      }px</div>
            <div><strong>Size:</strong> ${fileSizeKB} KB</div>
            <div><strong>Format:</strong> ${escapeHtml(
              file.type.split("/")[1].toUpperCase()
            )}</div>
        `;

      // Show compression help text for currently selected option
      handleCompressionLevelChange();

      // Generate initial preview
      updatePreview();

      showNotification(
        "Image loaded successfully!",
        "success",
        notificationText,
        notificationIcon,
        notification
      );
    };

    img.onerror = () => {
      showNotification(
        "Failed to load image. Please try another file.",
        "error",
        notificationText,
        notificationIcon,
        notification
      );
    };

    img.src = e.target.result;
  };

  reader.onerror = () => {
    showNotification(
      "Failed to read file",
      "error",
      notificationText,
      notificationIcon,
      notification
    );
  };

  reader.readAsDataURL(file);
}

function clearImage() {
  currentImage = null;
  currentFileName = null;
  preview.src = "";
  fileInput.value = "";
  previewSection.style.display = "none";
  imageInfo.innerHTML = "";
  previewCanvas.width = 0;
  previewCanvas.height = 0;
  // Reset to preview tab (default)
  switchTab("preview");
}

function updatePreview() {
  if (!currentImage) return;

  try {
    // Determine target dimensions based on crop option
    let targetWidth = currentImage.width;
    let targetHeight = currentImage.height;

    if (cropXteink && cropXteink.checked) {
      targetWidth = 480;
      targetHeight = 800;
    } else if (cropCustom && cropCustom.checked) {
      targetWidth = parseInt(customWidth.value) || currentImage.width;
      targetHeight = parseInt(customHeight.value) || currentImage.height;
    } else if (cropFit && cropFit.checked) {
      // For Fit, use custom box by default if provided; otherwise keep current image dimensions
      const w = parseInt(customWidth?.value);
      const h = parseInt(customHeight?.value);
      if (Number.isInteger(w) && w > 0) targetWidth = w;
      if (Number.isInteger(h) && h > 0) targetHeight = h;
    }

    // Validate dimensions
    if (
      targetWidth <= 0 ||
      targetHeight <= 0 ||
      !Number.isInteger(targetWidth) ||
      !Number.isInteger(targetHeight)
    ) {
      return;
    }

    // Set canvas dimensions for processing
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get position for placement (only if not original size)
    const needsSizing =
      targetWidth !== currentImage.width ||
      targetHeight !== currentImage.height;
    const position = needsSizing ? getSelectedCropPosition() : "center";

    if (cropFit && cropFit.checked) {
      // Fill background then draw fitted image
      const bg = parseHexColorToRGBA(backgroundColorInput ? backgroundColorInput.value : "#000000");
      ctx.fillStyle = `rgb(${bg.r}, ${bg.g}, ${bg.b})`;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const fit = calculateFitParams(
        currentImage.width,
        currentImage.height,
        targetWidth,
        targetHeight,
        position
      );
      ctx.drawImage(
        currentImage,
        0,
        0,
        currentImage.width,
        currentImage.height,
        fit.dx,
        fit.dy,
        fit.drawWidth,
        fit.drawHeight
      );
    } else {
      // Calculate and apply cover/crop
      const crop = calculateCropParams(
        currentImage.width,
        currentImage.height,
        targetWidth,
        targetHeight,
        position
      );

      ctx.drawImage(
        currentImage,
        crop.sourceX,
        crop.sourceY,
        crop.sourceWidth,
        crop.sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );
    }

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Generate preview based on compression level
    let previewImageData;
    const level = compressionLevel ? compressionLevel.value : "24";

    switch (level) {
      case "24":
        previewImageData = generatePreview24Bit(imageData);
        break;
      case "8":
        previewImageData = generatePreview8Bit(imageData);
        break;
      case "8-dithered":
        previewImageData = generatePreview8Bit(imageData, true);
        break;
      case "4":
        previewImageData = generatePreview4Bit(imageData, false);
        break;
      case "4-aggressive":
        previewImageData = generatePreview4Bit(imageData, true);
        break;
      default:
        previewImageData = generatePreview8Bit(imageData);
        break;
    }

    // Ensure we have a fresh ImageData object (not a reference)
    // Create a new ImageData to avoid any potential caching issues
    const freshImageData = new ImageData(
      new Uint8ClampedArray(previewImageData.data),
      previewImageData.width,
      previewImageData.height
    );
    previewImageData = freshImageData;

    // Set preview canvas dimensions (this clears the canvas)
    // Force a change to ensure browser updates
    if (previewCanvas.width !== previewImageData.width) {
      previewCanvas.width = previewImageData.width;
    } else {
      // Force clear by temporarily changing width
      previewCanvas.width = 0;
      previewCanvas.width = previewImageData.width;
    }

    if (previewCanvas.height !== previewImageData.height) {
      previewCanvas.height = previewImageData.height;
    } else {
      previewCanvas.height = 0;
      previewCanvas.height = previewImageData.height;
    }

    // Clear canvas before drawing
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Draw preview
    previewCtx.putImageData(previewImageData, 0, 0);

    // Force browser to update the canvas display by toggling visibility
    const wasVisible = previewCanvas.style.visibility !== "hidden";
    previewCanvas.style.visibility = "hidden";
    // Force reflow
    void previewCanvas.offsetHeight;
    previewCanvas.style.visibility = wasVisible ? "visible" : "";
  } catch (error) {
    console.error("Preview generation error:", error);
  }
}

function convertToBMP() {
  if (!currentImage) return;

  convertBtn.disabled = true;
  showNotification(
    "Converting to BMP...",
    "info",
    notificationText,
    notificationIcon,
    notification
  );

  try {
    // Determine target dimensions based on crop option
    let targetWidth = currentImage.width;
    let targetHeight = currentImage.height;

    if (cropXteink && cropXteink.checked) {
      targetWidth = 480;
      targetHeight = 800;
    } else if (cropCustom && cropCustom.checked) {
      targetWidth = parseInt(customWidth.value) || currentImage.width;
      targetHeight = parseInt(customHeight.value) || currentImage.height;
    } else if (cropFit && cropFit.checked) {
      const w = parseInt(customWidth?.value);
      const h = parseInt(customHeight?.value);
      if (Number.isInteger(w) && w > 0) targetWidth = w;
      if (Number.isInteger(h) && h > 0) targetHeight = h;
    }
    // If original, keep current dimensions

    // Security: Validate target dimensions before setting canvas
    const MAX_DIMENSION = 10000;
    const MAX_PIXELS = 250000000;
    if (
      targetWidth > MAX_DIMENSION ||
      targetHeight > MAX_DIMENSION ||
      targetWidth * targetHeight > MAX_PIXELS
    ) {
      showNotification(
        "Target dimensions are too large. Please use smaller dimensions.",
        "error",
        notificationText,
        notificationIcon,
        notification
      );
      convertBtn.disabled = false;
      return;
    }

    if (
      targetWidth <= 0 ||
      targetHeight <= 0 ||
      !Number.isInteger(targetWidth) ||
      !Number.isInteger(targetHeight)
    ) {
      showNotification(
        "Invalid dimensions. Please enter positive integers.",
        "error",
        notificationText,
        notificationIcon,
        notification
      );
      convertBtn.disabled = false;
      return;
    }

    // Set canvas dimensions
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get position for placement (only if not original size)
    const needsSizing =
      targetWidth !== currentImage.width ||
      targetHeight !== currentImage.height;
    const position = needsSizing ? getSelectedCropPosition() : "center";

    if (cropFit && cropFit.checked) {
      const bg = parseHexColorToRGBA(backgroundColorInput ? backgroundColorInput.value : "#000000");
      ctx.fillStyle = `rgb(${bg.r}, ${bg.g}, ${bg.b})`;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const fit = calculateFitParams(
        currentImage.width,
        currentImage.height,
        targetWidth,
        targetHeight,
        position
      );
      ctx.drawImage(
        currentImage,
        0,
        0,
        currentImage.width,
        currentImage.height,
        fit.dx,
        fit.dy,
        fit.drawWidth,
        fit.drawHeight
      );
    } else {
      // Calculate and apply crop
      const crop = calculateCropParams(
        currentImage.width,
        currentImage.height,
        targetWidth,
        targetHeight,
        position
      );

      ctx.drawImage(
        currentImage,
        crop.sourceX,
        crop.sourceY,
        crop.sourceWidth,
        crop.sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );
    }

    // Use manual BMP encoder (browsers don't natively support image/bmp format)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Choose encoding based on compression level
    let bmpBlob;
    const level = compressionLevel ? compressionLevel.value : "8";

    switch (level) {
      case "24":
        bmpBlob = encodeBMP(imageData);
        break;
      case "8":
        bmpBlob = encodeBMP8Bit(imageData);
        break;
      case "8-dithered":
        bmpBlob = encodeBMP8Bit(imageData, true);
        break;
      case "4":
        bmpBlob = encodeBMP4Bit(imageData, false);
        break;
      case "4-aggressive":
        bmpBlob = encodeBMP4Bit(imageData, true);
        break;
      default:
        bmpBlob = encodeBMP8Bit(imageData);
        break;
    }

    const sizeMB = downloadBMP(bmpBlob, currentFileName);
    showNotification(
      `BMP file downloaded successfully! (${sizeMB} MB)`,
      "success",
      notificationText,
      notificationIcon,
      notification
    );
    convertBtn.disabled = false;
  } catch (error) {
    showNotification(
      "Conversion failed: " + error.message,
      "error",
      notificationText,
      notificationIcon,
      notification
    );
    convertBtn.disabled = false;
  }
}

// Prevent default drag behavior on the whole document, but only for drag events
// Don't interfere with click events
document.addEventListener("dragover", (e) => {
  // Only prevent if it's actually a drag operation
  if (e.dataTransfer && e.dataTransfer.types.length > 0) {
    e.preventDefault();
  }
});
document.addEventListener("drop", (e) => {
  // Only prevent if it's actually a drag operation
  if (e.dataTransfer && e.dataTransfer.types.length > 0) {
    e.preventDefault();
  }
});
