import test from 'node:test';
import assert from 'node:assert/strict';

import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { createMinecraftCompiler } from '../../src/compilers/minecraft/compiler.js';
import { createStudioSession } from '../../src/studio-session/studio-session.js';
import { createMemoryLibrary } from '../../src/studio-session/memory-library.js';

test('update safety tracks successful drafts and durable-library migration state',async()=>{
  const kernel=createAvatarKernel(), initial=kernel.start().value, memory=createMemoryLibrary(initial.recipe);
  const library={list:()=>memory.list(),active:()=>memory.active(),save:(recipe)=>memory.save(recipe),select:(id)=>memory.select(id),delete:(id)=>memory.delete(id),reset:(recipe)=>memory.reset(recipe),hasMigration:()=>true};
  const session=createStudioSession({kernel,minecraftCompiler:createMinecraftCompiler(),library});
  assert.deepEqual(session.getUpdateSafety(),{hasUnsavedDraft:false,hasMigration:true});
  await session.dispatch({type:'edit',baseRevision:1,operations:[{op:'set-expression',value:'grin'}]});
  assert.deepEqual(session.getUpdateSafety(),{hasUnsavedDraft:true,hasMigration:true});
  const failed=await session.dispatch({type:'save-look',label:'<bad>'});assert.equal(failed.ok,false);assert.equal(session.getUpdateSafety().hasUnsavedDraft,true);
  await session.dispatch({type:'save-look',label:'Safe'});assert.equal(session.getUpdateSafety().hasUnsavedDraft,false);
  await session.dispatch({type:'edit',baseRevision:1,minecraftProfile:{geometry:'slim',outerLayers:true}});assert.equal(session.getUpdateSafety().hasUnsavedDraft,true);
  await session.dispatch({type:'select-look',id:initial.recipe.id});assert.equal(session.getUpdateSafety().hasUnsavedDraft,false);
  await session.dispatch({type:'edit',baseRevision:1,operations:[{op:'set-expression',value:'neutral'}]});await session.dispatch({type:'confirm-reset-person'});assert.equal(session.getUpdateSafety().hasUnsavedDraft,false);
});

test('starts and edits without photos, storage, network, or viewer', async () => {
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: createMinecraftCompiler() });
  assert.equal(session.getViewModel().activeRecipe.localLabel, 'Avatar 1');
  const edited = await session.dispatch({
    type: 'edit',
    baseRevision: 1,
    operations: [{ op: 'set-expression', value: 'grin' }],
  });
  assert.equal(edited.ok, true);
  assert.equal(session.getViewModel().editor.face.expression, 'grin');
  assert.match(session.getViewModel().announcement, /updated/i);
  const geometry = await session.dispatch({
    type: 'edit',
    baseRevision: session.getViewModel().activeRecipe.revision,
    minecraftProfile: { geometry: 'slim', outerLayers: true },
  });
  assert.equal(geometry.ok, true);
  assert.equal(session.getViewModel().editor.platformProfiles.minecraft.geometry, 'slim');
  session.dispose();
});

test('saves and selects multiple local looks', async () => {
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: createMinecraftCompiler() });
  await session.dispatch({ type: 'save-look', label: 'Explorer' });
  await session.dispatch({ type: 'edit', baseRevision: 1, operations: [{ op: 'set-style', value: { shading: 'soft', outline: false } }] });
  await session.dispatch({ type: 'save-look', label: 'Builder' });
  const recipes = session.getViewModel().recipes;
  assert.equal(recipes.length, 3);
  await session.dispatch({ type: 'select-look', id: recipes[1].id });
  assert.equal(session.getViewModel().activeRecipe.localLabel, 'Explorer');
  session.dispose();
});

test('compiles Minecraft while isolating compiler faults from the current avatar', async () => {
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: createMinecraftCompiler() });
  const result = await session.dispatch({ type: 'compile-minecraft' });
  assert.equal(result.ok, true);
  assert.equal(session.getViewModel().exports.minecraft.filename, 'my-avatar-minecraft.png');
  assert.equal(session.getViewModel().previews.minecraft.url.startsWith('memory:'), true);
  assert.deepEqual(Object.keys(session.getViewModel().previews.minecraft), ['url', 'preflight', 'status']);

  const frameBefore = session.getViewModel().activeRecipe;
  const failing = createStudioSession({
    kernel: createAvatarKernel(),
    minecraftCompiler: { compile: async () => ({ ok: false, fault: { kind: 'render-failed', message: 'No renderer' } }), preflight: async () => ({ passed: false, checks: [] }) },
  });
  assert.equal((await failing.dispatch({ type: 'compile-minecraft' })).ok, false);
  assert.equal(failing.getViewModel().activeRecipe.id, frameBefore.id);
  assert.match(failing.getViewModel().fault.message, /renderer/i);
  session.dispose(); failing.dispose();
});

test('discards and revokes stale async compiler results', async () => {
  const pending = [];
  const compiler = { compile: () => new Promise((resolve) => pending.push(resolve)), preflight: async () => ({ passed: true, checks: [] }) };
  const created = [];
  const revoked = [];
  const urls = {
    createObjectURL() { const value = `memory:${created.length + 1}`; created.push(value); return value; },
    revokeObjectURL(value) { revoked.push(value); },
  };
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: compiler, urls });
  const first = session.dispatch({ type: 'compile-minecraft' });
  const second = session.dispatch({ type: 'compile-minecraft' });
  while (pending.length < 2) await new Promise((resolve) => setImmediate(resolve));
  const bundle = (name) => ({ ok: true, value: { compiler: 'minecraft-v1', sourceDigest: 'a'.repeat(64), artifacts: [{ filename: name, mediaType: 'image/png', width: 64, height: 64, pixelDigest: 'b'.repeat(64), bytes: new Uint8Array([1]) }] } });
  pending[1](bundle('second.png')); await second;
  pending[0](bundle('first.png')); await first;
  assert.equal(session.getViewModel().exports.minecraft.filename, 'second.png');
  assert.deepEqual(created, ['memory:1']);
  assert.deepEqual(revoked, []);
  session.dispose();
});

test('preflight gates URL exposure and platform slots remain isolated', async () => {
  const calls = [];
  const artifactBundle = (compiler, filename) => ({
    ok: true,
    value: { compiler, sourceDigest: 'a'.repeat(64), artifacts: [{ filename, mediaType: 'application/octet-stream', bytes: new Uint8Array([1]) }] },
  });
  const minecraftCompiler = {
    compile: async () => artifactBundle('minecraft-v1', 'minecraft.png'),
    preflight: async (bundle) => { calls.push(bundle.compiler); return { passed: true, checks: [{ id: 'ok', passed: true, message: 'ok' }] }; },
  };
  const robloxClassicCompiler = {
    compile: async () => artifactBundle('roblox-classic-v1', 'roblox.zip'),
    preflight: async (bundle) => { calls.push(bundle.compiler); return { passed: true, checks: [{ id: 'ok', passed: true, message: 'ok' }] }; },
  };
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler, robloxClassicCompiler });
  await session.dispatch({ type: 'compile-minecraft' });
  await session.dispatch({ type: 'compile-roblox-classic' });
  const model = session.getViewModel();
  assert.deepEqual(calls, ['minecraft-v1', 'roblox-classic-v1']);
  assert.equal(model.previews.minecraft.status, 'ready');
  assert.equal(model.previews.robloxClassic.status, 'ready');
  assert.equal(model.exports.minecraft.filename, 'minecraft.png');
  assert.equal(model.exports.robloxClassic.filename, 'roblox.zip');
  assert.deepEqual(Object.keys(model.previews.minecraft).sort(), ['preflight', 'status', 'url']);

  const created = [];
  const blocked = createStudioSession({
    kernel: createAvatarKernel(),
    minecraftCompiler: {
      compile: async () => artifactBundle('minecraft-v1', 'blocked.png'),
      preflight: async () => ({ passed: false, checks: [{ id: 'bad', passed: false, message: 'bad' }] }),
    },
    urls: { createObjectURL() { created.push('created'); return 'bad'; }, revokeObjectURL() {} },
  });
  const result = await blocked.dispatch({ type: 'compile-minecraft' });
  assert.equal(result.ok, false);
  assert.equal(result.fault.kind, 'preflight-failed');
  assert.deepEqual(created, []);
  assert.equal(blocked.getViewModel().exports.minecraft.available, false);
  session.dispose(); blocked.dispose();
});

test('frame mutations clear existing exports and stale in-flight compilation', async () => {
  const pending = [];
  const revoked = [];
  let created = 0;
  const compiler = {
    compile: () => new Promise((resolve) => pending.push(resolve)),
    preflight: async () => ({ passed: true, checks: [] }),
  };
  const urls = { createObjectURL: () => `memory:${++created}`, revokeObjectURL: (url) => revoked.push(url) };
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: compiler, urls });
  const bundle = { ok: true, value: { compiler: 'minecraft-v1', sourceDigest: 'a'.repeat(64), artifacts: [{ filename: 'one.png', mediaType: 'image/png', bytes: new Uint8Array([1]) }] } };
  const first = session.dispatch({ type: 'compile-minecraft' });
  while (!pending.length) await new Promise((resolve) => setImmediate(resolve));
  pending.shift()(bundle); await first;
  assert.equal(session.getViewModel().exports.minecraft.available, true);
  await session.dispatch({ type: 'edit', baseRevision: 1, operations: [{ op: 'set-expression', value: 'grin' }] });
  assert.equal(session.getViewModel().exports.minecraft.available, false);
  assert.deepEqual(revoked, ['memory:1']);

  const stale = session.dispatch({ type: 'compile-minecraft' });
  while (!pending.length) await new Promise((resolve) => setImmediate(resolve));
  await session.dispatch({ type: 'edit', baseRevision: 2, operations: [{ op: 'set-expression', value: 'neutral' }] });
  pending.shift()(bundle);
  assert.equal((await stale).fault.kind, 'stale-result');
  assert.equal(session.getViewModel().exports.minecraft.available, false);
  session.dispose();
});

test('thrown compiler stages become recoverable faults and always clear busy', async () => {
  for (const minecraftCompiler of [
    { compile: async () => { throw new Error('compile boom'); }, preflight: async () => ({ passed: true, checks: [] }) },
    { compile: async () => ({ ok: true, value: { compiler: 'minecraft-v1', sourceDigest: 'a'.repeat(64), artifacts: [{ filename: 'x', mediaType: 'image/png', bytes: new Uint8Array([1]) }] } }), preflight: async () => { throw new Error('preflight boom'); } },
  ]) {
    const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler });
    const result = await session.dispatch({ type: 'compile-minecraft' });
    assert.equal(result.ok, false);
    assert.equal(result.fault.kind, 'compiler-exception');
    assert.equal(session.getViewModel().busy, false);
    session.dispose();
  }
});

test('a delayed failing preflight becomes silently stale after an edit', async () => {
  let resolvePreflight;
  const reachedPreflight = new Promise((resolve) => { resolvePreflight = resolve; });
  let releaseFailure;
  const delayedFailure = new Promise((resolve) => { releaseFailure = resolve; });
  const compiler = {
    compile: async () => ({ ok: true, value: { compiler: 'minecraft-v1', sourceDigest: 'a'.repeat(64), artifacts: [{ filename: 'stale.png', mediaType: 'image/png', bytes: new Uint8Array([1]) }] } }),
    preflight: async () => { resolvePreflight(); return delayedFailure; },
  };
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: compiler });
  const compiling = session.dispatch({ type: 'compile-minecraft' });
  await reachedPreflight;
  await session.dispatch({ type: 'edit', baseRevision: 1, operations: [{ op: 'set-expression', value: 'grin' }] });
  releaseFailure({ passed: false, checks: [{ id: 'late', passed: false, message: 'late failure' }] });
  const result = await compiling;
  assert.equal(result.ok, false);
  assert.equal(result.fault.kind, 'stale-result');
  assert.equal(session.getViewModel().fault, null);
  assert.equal(session.getViewModel().exports.minecraft.available, false);
  assert.equal(session.getViewModel().previews.minecraft.url, null);
  session.dispose();
});

test('save-look validates labels atomically before library or export mutation', async () => {
  const revoked = [];
  const session = createStudioSession({
    kernel: createAvatarKernel(),
    minecraftCompiler: createMinecraftCompiler(),
    urls: { createObjectURL: () => 'memory:existing', revokeObjectURL: (url) => revoked.push(url) },
  });
  await session.dispatch({ type: 'compile-minecraft' });
  const before = session.getViewModel();
  for (const label of [42, {}, '   ', 'Bad\nLabel', '<script>']) {
    const result = await session.dispatch({ type: 'save-look', label });
    assert.equal(result.ok, false);
    assert.equal(result.fault.kind, 'invalid-action');
    assert.equal(session.getViewModel().recipes.length, before.recipes.length);
    assert.equal(session.getViewModel().activeRecipe.id, before.activeRecipe.id);
    assert.equal(session.getViewModel().exports.minecraft.available, true);
  }
  assert.deepEqual(revoked, []);
  session.dispose();
});

test('busy remains true until simultaneous platform compiles both settle', async () => {
  const pending = { minecraft: null, roblox: null };
  const makeCompiler = (key, compiler, filename) => ({
    compile: () => new Promise((resolve) => { pending[key] = () => resolve({ ok: true, value: { compiler, sourceDigest: 'a'.repeat(64), artifacts: [{ filename, mediaType: 'application/octet-stream', bytes: new Uint8Array([1]) }] } }); }),
    preflight: async () => ({ passed: true, checks: [] }),
  });
  const session = createStudioSession({
    kernel: createAvatarKernel(),
    minecraftCompiler: makeCompiler('minecraft', 'minecraft-v1', 'm.png'),
    robloxClassicCompiler: makeCompiler('roblox', 'roblox-classic-v1', 'r.zip'),
  });
  const minecraft = session.dispatch({ type: 'compile-minecraft' });
  const roblox = session.dispatch({ type: 'compile-roblox-classic' });
  while (!pending.minecraft || !pending.roblox) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(session.getViewModel().busy, true);
  pending.minecraft(); await minecraft;
  assert.equal(session.getViewModel().busy, true);
  pending.roblox(); await roblox;
  assert.equal(session.getViewModel().busy, false);
  session.dispose();
});

test('confirmed person reset clears looks and exports and starts fresh Avatar 1', async () => {
  const revoked = [];
  const session = createStudioSession({
    kernel: createAvatarKernel(),
    minecraftCompiler: createMinecraftCompiler(),
    urls: { createObjectURL: () => 'memory:old', revokeObjectURL: (url) => revoked.push(url) },
  });
  await session.dispatch({ type: 'save-look', label: 'Explorer' });
  await session.dispatch({ type: 'compile-minecraft' });
  const result = await session.dispatch({ type: 'confirm-reset-person' });
  assert.equal(result.ok, true);
  const model = session.getViewModel();
  assert.equal(model.recipes.length, 1);
  assert.equal(model.activeRecipe.localLabel, 'Avatar 1');
  assert.equal(model.activeRecipe.revision, 1);
  assert.equal(model.identityRevision, 1);
  assert.equal(model.exports.minecraft.available, false);
  assert.match(model.announcement, /fresh|new person|started over/i);
  assert.deepEqual(revoked, ['memory:old']);
  session.dispose();
});

test('URL creation receives artifact media type for each platform', async () => {
  const received = [];
  const compiler = {
    compile: async () => ({ ok: true, value: { compiler: 'roblox-classic-v1', sourceDigest: 'a'.repeat(64), artifacts: [{ filename: 'package.zip', mediaType: 'application/zip', bytes: new Uint8Array([1]) }] } }),
    preflight: async () => ({ passed: true, checks: [] }),
  };
  const session = createStudioSession({
    kernel: createAvatarKernel(), robloxClassicCompiler: compiler,
    urls: { createObjectURL(bytes, mediaType) { received.push([bytes.length, mediaType]); return 'memory:zip'; }, revokeObjectURL() {} },
  });
  await session.dispatch({ type: 'compile-roblox-classic' });
  assert.deepEqual(received, [[1, 'application/zip']]);
  session.dispose();
});

test('subscriptions announce changes and unknown actions are closed faults', async () => {
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: createMinecraftCompiler() });
  let notifications = 0;
  const unsubscribe = session.subscribe(() => { notifications += 1; });
  const before = session.getViewModel();
  const result = await session.dispatch({ type: 'execute-javascript' });
  assert.equal(result.ok, false);
  assert.equal(result.fault.kind, 'unsupported-action');
  assert.equal(session.getViewModel().identityRevision, before.identityRevision);
  assert.ok(notifications > 0);
  unsubscribe(); session.dispose();
});
