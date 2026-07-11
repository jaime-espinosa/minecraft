import { err, ok } from '../domain/result.js';

export function createPhotoNormalizer(deps) {
  const required = ['decode', 'orient', 'createCanvas', 'draw', 'encode', 'digest', 'stageNormalizedPhoto', 'release'];
  if (required.some((name) => typeof deps?.[name] !== 'function')) throw new TypeError('Photo normalizer dependencies are incomplete.');
  return Object.freeze({
    async normalizeAndStore({ sourceBytes, confirmed, role, focusRegion, signal }) {
      const transient = new Set([sourceBytes]); let objectUrl = null; let storageHandle = null; let metadata = null; let rollbackAttempted = false;
      const checkAbort = () => { if (signal?.aborted) throw Object.assign(new Error('Photo normalization was cancelled.'), { kind: 'cancelled' }); };
      const rollback = async () => {
        if (rollbackAttempted || typeof storageHandle?.rollback !== 'function') return null;
        rollbackAttempted = true;
        try { await storageHandle.rollback(); return null; } catch (error) { return error; }
      };
      if (!confirmed) {
        deps.release(sourceBytes);
        return err({ kind: 'cancelled', message: 'Photo role confirmation was cancelled.' });
      }
      try {
        checkAbort();
        const decoded = await deps.decode(sourceBytes, { signal }); transient.add(decoded); checkAbort();
        const oriented = await deps.orient(decoded, { signal }); transient.add(oriented); checkAbort();
        const scale = Math.min(1, 2048 / Math.max(oriented.width, oriented.height));
        const width = Math.max(1, Math.round(oriented.width * scale)); const height = Math.max(1, Math.round(oriented.height * scale));
        const canvas = deps.createCanvas(width, height); transient.add(canvas); checkAbort();
        await deps.draw(canvas, oriented, { width, height, signal }); checkAbort();
        const mimeType = oriented.hasAlpha ? 'image/png' : 'image/jpeg';
        const blob = await deps.encode(canvas, { mimeType, ...(mimeType === 'image/jpeg' ? { quality: .92 } : {}), signal }); checkAbort();
        if (deps.createObjectURL) objectUrl = deps.createObjectURL(blob);
        const pixelDigest = await deps.digest(blob, { signal }); checkAbort();
        metadata = {
          id: deps.createId(), role, blobKey: deps.createId(), pixelDigest, mimeType, width, height,
          createdAt: deps.clock(), normalizationVersion: deps.normalizationVersion, focusRegion: structuredClone(focusRegion),
        };
        checkAbort();
        const staged = await deps.stageNormalizedPhoto({ metadata, blob }, { signal });
        if (typeof staged?.rollback === 'function') storageHandle = staged;
        const keys = staged && typeof staged === 'object' ? Reflect.ownKeys(staged) : [];
        const validHandle = keys.length === 2 && keys.includes('commit') && keys.includes('rollback')
          && keys.every((key) => typeof key === 'string' && Object.getOwnPropertyDescriptor(staged, key).enumerable && Object.hasOwn(Object.getOwnPropertyDescriptor(staged, key), 'value'))
          && typeof staged.commit === 'function' && typeof staged.rollback === 'function';
        if (!validHandle) {
          const rollbackError = await rollback();
          if (rollbackError) return err({ kind: 'normalization-failed', message: `Storage contract failed and rollback failed: ${rollbackError.message}` });
          return err({ kind: 'storage-contract', message: 'Photo storage must return an exact deferred commit and rollback handle.' });
        }
        storageHandle = staged;
        if (signal?.aborted) {
          const rollbackError = await rollback();
          return rollbackError ? err({ kind: 'normalization-failed', message: `Cancellation rollback failed: ${rollbackError.message}` }) : err({ kind: 'cancelled', message: 'Photo normalization was cancelled.' });
        }
        await storageHandle.commit();
        if (signal?.aborted) {
          const rollbackError = await rollback();
          return rollbackError ? err({ kind: 'normalization-failed', message: `Cancellation rollback failed: ${rollbackError.message}` }) : err({ kind: 'cancelled', message: 'Photo normalization was cancelled.' });
        }
        return ok({ metadata, blob });
      } catch (error) {
        const rollbackError = await rollback();
        if (rollbackError) return err({ kind: 'normalization-failed', message: `${error.message}; rollback failed: ${rollbackError.message}` });
        if (error.kind === 'cancelled') return err({ kind: 'cancelled', message: error.message });
        return err({ kind: 'normalization-failed', message: error.message });
      }
      finally {
        try { if (objectUrl && deps.revokeObjectURL) deps.revokeObjectURL(objectUrl); } catch {}
        for (const resource of transient) try { deps.release(resource); } catch {}
      }
    },
  });
}
