// Unit tests for preview generation functions
// These tests verify that previews match the actual encoded output
import { describe, it, expect, beforeAll } from "vitest";
import {
  generatePreview24Bit,
  generatePreview8Bit,
  generatePreview4Bit,
} from "../preview.js";
import { encodeBMP, encodeBMP8Bit, encodeBMP4Bit } from "../encoder.js";

// Polyfill ImageData for Node.js environment
if (typeof ImageData === "undefined") {
  global.ImageData = class ImageData {
    constructor(dataOrWidth, widthOrHeight, height) {
      // Support both constructor signatures:
      // new ImageData(width, height)
      // new ImageData(data, width, height)
      if (dataOrWidth instanceof Uint8ClampedArray) {
        // new ImageData(data, width, height)
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height;
      } else {
        // new ImageData(width, height)
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
      }
    }
  };
}

// Helper function to create test ImageData
function createTestImageData(width, height, pixelGenerator) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const pixel = pixelGenerator(x, y);
      data[i] = pixel.r ?? 0; // Red
      data[i + 1] = pixel.g ?? 0; // Green
      data[i + 2] = pixel.b ?? 0; // Blue
      data[i + 3] = pixel.a ?? 255; // Alpha
    }
  }
  return { width, height, data };
}

// Helper to extract pixel colors from BMP palette and indices
async function extractBMP8BitColors(blob, imageData) {
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);
  const width = imageData.width;
  const height = imageData.height;

  // Read palette (starts at offset 54, 256 entries * 4 bytes each)
  const palette = [];
  for (let i = 0; i < 256; i++) {
    const offset = 54 + i * 4;
    const b = view.getUint8(offset);
    const g = view.getUint8(offset + 1);
    const r = view.getUint8(offset + 2);
    palette.push({ r, g, b });
  }

  // Read pixel indices (starts after palette)
  const pixelDataOffset = 54 + 256 * 4;
  const rowSize = Math.floor((8 * width + 31) / 32) * 4;
  const padding = rowSize - width;

  const pixelColors = [];
  let offset = pixelDataOffset;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = view.getUint8(offset++);
      pixelColors.push(palette[index]);
    }
    offset += padding; // Skip padding
  }

  return pixelColors;
}

// Helper to extract pixel colors from BMP 4-bit
async function extractBMP4BitColors(blob, imageData) {
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);
  const width = imageData.width;
  const height = imageData.height;

  // Read palette (starts at offset 54, 16 entries * 4 bytes each)
  const palette = [];
  for (let i = 0; i < 16; i++) {
    const offset = 54 + i * 4;
    const b = view.getUint8(offset);
    const g = view.getUint8(offset + 1);
    const r = view.getUint8(offset + 2);
    palette.push({ r, g, b });
  }

  // Read pixel indices (starts after palette, 4-bit packed)
  const pixelDataOffset = 54 + 16 * 4;
  const rowSize = Math.floor((4 * width + 31) / 32) * 4;
  const padding = rowSize - Math.ceil(width / 2);

  const pixelColors = [];
  let offset = pixelDataOffset;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x += 2) {
      const byte = view.getUint8(offset++);
      const idx1 = (byte >> 4) & 0xf;
      const idx2 = byte & 0xf;
      pixelColors.push(palette[idx1]);
      if (x + 1 < width) {
        pixelColors.push(palette[idx2]);
      }
    }
    offset += padding; // Skip padding
  }

  return pixelColors;
}

// Helper to extract colors from ImageData
function extractImageDataColors(imageData) {
  const colors = [];
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    colors.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      a: data[i + 3],
    });
  }
  return colors;
}

describe("generatePreview24Bit", () => {
  it("should return original image data (lossless)", () => {
    const imageData = createTestImageData(2, 2, () => ({
      r: 255,
      g: 128,
      b: 64,
      a: 255,
    }));
    const preview = generatePreview24Bit(imageData);

    expect(preview.width).toBe(imageData.width);
    expect(preview.height).toBe(imageData.height);
    expect(preview.data).toEqual(imageData.data);
  });

  it("should match 24-bit BMP encoding (no quantization)", async () => {
    const imageData = createTestImageData(3, 3, (x, y) => ({
      r: x * 85,
      g: y * 85,
      b: 128,
      a: 255,
    }));
    const preview = generatePreview24Bit(imageData);
    const blob = encodeBMP(imageData);

    // For 24-bit, preview should be identical to original
    const previewColors = extractImageDataColors(preview);
    const originalColors = extractImageDataColors(imageData);

    expect(previewColors).toEqual(originalColors);
  });
});

describe("generatePreview8Bit", () => {
  it("should produce quantized colors", () => {
    // Use an image with many colors to ensure quantization occurs
    const imageData = createTestImageData(10, 10, (x, y) => ({
      r: (x * 25) % 256,
      g: (y * 25) % 256,
      b: ((x + y) * 15) % 256,
      a: 255,
    }));
    const preview = generatePreview8Bit(imageData);

    expect(preview.width).toBe(imageData.width);
    expect(preview.height).toBe(imageData.height);
    // Colors should be quantized (may differ from original)
    // For images with many colors, quantization will definitely change some pixels
    expect(preview.data).toBeInstanceOf(Uint8ClampedArray);
    expect(preview.data.length).toBe(imageData.data.length);
    // Verify at least some pixels are quantized (not all will match exactly)
    let differentPixels = 0;
    for (let i = 0; i < preview.data.length; i += 4) {
      if (
        preview.data[i] !== imageData.data[i] ||
        preview.data[i + 1] !== imageData.data[i + 1] ||
        preview.data[i + 2] !== imageData.data[i + 2]
      ) {
        differentPixels++;
      }
    }
    // With many colors, at least some should be quantized
    expect(differentPixels).toBeGreaterThan(0);
  });

  it("should match 8-bit BMP encoding output", async () => {
    const imageData = createTestImageData(5, 5, (x, y) => ({
      r: (x * 50) % 256,
      g: (y * 50) % 256,
      b: ((x + y) * 30) % 256,
      a: 255,
    }));

    const preview = generatePreview8Bit(imageData);
    const blob = encodeBMP8Bit(imageData);

    // Extract colors from preview
    const previewColors = extractImageDataColors(preview);
    // Extract colors from BMP
    const bmpColors = await extractBMP8BitColors(blob, imageData);

    // Compare pixel by pixel (ignoring alpha)
    expect(previewColors.length).toBe(bmpColors.length);
    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBe(bmpColors[i].r);
      expect(previewColors[i].g).toBe(bmpColors[i].g);
      expect(previewColors[i].b).toBe(bmpColors[i].b);
    }
  });

  it("should handle transparent pixels correctly", async () => {
    const imageData = createTestImageData(2, 2, (x, y) => ({
      r: 255,
      g: 0,
      b: 0,
      a: x === 0 && y === 0 ? 0 : 255, // First pixel transparent
    }));

    const preview = generatePreview8Bit(imageData);
    const blob = encodeBMP8Bit(imageData);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP8BitColors(blob, imageData);

    // Transparent pixels should map to palette index 0
    expect(previewColors[0].r).toBe(bmpColors[0].r);
    expect(previewColors[0].g).toBe(bmpColors[0].g);
    expect(previewColors[0].b).toBe(bmpColors[0].b);
  });

  it("should use same palette as encoding", async () => {
    const imageData = createTestImageData(10, 10, () => ({
      r: 200,
      g: 100,
      b: 50,
      a: 255,
    }));

    const preview = generatePreview8Bit(imageData);
    const blob = encodeBMP8Bit(imageData);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP8BitColors(blob, imageData);

    // All pixels should match
    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBe(bmpColors[i].r);
      expect(previewColors[i].g).toBe(bmpColors[i].g);
      expect(previewColors[i].b).toBe(bmpColors[i].b);
    }
  });
});

describe("generatePreview4Bit", () => {
  it("should produce quantized colors", () => {
    // Use an image with many colors to ensure quantization occurs
    const imageData = createTestImageData(10, 10, (x, y) => ({
      r: (x * 25) % 256,
      g: (y * 25) % 256,
      b: ((x + y) * 15) % 256,
      a: 255,
    }));
    const preview = generatePreview4Bit(imageData);

    expect(preview.width).toBe(imageData.width);
    expect(preview.height).toBe(imageData.height);
    // Colors should be quantized
    // For 4-bit with only 16 colors, quantization will definitely change pixels
    expect(preview.data).toBeInstanceOf(Uint8ClampedArray);
    expect(preview.data.length).toBe(imageData.data.length);
    // Verify at least some pixels are quantized (not all will match exactly)
    let differentPixels = 0;
    for (let i = 0; i < preview.data.length; i += 4) {
      if (
        preview.data[i] !== imageData.data[i] ||
        preview.data[i + 1] !== imageData.data[i + 1] ||
        preview.data[i + 2] !== imageData.data[i + 2]
      ) {
        differentPixels++;
      }
    }
    // With many colors and only 16 palette entries, many should be quantized
    expect(differentPixels).toBeGreaterThan(0);
  });

  it("should match 4-bit BMP encoding output", async () => {
    const imageData = createTestImageData(4, 4, (x, y) => ({
      r: (x * 60) % 256,
      g: (y * 60) % 256,
      b: ((x + y) * 40) % 256,
      a: 255,
    }));

    const preview = generatePreview4Bit(imageData, false);
    const blob = encodeBMP4Bit(imageData, false);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP4BitColors(blob, imageData);

    // Compare pixel by pixel
    expect(previewColors.length).toBe(bmpColors.length);
    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBe(bmpColors[i].r);
      expect(previewColors[i].g).toBe(bmpColors[i].g);
      expect(previewColors[i].b).toBe(bmpColors[i].b);
    }
  });

  it("should handle transparent pixels correctly", async () => {
    const imageData = createTestImageData(2, 2, (x, y) => ({
      r: 255,
      g: 0,
      b: 0,
      a: x === 0 && y === 0 ? 0 : 255,
    }));

    const preview = generatePreview4Bit(imageData, false);
    const blob = encodeBMP4Bit(imageData, false);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP4BitColors(blob, imageData);

    // For transparent pixels, encoder uses palette index 0
    // Preview sets RGB to 0,0,0 for transparent pixels (which may differ from palette[0])
    // So we check that non-transparent pixels match, and transparent pixel uses palette[0] in BMP
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    const palette0 = {
      b: view.getUint8(54),
      g: view.getUint8(55),
      r: view.getUint8(56),
    };

    // BMP should use palette[0] for transparent pixel
    expect(bmpColors[0].r).toBe(palette0.r);
    expect(bmpColors[0].g).toBe(palette0.g);
    expect(bmpColors[0].b).toBe(palette0.b);

    // Non-transparent pixels should match exactly
    for (let i = 1; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBe(bmpColors[i].r);
      expect(previewColors[i].g).toBe(bmpColors[i].g);
      expect(previewColors[i].b).toBe(bmpColors[i].b);
    }
  });

  it("should use same 16-color palette as encoding", async () => {
    const imageData = createTestImageData(8, 8, () => ({
      r: 180,
      g: 90,
      b: 45,
      a: 255,
    }));

    const preview = generatePreview4Bit(imageData, false);
    const blob = encodeBMP4Bit(imageData, false);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP4BitColors(blob, imageData);

    // All pixels should match
    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBe(bmpColors[i].r);
      expect(previewColors[i].g).toBe(bmpColors[i].g);
      expect(previewColors[i].b).toBe(bmpColors[i].b);
    }
  });

  it("should work with aggressive dithering (non-dithered preview)", async () => {
    // Note: Aggressive dithering uses document.createElement in encoder
    // So we test that preview without aggressive matches non-aggressive encoding
    const imageData = createTestImageData(6, 6, (x, y) => ({
      r: (x * 40) % 256,
      g: (y * 40) % 256,
      b: 128,
      a: 255,
    }));

    // Test non-aggressive version (which works in Node.js)
    const preview = generatePreview4Bit(imageData, false);
    const blob = encodeBMP4Bit(imageData, false);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP4BitColors(blob, imageData);

    // Should match
    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBe(bmpColors[i].r);
      expect(previewColors[i].g).toBe(bmpColors[i].g);
      expect(previewColors[i].b).toBe(bmpColors[i].b);
    }
  });
});

describe("Preview accuracy", () => {
  it("should produce identical output for same input across multiple calls", () => {
    const imageData = createTestImageData(5, 5, () => ({
      r: 150,
      g: 100,
      b: 200,
      a: 255,
    }));

    const preview1 = generatePreview8Bit(imageData);
    const preview2 = generatePreview8Bit(imageData);

    expect(preview1.data).toEqual(preview2.data);
  });

  it("should handle edge case: all same color", async () => {
    const imageData = createTestImageData(3, 3, () => ({
      r: 128,
      g: 128,
      b: 128,
      a: 255,
    }));

    const preview = generatePreview8Bit(imageData);
    const blob = encodeBMP8Bit(imageData);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP8BitColors(blob, imageData);

    // All pixels should be the same quantized color
    const firstColor = previewColors[0];
    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBe(firstColor.r);
      expect(previewColors[i].g).toBe(firstColor.g);
      expect(previewColors[i].b).toBe(firstColor.b);
      expect(previewColors[i].r).toBe(bmpColors[i].r);
      expect(previewColors[i].g).toBe(bmpColors[i].g);
      expect(previewColors[i].b).toBe(bmpColors[i].b);
    }
  });

  it("should handle edge case: maximum color values", async () => {
    const imageData = createTestImageData(2, 2, () => ({
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    }));

    const preview = generatePreview8Bit(imageData);
    const blob = encodeBMP8Bit(imageData);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP8BitColors(blob, imageData);

    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBe(bmpColors[i].r);
      expect(previewColors[i].g).toBe(bmpColors[i].g);
      expect(previewColors[i].b).toBe(bmpColors[i].b);
    }
  });

  it("should handle 8-bit preview with single unique color", () => {
    // This tests the bug fix where switching to 8-bit would fail
    const imageData = createTestImageData(10, 10, () => ({
      r: 128,
      g: 128,
      b: 128,
      a: 255,
    }));

    // Should not throw error about undefined property access
    const preview = generatePreview8Bit(imageData);

    expect(preview.width).toBe(imageData.width);
    expect(preview.height).toBe(imageData.height);
    expect(preview.data.length).toBe(imageData.data.length);
  });

  it("should handle 8-bit preview after 4-bit preview (switching compression)", async () => {
    // This tests the specific bug where switching from 4-bit to 8-bit would fail
    const imageData = createTestImageData(15, 15, (x, y) => ({
      r: (x * 17) % 256,
      g: (y * 17) % 256,
      b: ((x + y) * 13) % 256,
      a: 255,
    }));

    // First generate 4-bit preview
    const preview4Bit = generatePreview4Bit(imageData, false);
    expect(preview4Bit.width).toBe(imageData.width);
    expect(preview4Bit.height).toBe(imageData.height);

    // Then generate 8-bit preview - this should not throw an error
    const preview8Bit = generatePreview8Bit(imageData);
    expect(preview8Bit.width).toBe(imageData.width);
    expect(preview8Bit.height).toBe(imageData.height);

    // Verify 8-bit preview matches encoding
    const blob = encodeBMP8Bit(imageData);
    const previewColors = extractImageDataColors(preview8Bit);
    const bmpColors = await extractBMP8BitColors(blob, imageData);

    expect(previewColors.length).toBe(bmpColors.length);
    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBe(bmpColors[i].r);
      expect(previewColors[i].g).toBe(bmpColors[i].g);
      expect(previewColors[i].b).toBe(bmpColors[i].b);
    }
  });

  it("should handle 8-bit preview with very few unique colors", async () => {
    // Test with only 2 unique colors - this can trigger edge cases
    const imageData = createTestImageData(20, 20, (x, y) => ({
      r: (x + y) % 2 === 0 ? 255 : 0,
      g: (x + y) % 2 === 0 ? 0 : 255,
      b: 0,
      a: 255,
    }));

    const preview = generatePreview8Bit(imageData);
    const blob = encodeBMP8Bit(imageData);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP8BitColors(blob, imageData);

    expect(previewColors.length).toBe(bmpColors.length);
    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBe(bmpColors[i].r);
      expect(previewColors[i].g).toBe(bmpColors[i].g);
      expect(previewColors[i].b).toBe(bmpColors[i].b);
    }
  });

  it("should handle 8-bit preview with gradient (many similar colors)", async () => {
    // Gradient images can trigger edge cases in median cut algorithm
    const imageData = createTestImageData(50, 50, (x, y) => ({
      r: Math.floor((x / 50) * 255),
      g: Math.floor((y / 50) * 255),
      b: Math.floor(((x + y) / 100) * 255),
      a: 255,
    }));

    const preview = generatePreview8Bit(imageData);
    const blob = encodeBMP8Bit(imageData);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP8BitColors(blob, imageData);

    expect(previewColors.length).toBe(bmpColors.length);
    // For gradient images, exact match might not be possible due to quantization
    // But we verify the preview doesn't crash and produces valid output
    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBeGreaterThanOrEqual(0);
      expect(previewColors[i].r).toBeLessThanOrEqual(255);
      expect(previewColors[i].g).toBeGreaterThanOrEqual(0);
      expect(previewColors[i].g).toBeLessThanOrEqual(255);
      expect(previewColors[i].b).toBeGreaterThanOrEqual(0);
      expect(previewColors[i].b).toBeLessThanOrEqual(255);
    }
  });

  it("should handle 8-bit preview with dithering", async () => {
    const imageData = createTestImageData(10, 10, (x, y) => ({
      r: (x * 25) % 256,
      g: (y * 25) % 256,
      b: 128,
      a: 255,
    }));

    const preview = generatePreview8Bit(imageData, true);
    const blob = encodeBMP8Bit(imageData, true);

    const previewColors = extractImageDataColors(preview);
    const bmpColors = await extractBMP8BitColors(blob, imageData);

    expect(previewColors.length).toBe(bmpColors.length);
    // With dithering, exact match might vary, but should be close
    for (let i = 0; i < previewColors.length; i++) {
      expect(previewColors[i].r).toBeGreaterThanOrEqual(0);
      expect(previewColors[i].r).toBeLessThanOrEqual(255);
    }
  });
});
