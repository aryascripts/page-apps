// Preview generation functions - uses encoder's shared quantization logic
import {
  build8BitPalette,
  build4BitPalette,
  quantizeImageData,
  applyFloydSteinbergDithering,
} from "./encoder.js";

// Preview generation functions - return quantized ImageData for display
export function generatePreview24Bit(imageData) {
  // 24-bit is lossless, but return a copy to avoid reference issues
  return new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );
}

export function generatePreview8Bit(imageData, dither = false) {
  // Create a copy of the image data to avoid modifying the original
  const imageDataCopy = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  const { colorArray, findClosestColor } = build8BitPalette(imageDataCopy.data);

  let processedData = imageDataCopy.data;
  if (dither) {
    processedData = applyFloydSteinbergDithering(
      processedData,
      imageDataCopy.width,
      imageDataCopy.height,
      colorArray,
      findClosestColor
    );
    const ditheredImageData = new ImageData(
      imageDataCopy.width,
      imageDataCopy.height
    );
    ditheredImageData.data.set(processedData);
    return quantizeImageData(ditheredImageData, colorArray, findClosestColor);
  }

  return quantizeImageData(imageDataCopy, colorArray, findClosestColor);
}

export function generatePreview4Bit(imageData, aggressive = false) {
  // Create a copy of the image data to avoid modifying the original
  const imageDataCopy = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  const width = imageDataCopy.width;
  const height = imageDataCopy.height;
  let processedData = imageDataCopy.data;

  // Build palette first
  const { colorArray, findClosestColor } = build4BitPalette(processedData);

  // Apply dithering if aggressive
  if (aggressive) {
    processedData = applyFloydSteinbergDithering(
      processedData,
      width,
      height,
      colorArray,
      findClosestColor
    );
  }

  // Use processed data for quantization
  const processedImageData = new ImageData(width, height);
  processedImageData.data.set(processedData);

  return quantizeImageData(processedImageData, colorArray, findClosestColor);
}
