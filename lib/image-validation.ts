export function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30 || bytes.length > 8 * 1024 * 1024)
    throw Error("Image must be smaller than 8 MB");
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    text(0, 4) !== "RIFF" ||
    text(8, 4) !== "WEBP" ||
    view.getUint32(4, true) + 8 !== bytes.length
  )
    throw Error("Invalid WebP image");
  let width = 0,
    height = 0;
  const format = text(12, 4);
  if (format === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 1 || bytes[25] !== 0x2a)
      throw Error("Invalid image");
    width = view.getUint16(26, true) & 0x3fff;
    height = view.getUint16(28, true) & 0x3fff;
  } else if (format === "VP8L") {
    if (bytes[20] !== 0x2f) throw Error("Invalid image");
    const bits = view.getUint32(21, true);
    width = (bits & 0x3fff) + 1;
    height = ((bits >>> 14) & 0x3fff) + 1;
  } else if (format === "VP8X") {
    if (bytes[20] & 2) throw Error("Animated images are not supported");
    width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
  } else throw Error("Unsupported image");
  if (
    width < 1 ||
    height < 1 ||
    width > 6000 ||
    height > 6000 ||
    width * height > 24000000
  )
    throw Error("Image dimensions exceed limits");
  return { width, height };
}
export function originalFormat(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes.length > 20 * 1024 * 1024)
    throw Error("Original image is outside the permitted size");
  const starts = (...values: number[]) =>
    values.every((value, i) => bytes[i] === value);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return "image/png";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  throw Error("Original must be JPEG, PNG, or WebP");
}
