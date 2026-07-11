import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { readFile } from 'node:fs/promises';

import { bootstrapMyAvatars } from '../../src/integration/bootstrap.js';
import { createBrowserPhotoAdapter } from '../../src/integration/browser-photo-adapter.js';
import { createNormalizedPhoto } from '../support/fake-indexeddb.js';

const unique = () => `runtime-${Date.now()}-${Math.random()}`;

test('durable bootstrap hydrates the latest identity, active recipe, and saved looks after reload',async()=>{
  const databaseName=unique(),first=await bootstrapMyAvatars({indexedDB,databaseName,createId:(()=>{let n=0;return()=>`id-${++n}`;})()});
  assert.equal(first.storageMode,'durable');
  await first.session.dispatch({type:'edit',baseRevision:1,operations:[{op:'set-style',value:{shading:'soft',outline:false}}]});
  assert.equal((await first.session.dispatch({type:'save-look',label:'Offline Builder'})).ok,true);first.dispose();
  const second=await bootstrapMyAvatars({indexedDB,databaseName});
  assert.equal(second.session.getViewModel().activeRecipe.localLabel,'Offline Builder');assert.ok(second.session.getViewModel().recipes.some(({localLabel})=>localLabel==='Offline Builder'));
  assert.equal((await second.session.dispatch({type:'confirm-reset-person'})).ok,true);second.dispose();
  const third=await bootstrapMyAvatars({indexedDB,databaseName});assert.deepEqual(third.session.getViewModel().recipes.map(({localLabel})=>localLabel),['Avatar 1']);third.dispose();
});

test('durable save persists semantic identity edits before the new look', async () => {
  const databaseName = unique();
  const runtime = await bootstrapMyAvatars({ indexedDB, databaseName });
  assert.equal((await runtime.session.dispatch({
    type: 'edit',
    baseRevision: 1,
    operations: [{ op: 'set-expression', value: 'grin' }],
  })).ok, true);
  const saved = await runtime.session.dispatch({ type: 'save-look', label: 'Grinning Builder' });
  assert.equal(saved.ok, true);
  runtime.dispose();
  const reloaded = await bootstrapMyAvatars({ indexedDB, databaseName });
  assert.equal(reloaded.session.getViewModel().editor.face.expression, 'grin');
  assert.ok(reloaded.session.getViewModel().recipes.some(({ localLabel }) => localLabel === 'Grinning Builder'));
  reloaded.dispose();
});

test('durable save coalesces multiple identity edits and preserves recipe edits', async () => {
  const databaseName = unique();
  const runtime = await bootstrapMyAvatars({ indexedDB, databaseName });
  assert.equal((await runtime.session.dispatch({
    type: 'edit', baseRevision: 1, operations: [{ op: 'set-expression', value: 'grin' }],
  })).ok, true);
  assert.equal((await runtime.session.dispatch({
    type: 'edit', baseRevision: runtime.session.getViewModel().activeRecipe.revision, operations: [{ op: 'set-expression', value: 'smile' }],
  })).ok, true);
  assert.equal((await runtime.session.dispatch({
    type: 'edit', baseRevision: runtime.session.getViewModel().activeRecipe.revision, operations: [{ op: 'set-style', value: { shading: 'soft', outline: false } }],
  })).ok, true);
  const saved = await runtime.session.dispatch({ type: 'save-look', label: 'Coalesced Builder' });
  assert.equal(saved.ok, true);
  runtime.dispose();

  const reloaded = await bootstrapMyAvatars({ indexedDB, databaseName });
  assert.equal(reloaded.session.getViewModel().identityRevision, 2);
  assert.equal(reloaded.session.getViewModel().editor.face.expression, 'smile');
  assert.deepEqual(reloaded.session.getViewModel().activeRecipe.style, { shading: 'soft', outline: false });
  reloaded.dispose();
});

test('durable proposal acceptance coalesces a prior unsaved identity edit', async () => {
  const databaseName = unique();
  const runtime = await bootstrapMyAvatars({ indexedDB, databaseName });
  const session = runtime.session;
  await session.dispatch({
    type: 'edit', baseRevision: 1, operations: [{ op: 'set-expression', value: 'grin' }],
  });
  await session.dispatch({
    type: 'edit',
    baseRevision: session.getViewModel().activeRecipe.revision,
    minecraftProfile: { geometry: 'classic', outerLayers: false },
  });
  await session.dispatch({ type: 'add-photo', envelope: createNormalizedPhoto() });
  const analyzer = { analyze: async (input) => ({ ok: true, value: {
    id: 'coalesced-proposal', baseIdentityRevision: input.baseIdentityRevision,
    operations: [{
      op: 'set-palette', field: 'complexion', value: { primary: '#8899aa', shadow: '#667788', highlight: '#aabbcc' },
      provenance: { source: 'photo-analysis', sourcePhotoIds: ['photo-1'], evidenceState: 'available', analyzerVersion: 'test-v1', confidence: 'high' },
    }],
    evidencePhotoIds: ['photo-1'], analyzerVersion: 'test-v1', confidence: 'high', warnings: [],
  } }) };
  assert.equal((await session.dispatch({ type: 'analyze', analyzer, analysisInput: { photoId: 'photo-1' } })).ok, true);
  assert.equal((await session.dispatch({
    type: 'accept-proposal', proposalId: 'coalesced-proposal', selectedFields: ['complexion'],
  })).ok, true);
  assert.deepEqual(runtime.getUpdateSafety(), { hasUnsavedDraft: true, hasMigration: false });
  assert.equal((await session.dispatch({ type: 'reload-update' })).fault.kind, 'reload-deferred');
  assert.equal((await session.dispatch({ type: 'save-look', label: 'Proposal Builder' })).ok, true);
  runtime.dispose();

  const reloaded = await bootstrapMyAvatars({ indexedDB, databaseName });
  assert.equal(reloaded.session.getViewModel().identityRevision, 2);
  assert.equal(reloaded.session.getViewModel().editor.face.expression, 'grin');
  assert.equal(reloaded.session.getViewModel().editor.complexionPalette.primary, '#8899aa');
  assert.equal(reloaded.session.getViewModel().editor.platformProfiles.minecraft.outerLayers, false);
  reloaded.dispose();
});

test('durable photo cleanup preserves unrelated unsaved identity and recipe edits', async () => {
  const databaseName = unique();
  const runtime = await bootstrapMyAvatars({ indexedDB, databaseName });
  const session = runtime.session;
  await session.dispatch({
    type: 'edit', baseRevision: 1, operations: [{ op: 'set-expression', value: 'grin' }],
  });
  await session.dispatch({
    type: 'edit',
    baseRevision: session.getViewModel().activeRecipe.revision,
    operations: [{ op: 'set-style', value: { shading: 'soft', outline: false } }],
  });
  await session.dispatch({ type: 'add-photo', envelope: createNormalizedPhoto() });
  assert.equal((await session.dispatch({ type: 'delete-photo', id: 'photo-1' })).ok, true);
  assert.equal(session.getViewModel().editor.face.expression, 'grin');
  assert.deepEqual(session.getViewModel().activeRecipe.style, { shading: 'soft', outline: false });
  assert.equal((await session.dispatch({ type: 'save-look', label: 'Cleanup Builder' })).ok, true);
  runtime.dispose();

  const reloaded = await bootstrapMyAvatars({ indexedDB, databaseName });
  assert.equal(reloaded.session.getViewModel().editor.face.expression, 'grin');
  assert.deepEqual(reloaded.session.getViewModel().activeRecipe.style, { shading: 'soft', outline: false });
  reloaded.dispose();
});

test('deleting a different look preserves the active look draft', async () => {
  const databaseName = unique();
  const runtime = await bootstrapMyAvatars({ indexedDB, databaseName });
  const session = runtime.session;
  assert.equal((await session.dispatch({ type: 'save-look', label: 'Other Look' })).ok, true);
  assert.equal((await session.dispatch({ type: 'select-look', id: 'avatar-1' })).ok, true);
  assert.equal((await session.dispatch({
    type: 'edit',
    baseRevision: session.getViewModel().activeRecipe.revision,
    operations: [{ op: 'set-style', value: { shading: 'soft', outline: false } }],
  })).ok, true);

  assert.equal((await session.dispatch({ type: 'delete-look', id: 'avatar-2' })).ok, true);
  assert.equal(session.getViewModel().activeRecipe.id, 'avatar-1');
  assert.deepEqual(session.getViewModel().activeRecipe.style, { shading: 'soft', outline: false });
  assert.deepEqual(runtime.getUpdateSafety(), { hasUnsavedDraft: true, hasMigration: false });
  runtime.dispose();
});

test('durable look allocator never reuses a deleted maximum suffix after reload', async () => {
  const databaseName = unique();
  const first = await bootstrapMyAvatars({ indexedDB, databaseName, createId: (() => { let n = 0; return () => `allocator-${++n}`; })() });
  assert.equal((await first.session.dispatch({ type: 'save-look' })).value.id, 'avatar-2');
  assert.equal((await first.session.dispatch({ type: 'save-look' })).value.id, 'avatar-3');
  await first.session.dispatch({ type: 'delete-look', id: 'avatar-3' });
  first.dispose();
  const second = await bootstrapMyAvatars({ indexedDB, databaseName });
  assert.equal((await second.session.dispatch({ type: 'save-look' })).value.id, 'avatar-4');
  second.dispose();
});

test('concurrent durable sessions reserve unique monotonic look IDs', async () => {
  const databaseName = unique();
  const first = await bootstrapMyAvatars({ indexedDB, databaseName });
  const second = await bootstrapMyAvatars({ indexedDB, databaseName });
  const [left, right] = await Promise.all([
    first.session.dispatch({ type: 'save-look', label: 'Left' }),
    second.session.dispatch({ type: 'save-look', label: 'Right' }),
  ]);
  assert.deepEqual(new Set([left.value.id, right.value.id]), new Set(['avatar-2', 'avatar-3']));
  first.dispose();
  second.dispose();
});

test('runtime exposes live update safety without widening the session facade', async () => {
  const runtime = await bootstrapMyAvatars({ indexedDB: null });
  assert.deepEqual(runtime.getUpdateSafety(), { hasUnsavedDraft: false, hasMigration: false });
  await runtime.session.dispatch({ type: 'edit', baseRevision: 1, operations: [{ op: 'set-expression', value: 'grin' }] });
  assert.deepEqual(runtime.getUpdateSafety(), { hasUnsavedDraft: true, hasMigration: false });
  assert.deepEqual(Object.keys(runtime.session).sort(), ['dispatch', 'dispose', 'getViewModel', 'subscribe']);
  runtime.dispose();
});

test('storage failure falls back accessibly to memory without blocking both compilers',async()=>{
  const runtime=await bootstrapMyAvatars({indexedDB:null});assert.equal(runtime.storageMode,'memory');assert.match(runtime.notice,/memory|storage|unavailable/i);
  assert.equal((await runtime.session.dispatch({type:'compile-minecraft'})).ok,true);
  await runtime.session.dispatch({type:'edit',baseRevision:runtime.session.getViewModel().activeRecipe.revision,robloxProfile:{blockAvatarNoticeAccepted:true}});
  assert.equal((await runtime.session.dispatch({type:'compile-roblox-classic'})).ok,true);runtime.dispose();
});

test('one compiler failure remains isolated from the other platform slot',async()=>{
  const runtime=await bootstrapMyAvatars({indexedDB:null,robloxClassicCompiler:{compile:async()=>({ok:false,fault:{kind:'roblox-failed',message:'Roblox only'}}),preflight:async()=>({passed:false,checks:[]})}});
  assert.equal((await runtime.session.dispatch({type:'compile-roblox-classic'})).ok,false);assert.equal((await runtime.session.dispatch({type:'compile-minecraft'})).ok,true);
  assert.equal(runtime.session.getViewModel().previews.minecraft.status,'ready');runtime.dispose();
});

test('experimental capture, analyzer, and normalizer remain lazy route-only imports',async()=>{
  const [app,capture,adapter]=await Promise.all([readFile(new URL('../../app.js',import.meta.url),'utf8'),readFile(new URL('../../src/integration/capture-controller.js',import.meta.url),'utf8'),readFile(new URL('../../src/integration/browser-photo-adapter.js',import.meta.url),'utf8')]);
  assert.doesNotMatch(app,/^import .*?(capture-route|photo-normalizer|palette-analyzer)/m);
  assert.match(capture,/route === '#\/experimental\/capture'[\s\S]*await load\(\)/);
  assert.match(capture,/import\(['"].*browser-photo-adapter\.js['"]\)/);assert.match(capture,/import\(['"].*palette-analyzer-v1\.js['"]\)/);
  assert.doesNotMatch(adapter,/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/i);
});

test('browser photo adapter normalizes with deferred persistence, local decode, and complete cleanup',async()=>{
  const released=[],stored=[],deleted=[],drawn=[],bitmap={width:4000,height:2000,close(){released.push('bitmap');}},pixels=new Uint8ClampedArray(2048*1024*4).fill(128);
  const canvas={width:0,height:0,getContext:()=>({drawImage(...args){drawn.push(args);},getImageData:()=>({data:pixels}),clearRect(){released.push('canvas');}}),toBlob(callback,type,quality){assert.equal(type,'image/jpeg');assert.equal(quality,.92);callback(new Blob(['normalized'],{type}));}};
  const adapter=createBrowserPhotoAdapter({repository:{async storeNormalizedPhoto(value){stored.push(value);return {ok:true,value};},async deletePhoto(id){deleted.push(id);return {ok:true};}},createImageBitmap:async()=>bitmap,createCanvas:()=>canvas,cryptoObject:{subtle:{digest:async()=>new Uint8Array(32).buffer}},clock:()=>new Date(0).toISOString(),createId:(()=>{let n=0;return()=>`photo-${++n}`;})()});
  const source=new Uint8Array([1,2,3,4]);const result=await adapter.normalizeFile({file:{type:'image/jpeg',async arrayBuffer(){return source.buffer;}},role:'face-front',focusRegion:{centerX:.5,centerY:.5,size:1},confirmed:true});
  assert.equal(result.ok,true);assert.deepEqual([result.value.metadata.width,result.value.metadata.height],[2048,1024]);assert.equal(stored.length,1);assert.ok(drawn.length);assert.ok(released.includes('bitmap'));assert.deepEqual([...source],[0,0,0,0]);
  const decoded=await adapter.decodeNormalized(result.value);assert.equal(decoded.width,4000);assert.equal(decoded.rgba,pixels);assert.ok(released.filter((item)=>item==='bitmap').length>=2);assert.deepEqual(deleted,[]);
});

test('runtime HTML exposes bounded platform, capture, proposal, and local-library controls',async()=>{
  const html=await readFile(new URL('../../index.html',import.meta.url),'utf8');
  for(const id of ['compile-minecraft','compile-roblox-classic','download-minecraft','download-roblox-classic','capture-file','capture-role','focus-x','focus-y','focus-size','capture-preview','analyze-photo','proposal-warnings','proposal-confidence','proposal-fields','accept-proposal','reject-proposal','library-looks','library-photos','delete-all-photos'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/accept="image\/\*"/);assert.match(html,/capture="environment"/);assert.doesNotMatch(html,/real name/i);
});

test('synthetic capture proposal reject, accept, and photo deletion remain local and authority-bound',async()=>{
  const runtime=await bootstrapMyAvatars({indexedDB:null}),session=runtime.session,photo={id:'opaque-photo',role:'face-front',width:32,height:32,mimeType:'image/jpeg',createdAt:'2026-01-01T00:00:00.000Z'};await session.dispatch({type:'add-photo',envelope:{metadata:photo,blob:new Blob(['private'])}});
  const analyzer={analyze:async(input)=>({ok:true,value:{id:'proposal-1',baseIdentityRevision:input.baseIdentityRevision,operations:[{op:'set-palette',field:'complexion',value:{primary:'#8899aa',shadow:'#667788',highlight:'#aabbcc'},provenance:{source:'photo-analysis',sourcePhotoIds:['opaque-photo'],evidenceState:'available',analyzerVersion:'test-v1',confidence:'high'}}],evidencePhotoIds:['opaque-photo'],analyzerVersion:'test-v1',confidence:'high',warnings:[]}})};
  const before=session.getViewModel().identityRevision;await session.dispatch({type:'analyze',analyzer,analysisInput:{photoId:'opaque-photo'}});await session.dispatch({type:'reject-proposal'});assert.equal(session.getViewModel().identityRevision,before);
  await session.dispatch({type:'analyze',analyzer,analysisInput:{photoId:'opaque-photo'}});assert.equal((await session.dispatch({type:'accept-proposal',proposalId:'proposal-1',selectedFields:['complexion']})).ok,true);assert.equal(session.getViewModel().identityRevision,before+1);
  assert.equal((await session.dispatch({type:'delete-photo',id:'opaque-photo'})).ok,true);assert.deepEqual(session.getViewModel().library.photos,[]);assert.doesNotMatch(JSON.stringify(session.getViewModel()),/blob|opaque-photo/);runtime.dispose();
});

test('app bootstrap delegates browser behavior to focused controllers', async () => {
  const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../../src/integration/app-controller.js', import.meta.url), 'utf8');
  assert.match(app, /createAppController/);
  assert.doesNotMatch(app, /capture-file|proposal-fields|library-photos|compile-roblox-classic|getLibrarySnapshot|previewIdentityProposal|recordStoredPhoto/);
  assert.doesNotMatch(controller, /^import .*capture-controller/m);
  assert.match(controller, /import\(['"]\.\/capture-controller\.js['"]\)/);
  assert.match(controller, /resolved\.route === '#\/experimental\/capture'/);
  assert.match(controller, /const token = \+\+navigationToken/);
  assert.match(controller, /token !== navigationToken[\s\S]*controller\.setRoute\(resolveRoute\(window\.location\.hash\)\.route\)/);
  for (const file of ['app-controller.js', 'capture-controller.js', 'export-controller.js', 'library-controller.js']) {
    await readFile(new URL(`../../src/integration/${file}`, import.meta.url), 'utf8');
  }
});

test('capture normalization failures clear retained input except the explicit quota recovery envelope', async () => {
  const capture = await readFile(new URL('../../src/integration/capture-controller.js', import.meta.url), 'utf8');
  const failureBranch = capture.slice(capture.indexOf('if (!result.ok) {'), capture.indexOf('normalized = result.value;'));
  assert.match(failureBranch, /quota-exceeded[\s\S]*recoverableEnvelope[\s\S]*return;/);
  assert.match(failureBranch, /showError\(result\.fault\.message\);\s*clearTransient\(\);\s*return;/);
});

test('runtime HTML includes explicit capture confirmation, platform profiles, preflight, previews, and seven limitations', async () => {
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  for (const id of ['confirm-capture','cancel-capture','minecraft-outer-layers','minecraft-preflight','roblox-preflight','roblox-shirt-preview','roblox-pants-preview','roblox-limitations','manual-complexion','manual-hair','manual-top','manual-bottom','manual-footwear']) assert.match(html,new RegExp(`id="${id}"`));
  const limitations = html.match(/<li data-roblox-limitation/g) ?? [];
  assert.equal(limitations.length, 7);
});

test('failed deferred photo commit leaves no stored photo and still releases source resources',async()=>{
  const source=new Uint8Array([9,8,7]),bitmap={width:1,height:1,close(){}},canvas={width:0,height:0,getContext:()=>({drawImage(){},clearRect(){}}),toBlob(callback,type){callback(new Blob(['x'],{type}));}};
  const adapter=createBrowserPhotoAdapter({repository:{async storeNormalizedPhoto(){return {ok:false,fault:{message:'quota'}};},async deletePhoto(){throw new Error('must not delete uncommitted');}},createImageBitmap:async()=>bitmap,createCanvas:()=>canvas,cryptoObject:{subtle:{digest:async()=>new Uint8Array(32).buffer}},clock:()=>new Date(0).toISOString(),createId:()=> 'id'});
  const result=await adapter.normalizeFile({file:{async arrayBuffer(){return source.buffer;}},role:'face-front',focusRegion:{centerX:.5,centerY:.5,size:1},confirmed:true});assert.equal(result.ok,false);assert.deepEqual([...source],[0,0,0]);
});
