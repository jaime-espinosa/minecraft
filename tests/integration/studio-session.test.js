import test from 'node:test';
import assert from 'node:assert/strict';

import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { createMinecraftCompiler } from '../../src/compilers/minecraft/compiler.js';
import { createStudioSession } from '../../src/studio-session/studio-session.js';
import { createMemoryLibrary } from '../../src/studio-session/memory-library.js';

test('reload-update stays behind the closed action and blocks unsafe reloads',async()=>{
  const kernel=createAvatarKernel(), initial=kernel.start().value, memory=createMemoryLibrary(initial.recipe);
  const library={list:()=>memory.list(),active:()=>memory.active(),save:(recipe)=>memory.save(recipe),select:(id)=>memory.select(id),delete:(id)=>memory.delete(id),reset:(recipe)=>memory.reset(recipe),hasMigration:()=>true};
  const session=createStudioSession({kernel,minecraftCompiler:createMinecraftCompiler(),library});
  let activations = 0;
  assert.equal((await session.dispatch({ type: 'reload-update', activate: () => { activations += 1; } })).fault.kind, 'reload-deferred');
  await session.dispatch({type:'edit',baseRevision:1,operations:[{op:'set-expression',value:'grin'}]});
  const failed=await session.dispatch({type:'save-look',label:'<bad>'});assert.equal(failed.ok,false);
  assert.equal((await session.dispatch({ type: 'reload-update', activate: () => { activations += 1; } })).fault.kind, 'reload-deferred');
  assert.equal(activations, 0);
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

test('recipe-only edits preserve a prior dirty identity until save persists both', async () => {
  const kernel = createAvatarKernel();
  const initial = kernel.start().value;
  const memory = createMemoryLibrary(initial.recipe);
  let identitySaves = 0;
  const library = {
    ...memory,
    async saveIdentityFrame(frame, options) {
      identitySaves += 1;
      return memory.saveIdentityFrame(frame, options);
    },
  };
  const session = createStudioSession({ kernel, library, minecraftCompiler: createMinecraftCompiler() });

  assert.equal((await session.dispatch({
    type: 'edit',
    baseRevision: 1,
    operations: [{ op: 'set-expression', value: 'grin' }],
  })).ok, true);
  assert.equal((await session.dispatch({
    type: 'edit',
    baseRevision: session.getViewModel().activeRecipe.revision,
    operations: [{ op: 'set-style', value: { shading: 'soft', outline: false } }],
  })).ok, true);
  assert.equal((await session.dispatch({ type: 'save-look', label: 'Saved Together' })).ok, true);
  assert.equal(identitySaves, 1);
  session.dispose();
});

test('selecting a look cannot make an unsaved identity safe to reload', async () => {
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: createMinecraftCompiler() });
  await session.dispatch({ type: 'save-look', label: 'Second' });
  await session.dispatch({
    type: 'edit',
    baseRevision: session.getViewModel().activeRecipe.revision,
    operations: [{ op: 'set-expression', value: 'grin' }],
  });
  await session.dispatch({ type: 'select-look', id: 'avatar-1' });
  let activations = 0;
  const reload = await session.dispatch({ type: 'reload-update', activate: () => { activations += 1; } });
  assert.equal(reload.fault.kind, 'reload-deferred');
  assert.equal(activations, 0);
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

test('allocates saved look IDs above the maximum numeric suffix after deletion', async () => {
  const kernel = createAvatarKernel();
  const initial = kernel.start().value;
  const one = structuredClone(initial.recipe);
  const three = structuredClone(initial.recipe);
  three.id = 'avatar-3';
  three.localLabel = 'Avatar 3';
  const recipes = [one, three];
  let activeId = one.id;
  const library = {
    list: () => structuredClone(recipes),
    active: () => structuredClone(recipes.find(({ id }) => id === activeId)),
    save(recipe) { recipes.push(structuredClone(recipe)); activeId = recipe.id; return recipe; },
    delete(id) { recipes.splice(recipes.findIndex((recipe) => recipe.id === id), 1); return true; },
    hasMigration: () => false,
  };
  const session = createStudioSession({ kernel, initialFrame: initial, library, minecraftCompiler: createMinecraftCompiler() });
  await session.dispatch({ type: 'delete-look', id: 'avatar-3' });
  const saved = await session.dispatch({ type: 'save-look' });
  assert.equal(saved.value.id, 'avatar-4');
  assert.equal(saved.value.localLabel, 'Avatar 4');
  session.dispose();
});

test('proposal authority is visible only through the view model and dies with its evidence or person', async () => {
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: createMinecraftCompiler() });
  assert.deepEqual(Object.keys(session).sort(), ['dispatch', 'dispose', 'getViewModel', 'subscribe']);
  const envelope = { metadata: { id: 'photo-1', role: 'face-front', width: 32, height: 32, createdAt: '2026-01-01T00:00:00.000Z' }, blob: new Blob(['private']) };
  assert.equal((await session.dispatch({ type: 'add-photo', envelope })).ok, true);
  const analyzer = { analyze: async ({ baseIdentityRevision }) => ({ ok: true, value: {
    id: 'proposal-1', baseIdentityRevision,
    operations: [{ op: 'set-palette', field: 'complexion', value: { primary: '#8899aa', shadow: '#667788', highlight: '#aabbcc' }, provenance: { source: 'photo-analysis', sourcePhotoIds: ['photo-1'], evidenceState: 'available', analyzerVersion: 'test-v1', confidence: 'high' } }],
    evidencePhotoIds: ['photo-1'], analyzerVersion: 'test-v1', confidence: 'high', warnings: [],
  } }) };
  assert.equal((await session.dispatch({ type: 'analyze', analyzer, analysisInput: { photoId: 'photo-1' } })).ok, true);
  let model = session.getViewModel();
  assert.deepEqual(model.library.photos, [{ id: 'photo-1', role: 'face-front', width: 32, height: 32, createdAt: '2026-01-01T00:00:00.000Z' }]);
  assert.equal(model.proposal.confidence, 'high');
  assert.deepEqual(model.proposal.evidenceRoles, ['face-front']);
  assert.deepEqual(model.proposal.preselectedFields, ['complexion']);
  assert.deepEqual(model.proposal.operations[0].accepted, model.editor.complexionPalette);
  assert.deepEqual(model.proposal.operations[0].proposed, { primary: '#8899aa', shadow: '#667788', highlight: '#aabbcc' });
  assert.doesNotMatch(JSON.stringify(model.proposal), /private|photo-1|sourcePhotoIds|evidencePhotoIds|analyzerVersion|"blob"/i);

  await session.dispatch({ type: 'delete-photo', id: 'photo-1' });
  assert.equal(session.getViewModel().proposal, null);
  const deletedAccept = await session.dispatch({ type: 'accept-proposal', proposalId: 'proposal-1', selectedFields: ['complexion'] });
  assert.equal(deletedAccept.ok, false);
  assert.equal(deletedAccept.fault.kind, 'proposal-unavailable');

  await session.dispatch({ type: 'add-photo', envelope });
  await session.dispatch({ type: 'analyze', analyzer, analysisInput: { photoId: 'photo-1' } });
  await session.dispatch({ type: 'confirm-reset-person' });
  const resetAccept = await session.dispatch({ type: 'accept-proposal', proposalId: 'proposal-1', selectedFields: ['complexion'] });
  assert.equal(resetAccept.ok, false);
  assert.equal(resetAccept.fault.kind, 'proposal-unavailable');
  session.dispose();
});

test('Roblox compile never edits its profile and a failed compile preserves ready Minecraft output', async () => {
  const revoked = [];
  const session = createStudioSession({
    kernel: createAvatarKernel(),
    minecraftCompiler: createMinecraftCompiler(),
    robloxClassicCompiler: { compile: async () => ({ ok: false, fault: { kind: 'roblox-only', message: 'Roblox failed.' } }), preflight: async () => ({ passed: false, checks: [] }) },
    urls: { createObjectURL: () => 'memory:minecraft', revokeObjectURL: (url) => revoked.push(url) },
  });
  await session.dispatch({ type: 'compile-minecraft' });
  const before = session.getViewModel();
  const failed = await session.dispatch({ type: 'compile-roblox-classic' });
  const after = session.getViewModel();
  assert.equal(failed.ok, false);
  assert.deepEqual(after.activeRecipe, before.activeRecipe);
  assert.equal(after.previews.minecraft.url, before.previews.minecraft.url);
  assert.deepEqual(revoked, []);
  session.dispose();
});

test('manual palette correction updates semantics with manual provenance', async () => {
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: createMinecraftCompiler() });
  const palette = { primary: '#123456', shadow: '#0d253e', highlight: '#3d5a74' };
  const changed = await session.dispatch({
    type: 'edit',
    baseRevision: 1,
    operations: [{
      op: 'set-palette',
      field: 'complexion',
      value: palette,
      provenance: { source: 'manual', sourcePhotoIds: [], evidenceState: 'not-applicable' },
    }],
  });
  assert.equal(changed.ok, true);
  assert.deepEqual(changed.value.identity.complexionPalette, palette);
  assert.deepEqual(changed.value.identity.provenance.complexion, { source: 'manual', sourcePhotoIds: [], evidenceState: 'not-applicable' });
  assert.deepEqual(session.getViewModel().editor.complexionPalette, palette);
  session.dispose();
});

test('pending analysis cannot resurrect a proposal after rejection or disposal', async () => {
  let resolveAnalysis;
  const analyzer = { analyze: () => new Promise((resolve) => { resolveAnalysis = resolve; }) };
  const session = createStudioSession({ kernel: createAvatarKernel(), minecraftCompiler: createMinecraftCompiler() });
  const envelope = { metadata: { id: 'photo-1', role: 'face-front', width: 1, height: 1, createdAt: '2026-01-01T00:00:00.000Z' }, blob: new Blob(['x']) };
  await session.dispatch({ type: 'add-photo', envelope });
  const pending = session.dispatch({ type: 'analyze', analyzer, analysisInput: { photoId: 'photo-1' } });
  while (!resolveAnalysis) await new Promise((resolve) => setImmediate(resolve));
  await session.dispatch({ type: 'reject-proposal' });
  resolveAnalysis({ ok: true, value: {
    id: 'proposal-late', baseIdentityRevision: 1,
    operations: [{ op: 'set-palette', field: 'complexion', value: { primary: '#8899aa', shadow: '#667788', highlight: '#aabbcc' }, provenance: { source: 'photo-analysis', sourcePhotoIds: ['photo-1'], evidenceState: 'available', analyzerVersion: 'test-v1', confidence: 'high' } }],
    evidencePhotoIds: ['photo-1'], analyzerVersion: 'test-v1', confidence: 'high', warnings: [],
  } });
  assert.equal((await pending).fault.kind, 'stale-analysis');
  assert.equal(session.getViewModel().proposal, null);
  session.dispose();
});

test('update safety reports an in-flight destructive library migration', async () => {
  const kernel = createAvatarKernel();
  const initial = kernel.start().value;
  const memory = createMemoryLibrary(initial.recipe);
  let releaseReset;
  const library = {
    ...memory,
    reset: () => new Promise((resolve) => { releaseReset = () => resolve(initial); }),
  };
  const reports = [];
  const session = createStudioSession({
    kernel,
    library,
    minecraftCompiler: createMinecraftCompiler(),
    reportUpdateSafety: (value) => reports.push(value),
  });
  const resetting = session.dispatch({ type: 'confirm-reset-person' });
  while (!releaseReset) await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(reports.at(-1), { hasUnsavedDraft: false, hasMigration: true });
  releaseReset();
  await resetting;
  assert.deepEqual(reports.at(-1), { hasUnsavedDraft: false, hasMigration: false });
  session.dispose();
});
