const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const typedArrayTag = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  Symbol.toStringTag,
).get;
const isExactUint8Array = (value) => ArrayBuffer.isView(value)
  && typedArrayTag.call(value) === 'Uint8Array';

const concat = (...arrays) => {
  const output = new Uint8Array(arrays.reduce((sum, array) => sum + array.length, 0));
  let offset = 0;
  for (const array of arrays) { output.set(array, offset); offset += array.length; }
  return output;
};

const uint32 = (value) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0);
  return bytes;
};

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const adler32 = (bytes) => {
  let first = 1;
  let second = 0;
  for (const byte of bytes) { first = (first + byte) % 65521; second = (second + first) % 65521; }
  return ((second << 16) | first) >>> 0;
};

const chunk = (type, data) => {
  const typeBytes = encoder.encode(type);
  return concat(uint32(data.length), typeBytes, data, uint32(crc32(concat(typeBytes, data))));
};

const zlibStore = (bytes) => {
  const blocks = [];
  for (let offset = 0; offset < bytes.length; offset += 65535) {
    const length = Math.min(65535, bytes.length - offset);
    const header = new Uint8Array(5);
    header[0] = offset + length === bytes.length ? 1 : 0;
    header[1] = length & 0xff;
    header[2] = length >>> 8;
    const inverse = (~length) & 0xffff;
    header[3] = inverse & 0xff;
    header[4] = inverse >>> 8;
    blocks.push(header, bytes.slice(offset, offset + length));
  }
  return concat(new Uint8Array([0x78, 0x01]), ...blocks, uint32(adler32(bytes)));
};

export function encodePngRgba(width, height, rgba) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new TypeError('PNG dimensions must be positive integers');
  if (!isExactUint8Array(rgba) || rgba.length !== width * height * 4) throw new TypeError('PNG RGBA byte length does not match dimensions');
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8);
  const scanlines = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) scanlines.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return concat(SIGNATURE, chunk('IHDR', header), chunk('IDAT', zlibStore(scanlines)), chunk('IEND', new Uint8Array()));
}

const parseChunks = (png) => {
  if (!isExactUint8Array(png) || SIGNATURE.some((byte, index) => png[index] !== byte)) throw new TypeError('Invalid PNG signature');
  const chunks = [];
  let offset = SIGNATURE.length;
  while (offset < png.length) {
    if (offset + 12 > png.length) throw new TypeError('Truncated PNG chunk');
    const length = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0);
    const end = offset + 12 + length;
    if (end > png.length) throw new TypeError('Truncated PNG data');
    const typeBytes = png.slice(offset + 4, offset + 8);
    const type = decoder.decode(typeBytes);
    const data = png.slice(offset + 8, offset + 8 + length);
    const expected = new DataView(png.buffer, png.byteOffset + offset + 8 + length, 4).getUint32(0);
    if (crc32(concat(typeBytes, data)) !== expected) throw new TypeError(`Invalid PNG CRC for ${type}`);
    chunks.push({ type, data });
    offset = end;
  }
  return chunks;
};

export const inspectPngChunks = (png) => parseChunks(png).map(({ type }) => type);

const inflateStored = (zlib) => {
  if (zlib.length < 11 || zlib[0] !== 0x78 || zlib[1] !== 0x01) {
    throw new TypeError('Stored PNG zlib header must be exactly 0x78 0x01');
  }
  const output = [];
  let offset = 2;
  let final = false;
  while (!final) {
    const header = zlib[offset++];
    final = (header & 1) === 1;
    if ((header & 0x06) !== 0) throw new TypeError('Only stored DEFLATE blocks are supported');
    const length = zlib[offset] | (zlib[offset + 1] << 8);
    const inverse = zlib[offset + 2] | (zlib[offset + 3] << 8);
    offset += 4;
    if (((~length) & 0xffff) !== inverse || offset + length > zlib.length - 4) throw new TypeError('Invalid stored DEFLATE block');
    output.push(zlib.slice(offset, offset + length));
    offset += length;
  }
  if (offset !== zlib.length - 4) throw new TypeError('Trailing bytes after final DEFLATE block before Adler-32');
  const bytes = concat(...output);
  const expected = new DataView(zlib.buffer, zlib.byteOffset + zlib.length - 4, 4).getUint32(0);
  if (adler32(bytes) !== expected) throw new TypeError('Invalid zlib checksum');
  return bytes;
};

export function decodePngRgba(png) {
  const chunks = parseChunks(png);
  const chunkTypes = chunks.map(({ type }) => type);
  if (chunkTypes.length !== 3 || chunkTypes[0] !== 'IHDR' || chunkTypes[1] !== 'IDAT' || chunkTypes[2] !== 'IEND') {
    throw new TypeError('PNG chunks must be exactly one each in IHDR, IDAT, IEND order');
  }
  if (chunks[2].data.length !== 0) throw new TypeError('PNG IEND must have zero length');
  const header = chunks.find(({ type }) => type === 'IHDR')?.data;
  if (!header
    || header.length !== 13
    || header[8] !== 8
    || header[9] !== 6
    || header[10] !== 0
    || header[11] !== 0
    || header[12] !== 0) {
    throw new TypeError('PNG IHDR must be non-interlaced 8-bit RGBA with compression and filter methods zero');
  }
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const width = view.getUint32(0); const height = view.getUint32(4);
  const compressed = concat(...chunks.filter(({ type }) => type === 'IDAT').map(({ data }) => data));
  const scanlines = inflateStored(compressed);
  if (scanlines.length !== height * (width * 4 + 1)) throw new TypeError('PNG scanline length mismatch');
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const source = y * (width * 4 + 1);
    if (scanlines[source] !== 0) throw new TypeError('Only PNG filter 0 is supported');
    rgba.set(scanlines.subarray(source + 1, source + 1 + width * 4), y * width * 4);
  }
  return { width, height, rgba };
}
