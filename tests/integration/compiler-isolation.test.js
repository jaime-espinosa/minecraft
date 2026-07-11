import test from 'node:test';
import assert from 'node:assert/strict';

import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { createStudioSession } from '../../src/studio-session/studio-session.js';

const bundle = (compiler, filename) => ({ ok: true, value: {
  compiler,
  sourceDigest: 'a'.repeat(64),
  artifacts: [{ filename, mediaType: 'application/octet-stream', bytes: new Uint8Array([1]) }],
} });
const ready = (compiler, filename) => ({
  compile: async () => bundle(compiler, filename),
  preflight: async () => ({ passed: true, checks: [{ id: 'ok', passed: true, message: 'Passed.' }] }),
});

test('Roblox faults preserve a ready Minecraft output, recipe, and library state', async () => {
  for (const robloxClassicCompiler of [
    { compile: async () => ({ ok: false, fault: { kind: 'roblox-fault', message: 'Roblox only.' } }), preflight: async () => ({ passed: false, checks: [] }) },
    { compile: async () => { throw new Error('Roblox exception'); }, preflight: async () => ({ passed: false, checks: [] }) },
    { compile: async () => bundle('roblox-classic-v1', 'roblox.zip'), preflight: async () => ({ passed: false, checks: [{ id: 'bad', passed: false, message: 'Bad.' }] }) },
  ]) {
    const revoked = [];
    const session = createStudioSession({
      kernel: createAvatarKernel(),
      minecraftCompiler: ready('minecraft-v1', 'minecraft.png'),
      robloxClassicCompiler,
      urls: { createObjectURL: () => 'memory:minecraft', revokeObjectURL: (url) => revoked.push(url) },
    });
    await session.dispatch({ type: 'compile-minecraft' });
    const before = session.getViewModel();
    assert.equal((await session.dispatch({ type: 'compile-roblox-classic' })).ok, false);
    const after = session.getViewModel();
    assert.deepEqual(after.activeRecipe, before.activeRecipe);
    assert.deepEqual(after.recipes, before.recipes);
    assert.deepEqual(after.previews.minecraft, before.previews.minecraft);
    assert.deepEqual(revoked, []);
    session.dispose();
  }
});

test('Minecraft faults preserve a ready Roblox output and profile', async () => {
  const session = createStudioSession({
    kernel: createAvatarKernel(),
    minecraftCompiler: { compile: async () => ({ ok: false, fault: { kind: 'minecraft-fault', message: 'Minecraft only.' } }), preflight: async () => ({ passed: false, checks: [] }) },
    robloxClassicCompiler: ready('roblox-classic-v1', 'roblox.zip'),
  });
  await session.dispatch({ type: 'compile-roblox-classic' });
  const before = session.getViewModel();
  assert.equal((await session.dispatch({ type: 'compile-minecraft' })).ok, false);
  const after = session.getViewModel();
  assert.deepEqual(after.activeRecipe, before.activeRecipe);
  assert.deepEqual(after.previews.robloxClassic, before.previews.robloxClassic);
  session.dispose();
});
