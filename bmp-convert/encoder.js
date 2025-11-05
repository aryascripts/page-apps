// BMP encoding functions

// Shared helper functions for color quantization and palette building

// CIE76 perceptual color distance (more accurate than Euclidean RGB)
// Accounts for human eye sensitivity - green differences are more noticeable
function cie76Distance(r1, g1, b1, r2, g2, b2) {
  // Convert RGB to linear RGB (gamma correction)
  const toLinear = (c) => {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  // Convert to XYZ color space
  const toXYZ = (r, g, b) => {
    r = toLinear(r);
    g = toLinear(g);
    b = toLinear(b);
    return {
      x: r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
      y: r * 0.2126729 + g * 0.7151522 + b * 0.072175,
      z: r * 0.0193339 + g * 0.119192 + b * 0.9503041,
    };
  };

  // Convert XYZ to LAB
  const toLAB = (xyz) => {
    const f = (t) => {
      const delta = 6 / 29;
      if (t > delta ** 3) {
        return Math.pow(t, 1 / 3);
      }
      return t / (3 * delta ** 2) + 4 / 29;
    };

    const xn = 0.95047;
    const yn = 1.0;
    const zn = 1.08883;

    const fx = f(xyz.x / xn);
    const fy = f(xyz.y / yn);
    const fz = f(xyz.z / zn);

    return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
    };
  };

  const lab1 = toLAB(toXYZ(r1, g1, b1));
  const lab2 = toLAB(toXYZ(r2, g2, b2));

  // CIE76 distance formula
  const dl = lab1.l - lab2.l;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;

  return Math.sqrt(dl * dl + da * da + db * db);
}

// Simplified perceptual distance (faster approximation)
// Uses weighted RGB distance that approximates perceptual difference
function perceptualDistance(r1, g1, b1, r2, g2, b2) {
  // Weights based on human eye sensitivity (green is more noticeable)
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  // Approximate perceptual weights: R=0.3, G=0.59, B=0.11 (luminance weights)
  return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);
}

// Median Cut algorithm for adaptive palette generation
// Recursively splits color space based on the longest dimension
function medianCutQuantize(data, maxColors) {
  // Collect all unique colors from the image
  const colorMap = new Map();
  const colors = [];

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // Skip transparent pixels

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = (r << 16) | (g << 8) | b;

    if (!colorMap.has(key)) {
      colorMap.set(key, { r, g, b, count: 0 });
      colors.push(colorMap.get(key));
    }
    colorMap.get(key).count++;
  }

  if (colors.length === 0) {
    // No colors found, return default palette
    const defaultPalette = [];
    for (let i = 0; i < maxColors; i++) {
      defaultPalette.push({ r: 0, g: 0, b: 0 });
    }
    return defaultPalette;
  }

  // If we have fewer colors than needed, use Median Cut to create a proper palette
  // This ensures 4-bit and 8-bit produce different results even for simple images
  // by creating intermediate colors through averaging

  // Recursively split color space
  // We need maxColors-1 boxes (one slot reserved for black/transparent)
  const boxes = [
    { colors, rMin: 0, rMax: 255, gMin: 0, gMax: 255, bMin: 0, bMax: 255 },
  ];

  while (boxes.length < maxColors - 1) {
    // Find the box with the largest volume that can be split
    let largestBoxIndex = -1;
    let largestVolume = 0;

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.colors.length <= 1) continue;

      const rRange = box.rMax - box.rMin;
      const gRange = box.gMax - box.gMin;
      const bRange = box.bMax - box.bMin;
      const volume = rRange * gRange * bRange;

      if (volume > largestVolume) {
        largestVolume = volume;
        largestBoxIndex = i;
      }
    }

    // If no box can be split, we need to create more colors by subdividing existing boxes
    // This happens when we have fewer unique colors than needed palette size
    if (largestBoxIndex === -1) {
      // Try to force-split boxes even if they have only 1 color by using bounds
      // This creates intermediate colors through interpolation
      let foundSplittable = false;
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        const rRange = box.rMax - box.rMin;
        const gRange = box.gMax - box.gMin;
        const bRange = box.bMax - box.bMin;

        // If box has any range, we can split it even with 1 color
        if (rRange > 1 || gRange > 1 || bRange > 1) {
          largestBoxIndex = i;
          foundSplittable = true;
          break;
        }
      }

      if (!foundSplittable) {
        // All boxes are single pixels with no range - can't split further
        // Fill remaining slots by duplicating (they'll be averaged to same color, but that's OK)
        const existingBoxes = boxes.length;
        while (boxes.length < maxColors - 1) {
          const sourceBox = boxes[boxes.length % existingBoxes];
          boxes.push({
            colors: [...sourceBox.colors],
            rMin: sourceBox.rMin,
            rMax: sourceBox.rMax,
            gMin: sourceBox.gMin,
            gMax: sourceBox.gMax,
            bMin: sourceBox.bMin,
            bMax: sourceBox.bMax,
          });
        }
        break;
      }
    }

    const box = boxes[largestBoxIndex];

    // Find the longest dimension
    const rRange = box.rMax - box.rMin;
    const gRange = box.gMax - box.gMin;
    const bRange = box.bMax - box.bMin;

    let sortBy;
    if (rRange >= gRange && rRange >= bRange) {
      sortBy = "r";
    } else if (gRange >= bRange) {
      sortBy = "g";
    } else {
      sortBy = "b";
    }

    let leftColors, rightColors;

    if (box.colors.length <= 1) {
      // Box has 1 color but has a range - split by midpoint of the range
      // This creates intermediate colors
      // Note: box.colors should never be empty here due to earlier filtering
      const midpoint = Math.floor(
        (box[sortBy + "Min"] + box[sortBy + "Max"]) / 2
      );
      const color = box.colors[0];

      if (sortBy === "r") {
        leftColors = color.r <= midpoint ? [color] : [];
        rightColors = color.r > midpoint ? [color] : [];
      } else if (sortBy === "g") {
        leftColors = color.g <= midpoint ? [color] : [];
        rightColors = color.g > midpoint ? [color] : [];
      } else {
        leftColors = color.b <= midpoint ? [color] : [];
        rightColors = color.b > midpoint ? [color] : [];
      }

      // If both sides are empty or both have the color, create artificial split
      if (leftColors.length === 0 && rightColors.length === 0) {
        leftColors = [color];
        rightColors = [color];
      } else if (leftColors.length > 0 && rightColors.length === 0) {
        rightColors = [color];
      } else if (leftColors.length === 0 && rightColors.length > 0) {
        leftColors = [color];
      }
    } else {
      // Normal case: sort colors and split by median
      box.colors.sort((a, b) => {
        if (sortBy === "r") return a.r - b.r;
        if (sortBy === "g") return a.g - b.g;
        return a.b - b.b;
      });

      // Find median (weighted by count)
      let totalCount = 0;
      for (const color of box.colors) {
        totalCount += color.count;
      }

      let medianCount = 0;
      let medianIndex = 0;
      for (let i = 0; i < box.colors.length; i++) {
        medianCount += box.colors[i].count;
        if (medianCount >= totalCount / 2) {
          medianIndex = i;
          break;
        }
      }

      // Split the box
      leftColors = box.colors.slice(0, medianIndex + 1);
      rightColors = box.colors.slice(medianIndex + 1);
    }

    // Calculate new bounds
    const leftBox = {
      colors: leftColors,
      rMin: box.rMin,
      rMax: box.rMax,
      gMin: box.gMin,
      gMax: box.gMax,
      bMin: box.bMin,
      bMax: box.bMax,
    };

    const rightBox = {
      colors: rightColors,
      rMin: box.rMin,
      rMax: box.rMax,
      gMin: box.gMin,
      gMax: box.gMax,
      bMin: box.bMin,
      bMax: box.bMax,
    };

    // Update bounds based on actual colors
    // Only update if arrays are not empty - if empty, keep original bounds
    if (sortBy === "r") {
      if (leftColors.length > 0) {
        leftBox.rMax = leftColors[leftColors.length - 1].r;
      }
      if (rightColors.length > 0) {
        rightBox.rMin = rightColors[0].r;
      }
    } else if (sortBy === "g") {
      if (leftColors.length > 0) {
        leftBox.gMax = leftColors[leftColors.length - 1].g;
      }
      if (rightColors.length > 0) {
        rightBox.gMin = rightColors[0].g;
      }
    } else {
      if (leftColors.length > 0) {
        leftBox.bMax = leftColors[leftColors.length - 1].b;
      }
      if (rightColors.length > 0) {
        rightBox.bMin = rightColors[0].b;
      }
    }

    // Replace the original box with the two new boxes
    boxes.splice(largestBoxIndex, 1, leftBox, rightBox);
  }

  // Calculate average color for each box
  const palette = [];
  // Reserve index 0 for black (transparent pixels)
  palette.push({ r: 0, g: 0, b: 0 });

  for (const box of boxes) {
    if (palette.length >= maxColors) break;

    if (box.colors.length === 0) {
      if (palette.length < maxColors) {
        palette.push({ r: 0, g: 0, b: 0 });
      }
      continue;
    }

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let totalCount = 0;

    for (const color of box.colors) {
      totalR += color.r * color.count;
      totalG += color.g * color.count;
      totalB += color.b * color.count;
      totalCount += color.count;
    }

    const avgColor = {
      r: Math.round(totalR / totalCount),
      g: Math.round(totalG / totalCount),
      b: Math.round(totalB / totalCount),
    };

    // Skip if it's black (already at index 0)
    if (avgColor.r === 0 && avgColor.g === 0 && avgColor.b === 0) {
      continue;
    }

    palette.push(avgColor);
  }

  // Fill remaining slots with black
  while (palette.length < maxColors) {
    palette.push({ r: 0, g: 0, b: 0 });
  }

  return palette.slice(0, maxColors);
}

// Apply Floyd-Steinberg dithering with palette quantization
// This is a general dithering function that works with any palette
function applyFloydSteinbergDithering(
  data,
  width,
  height,
  colorArray,
  findClosestColor
) {
  const ditheredData = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (ditheredData[i + 3] < 128) continue;

      const oldR = ditheredData[i];
      const oldG = ditheredData[i + 1];
      const oldB = ditheredData[i + 2];

      // Find closest palette color
      const colorIndex = findClosestColor(oldR, oldG, oldB);
      const paletteColor = colorArray[colorIndex];
      const newR = paletteColor.r;
      const newG = paletteColor.g;
      const newB = paletteColor.b;

      // Update pixel with palette color
      ditheredData[i] = newR;
      ditheredData[i + 1] = newG;
      ditheredData[i + 2] = newB;

      // Calculate quantization error
      const errR = oldR - newR;
      const errG = oldG - newG;
      const errB = oldB - newB;

      // Distribute error to neighboring pixels (Floyd-Steinberg weights)
      const distributeError = (x1, y1, weight) => {
        if (x1 >= 0 && x1 < width && y1 >= 0 && y1 < height) {
          const idx = (y1 * width + x1) * 4;
          if (ditheredData[idx + 3] >= 128) {
            ditheredData[idx] = Math.max(
              0,
              Math.min(255, ditheredData[idx] + errR * weight)
            );
            ditheredData[idx + 1] = Math.max(
              0,
              Math.min(255, ditheredData[idx + 1] + errG * weight)
            );
            ditheredData[idx + 2] = Math.max(
              0,
              Math.min(255, ditheredData[idx + 2] + errB * weight)
            );
          }
        }
      };

      // Floyd-Steinberg error distribution pattern
      distributeError(x + 1, y, 7 / 16); // Right
      distributeError(x - 1, y + 1, 3 / 16); // Bottom-left
      distributeError(x, y + 1, 5 / 16); // Bottom
      distributeError(x + 1, y + 1, 1 / 16); // Bottom-right
    }
  }

  return ditheredData;
}

// Apply Floyd-Steinberg dithering for 4-bit (backward compatibility)
function applyDithering4Bit(data, width, height) {
  // For backward compatibility, we'll use a simple quantization
  // This will be replaced when build4BitPalette is called with dithering
  const ditheredData = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (ditheredData[i + 3] < 128) continue;

      const oldR = ditheredData[i];
      const oldG = ditheredData[i + 1];
      const oldB = ditheredData[i + 2];

      const quantize = (val) => Math.round((val / 255) * 3) * 85;
      const newR = Math.max(0, Math.min(255, quantize(oldR)));
      const newG = Math.max(0, Math.min(255, quantize(oldG)));
      const newB = Math.max(0, Math.min(255, quantize(oldB)));

      ditheredData[i] = newR;
      ditheredData[i + 1] = newG;
      ditheredData[i + 2] = newB;

      const errR = oldR - newR;
      const errG = oldG - newG;
      const errB = oldB - newB;

      const distributeError = (x1, y1, weight) => {
        if (x1 >= 0 && x1 < width && y1 >= 0 && y1 < height) {
          const idx = (y1 * width + x1) * 4;
          if (ditheredData[idx + 3] >= 128) {
            ditheredData[idx] = Math.max(
              0,
              Math.min(255, ditheredData[idx] + errR * weight)
            );
            ditheredData[idx + 1] = Math.max(
              0,
              Math.min(255, ditheredData[idx + 1] + errG * weight)
            );
            ditheredData[idx + 2] = Math.max(
              0,
              Math.min(255, ditheredData[idx + 2] + errB * weight)
            );
          }
        }
      };

      distributeError(x + 1, y, 7 / 16);
      distributeError(x - 1, y + 1, 3 / 16);
      distributeError(x, y + 1, 5 / 16);
      distributeError(x + 1, y + 1, 1 / 16);
    }
  }

  return ditheredData;
}

// Build 8-bit palette and color matching function using Median Cut
function build8BitPalette(data) {
  // Use Median Cut algorithm to generate adaptive 256-color palette
  const colorArray = medianCutQuantize(data, 256);

  // Find closest color function using perceptual distance
  const findClosestColor = (r, g, b) => {
    let minDist = Infinity;
    let bestIndex = 0;

    for (let i = 0; i < colorArray.length; i++) {
      const pr = colorArray[i].r;
      const pg = colorArray[i].g;
      const pb = colorArray[i].b;
      // Use perceptual distance for better color matching
      const dist = perceptualDistance(r, g, b, pr, pg, pb);

      if (dist < minDist) {
        minDist = dist;
        bestIndex = i;
      }
    }

    return bestIndex;
  };

  return { colorArray, findClosestColor };
}

// Build 4-bit palette and color matching function using Median Cut
function build4BitPalette(data) {
  // Use Median Cut algorithm to generate adaptive 16-color palette
  const colorArray = medianCutQuantize(data, 16);

  // Find closest color function using perceptual distance
  const findClosestColor = (r, g, b) => {
    let minDist = Infinity;
    let bestIndex = 0;

    for (let i = 0; i < colorArray.length; i++) {
      const pr = colorArray[i].r;
      const pg = colorArray[i].g;
      const pb = colorArray[i].b;
      // Use perceptual distance for better color matching
      const dist = perceptualDistance(r, g, b, pr, pg, pb);

      if (dist < minDist) {
        minDist = dist;
        bestIndex = i;
      }
    }

    return bestIndex;
  };

  return { colorArray, findClosestColor };
}

// Convert ImageData to quantized ImageData using palette
function quantizeImageData(imageData, colorArray, findClosestColor) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const quantizedData = new ImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      if (data[i + 3] < 128) {
        quantizedData.data[i] = 0;
        quantizedData.data[i + 1] = 0;
        quantizedData.data[i + 2] = 0;
        quantizedData.data[i + 3] = data[i + 3];
      } else {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const colorIndex = findClosestColor(r, g, b);
        const color = colorArray[colorIndex];

        quantizedData.data[i] = color.r;
        quantizedData.data[i + 1] = color.g;
        quantizedData.data[i + 2] = color.b;
        quantizedData.data[i + 3] = data[i + 3];
      }
    }
  }

  return quantizedData;
}

// Export shared helpers for use in preview.js
export {
  build8BitPalette,
  build4BitPalette,
  quantizeImageData,
  applyDithering4Bit,
  applyFloydSteinbergDithering,
};

export function encodeBMP(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // BMP rows must be padded to multiples of 4 bytes
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize; // 54 = header size

  // Create buffer for BMP file
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // BMP File Header (14 bytes)
  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4d); // 'M'
  view.setUint32(2, fileSize, true); // File size
  view.setUint32(6, 0, true); // Reserved
  view.setUint32(10, 54, true); // Pixel data offset

  // DIB Header - BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true); // DIB header size
  view.setInt32(18, width, true); // Width
  view.setInt32(22, -height, true); // Height (negative = top-down)
  view.setUint16(26, 1, true); // Planes
  view.setUint16(28, 24, true); // Bits per pixel (24-bit)
  view.setUint32(30, 0, true); // Compression (0 = BI_RGB, no compression)
  view.setUint32(34, pixelArraySize, true); // Image size
  view.setInt32(38, 2835, true); // X pixels per meter (~72 DPI)
  view.setInt32(42, 2835, true); // Y pixels per meter (~72 DPI)
  view.setUint32(46, 0, true); // Colors in palette (0 = default)
  view.setUint32(50, 0, true); // Important colors (0 = all)

  // Pixel data (BGR format with row padding)
  let offset = 54;
  const padding = rowSize - width * 3;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // BMP uses BGR order instead of RGB
      view.setUint8(offset++, data[i + 2]); // Blue
      view.setUint8(offset++, data[i + 1]); // Green
      view.setUint8(offset++, data[i]); // Red
      // Alpha channel is ignored in 24-bit BMP
    }
    // Add row padding (each row must be multiple of 4 bytes)
    for (let p = 0; p < padding; p++) {
      view.setUint8(offset++, 0);
    }
  }

  return new Blob([buffer], { type: "image/bmp" });
}

export function encodeBMP8Bit(imageData, dither = false) {
  const width = imageData.width;
  const height = imageData.height;
  let data = imageData.data;

  // Use shared palette building function
  const { colorArray, findClosestColor } = build8BitPalette(data);

  // Apply dithering if requested
  if (dither) {
    data = applyFloydSteinbergDithering(
      data,
      width,
      height,
      colorArray,
      findClosestColor
    );
    // Create new ImageData with dithered data
    const ditheredImageData = new ImageData(width, height);
    ditheredImageData.data.set(data);
    data = ditheredImageData.data;
  }

  // Create pixel index array
  const pixelIndices = new Uint8Array(width * height);

  // Assign pixel indices
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) {
        pixelIndices[y * width + x] = 0; // Transparent -> use first palette entry
      } else {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        pixelIndices[y * width + x] = findClosestColor(r, g, b);
      }
    }
  }

  // Calculate sizes
  const paletteSize = 256 * 4; // 256 colors * 4 bytes each (BGR + reserved)
  const rowSize = Math.floor((8 * width + 31) / 32) * 4; // 8-bit, padded to 4 bytes
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + paletteSize + pixelArraySize; // Header + palette + pixels

  // Create buffer
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // BMP File Header (14 bytes)
  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4d); // 'M'
  view.setUint32(2, fileSize, true); // File size
  view.setUint32(6, 0, true); // Reserved
  view.setUint32(10, 54 + paletteSize, true); // Pixel data offset (after header + palette)

  // DIB Header - BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true); // DIB header size
  view.setInt32(18, width, true); // Width
  view.setInt32(22, -height, true); // Height (negative = top-down)
  view.setUint16(26, 1, true); // Planes
  view.setUint16(28, 8, true); // Bits per pixel (8-bit)
  view.setUint32(30, 0, true); // Compression (0 = BI_RGB)
  view.setUint32(34, pixelArraySize, true); // Image size
  view.setInt32(38, 2835, true); // X pixels per meter
  view.setInt32(42, 2835, true); // Y pixels per meter
  view.setUint32(46, 256, true); // Colors in palette
  view.setUint32(50, 256, true); // Important colors

  // Color palette (256 entries, BGR format + reserved byte)
  let offset = 54;
  for (let i = 0; i < 256; i++) {
    const color = colorArray[i] || { r: 0, g: 0, b: 0 };
    view.setUint8(offset++, color.b); // Blue
    view.setUint8(offset++, color.g); // Green
    view.setUint8(offset++, color.r); // Red
    view.setUint8(offset++, 0); // Reserved
  }

  // Pixel data (8-bit indices with row padding)
  const padding = rowSize - width;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      view.setUint8(offset++, pixelIndices[y * width + x]);
    }
    // Add row padding
    for (let p = 0; p < padding; p++) {
      view.setUint8(offset++, 0);
    }
  }

  return new Blob([buffer], { type: "image/bmp" });
}

export function encodeBMP4Bit(imageData, aggressive = false) {
  const width = imageData.width;
  const height = imageData.height;
  let processedData = imageData.data;

  // Build palette first
  const { colorArray, findClosestColor } = build4BitPalette(processedData);

  // Apply dithering if aggressive (using proper palette-based dithering)
  if (aggressive) {
    processedData = applyFloydSteinbergDithering(
      processedData,
      width,
      height,
      colorArray,
      findClosestColor
    );
    // Create new ImageData with dithered data
    const tempImageData = new ImageData(width, height);
    tempImageData.data.set(processedData);
    return encodeBMP4BitFromData(tempImageData, colorArray, findClosestColor);
  } else {
    return encodeBMP4BitFromData(imageData, colorArray, findClosestColor);
  }
}

function encodeBMP4BitFromData(imageData, colorArray, findClosestColor) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Use provided palette or build new one
  if (!colorArray || !findClosestColor) {
    const palette = build4BitPalette(data);
    colorArray = palette.colorArray;
    findClosestColor = palette.findClosestColor;
  }

  // Create pixel index array
  const pixelIndices = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) {
        pixelIndices[y * width + x] = 0;
      } else {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        pixelIndices[y * width + x] = findClosestColor(r, g, b);
      }
    }
  }

  // Calculate sizes for 4-bit BMP
  const paletteSize = 16 * 4; // 16 colors * 4 bytes each
  const rowSize = Math.floor((4 * width + 31) / 32) * 4; // 4-bit, padded to 4 bytes
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + paletteSize + pixelArraySize;

  // Create buffer
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // BMP File Header
  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4d); // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54 + paletteSize, true);

  // DIB Header
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 4, true); // 4 bits per pixel
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 16, true); // Colors in palette
  view.setUint32(50, 16, true);

  // Color palette (16 entries)
  let offset = 54;
  for (let i = 0; i < 16; i++) {
    const color = colorArray[i] || { r: 0, g: 0, b: 0 };
    view.setUint8(offset++, color.b);
    view.setUint8(offset++, color.g);
    view.setUint8(offset++, color.r);
    view.setUint8(offset++, 0); // Reserved
  }

  // Pixel data (4-bit packed: 2 pixels per byte)
  const padding = rowSize - Math.ceil(width / 2);
  for (let y = 0; y < height; y++) {
    let byteOffset = 0;
    for (let x = 0; x < width; x += 2) {
      const idx1 = pixelIndices[y * width + x];
      const idx2 = x + 1 < width ? pixelIndices[y * width + x + 1] : 0;
      const packed = (idx1 << 4) | idx2;
      view.setUint8(offset++, packed);
      byteOffset++;
    }
    // Add row padding
    for (let p = 0; p < padding; p++) {
      view.setUint8(offset++, 0);
    }
  }

  return new Blob([buffer], { type: "image/bmp" });
}
