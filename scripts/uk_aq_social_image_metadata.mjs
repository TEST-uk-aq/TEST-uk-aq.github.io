// Shared byte-based social-image inspection; no network or HTML processing.

export function detectSupportedImage(input, { allowWebp = false } = {}) {
  const bytes = Buffer.from(input);
  let image;
  if (
    bytes.length >= 24
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    && bytes.toString("ascii", 12, 16) === "IHDR"
  ) {
    image = { extension: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    image = readJpegDimensions(bytes);
  } else if (allowWebp && bytes.length >= 30 && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP") {
    image = readWebpDimensions(bytes);
  } else {
    throw new Error("bytes are not a supported social image");
  }

  if (
    !Number.isInteger(image.width)
    || !Number.isInteger(image.height)
    || image.width < 1
    || image.height < 1
    || image.width > 12_000
    || image.height > 12_000
  ) {
    throw new Error("image dimensions are invalid or exceed the safety limit");
  }
  return { ...image, type: image.extension === "jpg" ? "image/jpeg" : `image/${image.extension}` };
}

function readJpegDimensions(bytes) {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > bytes.length) break;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (segmentLength < 7) break;
      return {
        extension: "jpg",
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new Error("JPEG dimensions could not be validated");
}

function readWebpDimensions(bytes) {
  const kind = bytes.toString("ascii", 12, 16);
  if (kind === "VP8X") {
    return { extension: "webp", width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (kind === "VP8L" && bytes[20] === 0x2f) {
    const bits = bytes.readUInt32LE(21);
    return { extension: "webp", width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
  }
  if (kind === "VP8 " && bytes.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
    return { extension: "webp", width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  throw new Error("WebP dimensions could not be validated");
}
