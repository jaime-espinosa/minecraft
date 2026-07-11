import { canonicalJson } from './canonical-json.js';

const resolveSubtle = (subtle) => {
  const resolved = subtle ?? globalThis.crypto?.subtle;
  if (!resolved || typeof resolved.digest !== 'function') {
    throw new TypeError('A Web Crypto subtle implementation is required');
  }
  return resolved;
};

const arrayBufferByteLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const typedArrayTag = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  Symbol.toStringTag,
).get;
const isExactUint8Array = (value) => ArrayBuffer.isView(value)
  && typedArrayTag.call(value) === 'Uint8Array';
const isArrayBuffer = (value) => {
  try {
    arrayBufferByteLength.call(value);
    return true;
  } catch {
    return false;
  }
};

const toBytes = (value) => {
  if (isExactUint8Array(value)) return value;
  if (isArrayBuffer(value)) return new Uint8Array(value);
  throw new TypeError('Digest input must be a Uint8Array or ArrayBuffer');
};

export async function digestBytes(bytes, subtle) {
  const digest = await resolveSubtle(subtle).digest('SHA-256', toBytes(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function digestCanonicalJson(value, subtle) {
  return digestBytes(new TextEncoder().encode(canonicalJson(value)), subtle);
}
