import { createPhotoNormalizer } from '../identity-library/photo-normalizer.js';

const hex = (bytes) => [...new Uint8Array(bytes)]
  .map((value) => value.toString(16).padStart(2, '0'))
  .join('');

export function createBrowserPhotoAdapter({
  repository,
  createImageBitmap: decodeBitmap = globalThis.createImageBitmap,
  createCanvas = (width, height) => Object.assign(document.createElement('canvas'), { width, height }),
  cryptoObject = globalThis.crypto,
  clock = () => new Date().toISOString(),
  createId = () => cryptoObject.randomUUID(),
}) {
  const release = (resource) => {
    if (ArrayBuffer.isView(resource)) {
      resource.fill(0);
      return;
    }
    if (typeof resource?.close === 'function') {
      resource.close();
      return;
    }
    if (typeof resource?.getContext === 'function') {
      resource.getContext('2d')?.clearRect(0, 0, resource.width, resource.height);
      resource.width = 0;
      resource.height = 0;
    }
  };

  const normalizerFor = (sourceMimeType) => createPhotoNormalizer({
    async decode(bytes) {
      const bitmap = await decodeBitmap(
        new Blob([bytes], { type: sourceMimeType }),
        { imageOrientation: 'from-image' },
      );
      return {
        width: bitmap.width,
        height: bitmap.height,
        hasAlpha: sourceMimeType === 'image/png',
        bitmap,
        close() { bitmap.close?.(); },
      };
    },
    async orient(decoded) { return decoded; },
    createCanvas,
    draw(canvas, oriented, { width, height }) {
      canvas.getContext('2d').drawImage(oriented.bitmap, 0, 0, width, height);
    },
    encode: (canvas, { mimeType, quality }) => new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas encoding failed.')),
        mimeType,
        quality,
      );
    }),
    async digest(blob) {
      return hex(await cryptoObject.subtle.digest('SHA-256', await blob.arrayBuffer()));
    },
    createId,
    clock,
    normalizationVersion: 'browser-v1',
    release,
    async stageNormalizedPhoto(envelope) {
      let committed = false;
      return {
        async commit() {
          const result = await repository.storeNormalizedPhoto(envelope);
          if (!result.ok) {
            const error = new Error(result.fault.message);
            error.kind = result.fault.kind;
            error.recoverableEnvelope = envelope;
            throw error;
          }
          committed = true;
        },
        async rollback() {
          if (committed) await repository.deletePhoto(envelope.metadata.id);
        },
      };
    },
  });

  return Object.freeze({
    async normalizeFile({ file, ...input }) {
      const sourceBytes = new Uint8Array(await file.arrayBuffer());
      return normalizerFor(file.type).normalizeAndStore({ ...input, sourceBytes });
    },
    async decodeNormalized({ blob }) {
      const bitmap = await decodeBitmap(blob);
      const canvas = createCanvas(bitmap.width, bitmap.height);
      try {
        const context = canvas.getContext('2d');
        context.drawImage(bitmap, 0, 0);
        return {
          width: bitmap.width,
          height: bitmap.height,
          rgba: context.getImageData(0, 0, bitmap.width, bitmap.height).data,
        };
      } finally {
        release(bitmap);
        release(canvas);
      }
    },
  });
}
