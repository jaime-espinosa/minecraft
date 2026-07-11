import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdtemp, mkdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  CACHE_NAME,
  CACHE_PREFIX,
  PUBLIC_BASE,
  PUBLIC_PATHS,
  SHELL_VERSION,
  activateWaitingWorker,
  installCompleteShell,
  shouldHandleRequest,
} from '../../src/pwa/app-shell.js';
import { registerMyAvatarsServiceWorker } from '../../src/pwa/register-service-worker.js';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const exec = promisify(execFile);
const settle = () => new Promise((resolve) => setImmediate(resolve));

function memoryCaches(initial = {}) {
  const stores = new Map(Object.entries(initial).map(([name, values]) => [name, new Map(Object.entries(values))]));
  return {
    stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return { async put(key, value) { store.set(String(key), value); }, async match(key) { return store.get(String(key)); } };
    },
    async delete(name) { return stores.delete(name); },
    async keys() { return [...stores.keys()]; },
  };
}

const eventTarget = () => { const listeners=new Map(); return { addEventListener(type,listener){listeners.set(type,listener);}, emit(type){listeners.get(type)?.();} }; };
const serviceWorkerFixture = ({controller={}}={}) => {
  const container={...eventTarget(),controller,async register(){return registration;}}, installing={...eventTarget(),state:'installing',postMessage(){}}, registration={...eventTarget(),installing,waiting:null};
  return {navigatorObject:{serviceWorker:container},container,registration,installing};
};

test('pins one exact versioned public shell matching the deployment allowlist', async () => {
  assert.equal(PUBLIC_BASE, '/my-avatars/');
  assert.match(SHELL_VERSION, /^v[1-9][0-9]*$/);
  assert.equal(CACHE_NAME, `${CACHE_PREFIX}${SHELL_VERSION}`);
  assert.equal(new Set(PUBLIC_PATHS).size, PUBLIC_PATHS.length);
  assert.ok(PUBLIC_PATHS.every((path) => path.startsWith(PUBLIC_BASE) && !path.includes('..')));
  const deployed=(await read('deploy/pages-allowlist.txt')).split(/\r?\n/).filter((line)=>line&&!line.startsWith('#')).map((path)=>`${PUBLIC_BASE}${path==='index.html'?'':path}`).sort();
  assert.deepEqual([...PUBLIC_PATHS].sort(),deployed);
});

test('installs into a complete new version without deleting the previous shell on failure', async () => {
  const old=`${CACHE_PREFIX}v0`, caches=memoryCaches({[old]:{'sentinel':'last-good'}}), requested=[];
  await assert.rejects(installCompleteShell({cacheStorage:caches,fetchAsset:async(url)=>{requested.push(url);if(requested.length===3)throw new Error('offline');return {ok:true,clone(){return this;}};},origin:'https://example.test'}));
  assert.equal(caches.stores.get(old).get('sentinel'),'last-good');
  assert.equal(caches.stores.has(CACHE_NAME),false);
  assert.equal([...caches.stores.keys()].some((name)=>name.includes('installing')),false);
  assert.equal(requested.length,3);
  await installCompleteShell({cacheStorage:caches,fetchAsset:async()=>({ok:true,clone(){return this;}}),origin:'https://example.test'});
  assert.equal(caches.stores.get(CACHE_NAME).size,PUBLIC_PATHS.length);
  assert.ok([...caches.stores.get(CACHE_NAME).keys()].every((url)=>PUBLIC_PATHS.includes(new URL(url).pathname)));
  assert.equal(caches.stores.get(old).get('sentinel'),'last-good');
});

test('a repeated install retains an already complete current version without refetching it', async () => {
  const complete=Object.fromEntries(PUBLIC_PATHS.map((path)=>[`https://example.test${path}`,{ok:true,clone(){return this;}}]));
  const caches=memoryCaches({[CACHE_NAME]:complete}); let fetched=false;
  await installCompleteShell({cacheStorage:caches,fetchAsset:async()=>{fetched=true;throw new Error('offline');},origin:'https://example.test'});
  assert.equal(fetched,false); assert.equal(caches.stores.get(CACHE_NAME).size,PUBLIC_PATHS.length);
});

test('waiting activation requires a user Reload choice and a clean session', () => {
  const messages=[], registration={waiting:{postMessage:(message)=>messages.push(message)}};
  assert.equal(activateWaitingWorker(registration,{userChoseReload:false,hasUnsavedDraft:false,migrationInProgress:false}),false);
  assert.equal(activateWaitingWorker(registration,{userChoseReload:true,hasUnsavedDraft:true,migrationInProgress:false}),false);
  assert.equal(activateWaitingWorker(registration,{userChoseReload:true,hasUnsavedDraft:false,migrationInProgress:true}),false);
  assert.equal(activateWaitingWorker(registration,{userChoseReload:true,hasUnsavedDraft:false,migrationInProgress:false}),true);
  assert.deepEqual(messages,[{type:'ACTIVATE_UPDATE'}]);
});

test('registration reloads only this tab after its approved update activation',async()=>{
  const first=serviceWorkerFixture({controller:null});let firstReloads=0;
  await registerMyAvatarsServiceWorker({navigatorObject:first.navigatorObject,reload:()=>firstReloads++});first.container.emit('controllerchange');assert.equal(firstReloads,0);
  const other=serviceWorkerFixture();let otherReloads=0;
  await registerMyAvatarsServiceWorker({navigatorObject:other.navigatorObject,reload:()=>otherReloads++});other.container.emit('controllerchange');assert.equal(otherReloads,0);
  const approved=serviceWorkerFixture();let approvedReloads=0,prompt=null,messages=[];approved.registration.waiting={postMessage:(message)=>messages.push(message)};
  await registerMyAvatarsServiceWorker({navigatorObject:approved.navigatorObject,reload:()=>approvedReloads++,getUpdateSafety:()=>({hasUnsavedDraft:false,hasMigration:false}),onUpdate:(value)=>{prompt=value;}});
  assert.equal(await prompt.activateWhenSafe(),true);assert.deepEqual(messages,[{type:'ACTIVATE_UPDATE'}]);approved.container.emit('controllerchange');await settle();assert.equal(approvedReloads,1);approved.container.emit('controllerchange');await settle();assert.equal(approvedReloads,1);
});

test('controller takeover rechecks safety and reloads later only after another explicit safe choice',async()=>{
  const fixture=serviceWorkerFixture(),messages=[];let prompt=null,reloads=0,deferred=0,safety={hasUnsavedDraft:false,hasMigration:false};fixture.registration.waiting={postMessage:(message)=>messages.push(message)};
  await registerMyAvatarsServiceWorker({navigatorObject:fixture.navigatorObject,getUpdateSafety:()=>safety,reload:()=>reloads++,onReloadDeferred:()=>deferred++,onUpdate:(value)=>{prompt=value;}});
  assert.equal(await prompt.activateWhenSafe(),true);safety={hasUnsavedDraft:true,hasMigration:false};fixture.container.emit('controllerchange');await settle();assert.equal(reloads,0);assert.equal(deferred,1);
  assert.equal(await prompt.reloadWhenSafe(),false);safety={hasUnsavedDraft:false,hasMigration:false};assert.equal(await prompt.reloadWhenSafe(),true);assert.equal(reloads,1);assert.deepEqual(messages,[{type:'ACTIVATE_UPDATE'}]);
});

test('updatefound captures the installing worker even after registration clears its reference',async()=>{
  const fixture=serviceWorkerFixture(),prompts=[];
  await registerMyAvatarsServiceWorker({navigatorObject:fixture.navigatorObject,getUpdateSafety:()=>({hasUnsavedDraft:false,hasMigration:false}),onUpdate:(value)=>prompts.push(value)});
  fixture.registration.emit('updatefound');fixture.registration.installing=null;fixture.installing.state='installed';fixture.installing.emit('statechange');
  assert.equal(prompts.length,1);assert.equal(typeof prompts[0].activateWhenSafe,'function');
});

test('fetch policy bypasses every private, authenticated, mutable, or nonallowlisted request', () => {
  const allowed=PUBLIC_PATHS.find((path)=>path.endsWith('styles.css'));
  assert.equal(shouldHandleRequest({url:`https://example.test${allowed}`,method:'GET',headers:{}}),true);
  for(const request of [
    {url:'blob:https://example.test/id',method:'GET'}, {url:'data:text/plain,secret',method:'GET'},
    {url:`https://example.test${allowed}`,method:'POST'}, {url:`https://example.test${allowed}?download=1`,method:'GET'},
    {url:'https://example.test/my-avatars/downloads/avatar.png',method:'GET'},
    {url:'https://example.test/my-avatars/generated/avatar.png',method:'GET'},
    {url:'https://example.test/my-avatars/workshop/index.html',method:'GET'},
    {url:'https://example.test/my-avatars/private.txt',method:'GET'},
    {url:'https://example.test/my-avatars/index.html',method:'GET',headers:{Authorization:'Bearer private'}},
  ]) assert.equal(shouldHandleRequest(request),false,request.url);
});

test('worker source is cache-only policy code and never opens or deletes IndexedDB', async () => {
  const worker=await read('sw.js'), source=`${worker}\n${await read('src/pwa/app-shell.js')}`;
  assert.doesNotMatch(source,/indexedDB|deleteDatabase|\.databases\s*\(/i);
  assert.match(source,/installCompleteShell/);
  assert.match(source,/ACTIVATE_UPDATE/);
  assert.match(source,/CACHE_PREFIX/);
  const installBlock=worker.slice(worker.indexOf("addEventListener('install'"),worker.indexOf("addEventListener('message'"));
  assert.doesNotMatch(installBlock,/skipWaiting\s*\(/);
});

test('Pages workflow stages only checked-in allowlisted files and never uploads repository root', async () => {
  const [allowlist,workflow,stager]=await Promise.all([read('deploy/pages-allowlist.txt'),read('.github/workflows/deploy-pages.yml'),read('deploy/stage-pages.sh')]);
  assert.match(workflow,/mktemp -d/); assert.match(stager,/pages-allowlist\.txt/); assert.doesNotMatch(workflow,/path:\s*\.(?:\s|$)/m);
  assert.match(workflow,/path:\s*\$\{\{\s*steps\.stage\.outputs\.path\s*\}\}/);
  assert.doesNotMatch(workflow,/^\s*push:/m);
  assert.match(workflow,/stage-pages\.sh/);assert.doesNotMatch(workflow,/\bcp\s+['"]?\$?path/);
  assert.match(stager,/git diff --quiet/);assert.match(stager,/git diff --cached --quiet/);assert.match(stager,/git ls-tree/);assert.match(stager,/git cat-file blob/);assert.doesNotMatch(stager,/\bcp\b/);
  assert.doesNotMatch(allowlist,/(face-comparison|mark|personal|generated|screenshots?|^tests\/|^docs\/|private)/im);
  for(const path of allowlist.split(/\r?\n/).filter(Boolean)){const info=await lstat(new URL(path,root));assert.equal(info.isFile(),true,path);assert.equal(info.isSymbolicLink(),false,path);}
});

test('Pages stager uses committed blobs and rejects dirty allowlisted symlinks or bytes',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'my-avatars-stage-')),stageScript=await read('deploy/stage-pages.sh');
  await mkdir(path.join(directory,'deploy'));await writeFile(path.join(directory,'deploy/stage-pages.sh'),stageScript,{mode:0o755});await writeFile(path.join(directory,'deploy/pages-allowlist.txt'),'public.txt\n');await writeFile(path.join(directory,'public.txt'),'committed');
  const git=(args)=>exec('git',args,{cwd:directory});await git(['init']);await git(['config','user.email','test@example.invalid']);await git(['config','user.name','Test']);await git(['add','.']);await git(['commit','-m','fixture']);
  const cleanStage=path.join(directory,'stage-clean');await exec('bash',['deploy/stage-pages.sh',cleanStage],{cwd:directory});assert.equal(await readFile(path.join(cleanStage,'public.txt'),'utf8'),'committed');
  await unlink(path.join(directory,'public.txt'));await writeFile(path.join(directory,'private.txt'),'private');await symlink('private.txt',path.join(directory,'public.txt'));await assert.rejects(exec('bash',['deploy/stage-pages.sh',path.join(directory,'stage-link')],{cwd:directory}));
  await unlink(path.join(directory,'public.txt'));await writeFile(path.join(directory,'public.txt'),'private mutation');await assert.rejects(exec('bash',['deploy/stage-pages.sh',path.join(directory,'stage-dirty')],{cwd:directory}));
});

test('manifest and registration use the exact Pages scope and expose user-controlled update UI',async()=>{
  const [manifestSource,html,app]=await Promise.all([read('manifest.webmanifest'),read('index.html'),read('app.js')]), manifest=JSON.parse(manifestSource);
  assert.equal(manifest.id,'/my-avatars/'); assert.equal(manifest.scope,'/my-avatars/'); assert.equal(manifest.start_url,'/my-avatars/#/studio'); assert.equal(manifest.display,'standalone');
  assert.deepEqual(manifest.icons,[{src:'/my-avatars/icons/my-avatars.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]);
  assert.match(html,/rel="manifest" href="manifest\.webmanifest"/); assert.match(html,/id="pwa-update-notice"[^>]*role="status"[^>]*hidden/); assert.match(html,/id="reload-update"/);
  assert.match(app,/addEventListener\(['"]load['"]/); assert.match(app,/import\(['"]\.\/src\/pwa\/register-service-worker\.js['"]\)/); assert.match(app,/session\.getUpdateSafety/); assert.doesNotMatch(app,/let hasUnsavedDraft|const migrationInProgress/);
});
