import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createOptionalMinecraftViewerController } from '../../src/pwa/optional-viewer.js';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('viewer exposes the renamed Minecraft API without remote dependencies', async () => {
  const source = await read('viewer.js');
  const viewer = await import('../../viewer.js');

  assert.equal(typeof viewer.createMinecraftAvatarViewer, 'function');
  assert.doesNotMatch(source, /createSkinViewer|updateSkin/);
  assert.doesNotMatch(source, /https?:\/\//);
  assert.doesNotMatch(source, /import\s*\(/);
  await assert.rejects(
    viewer.createMinecraftAvatarViewer({}, {}),
    /self-hosted Three\.js viewer dependencies are not installed/,
  );
});

test('the optional viewer is lazy and has an accessible nonblocking fallback', async () => {
  const [app, html] = await Promise.all([read('app.js'), read('index.html')]);

  assert.match(app, /import\(['"]\.\/viewer\.js['"]\)/);
  assert.doesNotMatch(app, /^import .*from ['"]\.\/viewer\.js['"]/m);
  assert.match(app, /minecraft-texture-image[\s\S]*addEventListener\(['"]load['"]/);
  assert.match(html, /id="minecraft-avatar-viewer"[^>]*hidden/);
  assert.match(html, /id="minecraft-viewer-notice"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden/);
});

test('viewer controller disposes stale pending loads and current viewers when texture URL changes',async()=>{
  const pending=[];let shown=0,hidden=0;
  const controller=createOptionalMinecraftViewerController({load:(texture,slim)=>new Promise((resolve)=>pending.push({texture,slim,resolve})),show:()=>shown++,hide:()=>hidden++,unavailable:()=>{}});
  controller.setTextureUrl('blob:first');const first=controller.loadTexture({},'blob:first',false);controller.setTextureUrl(null);
  const stale={disposeCalls:0,dispose(){this.disposeCalls++;},updateMinecraftTexture(){},setSlim(){}};pending.shift().resolve(stale);await first;assert.equal(stale.disposeCalls,1);assert.equal(shown,0);
  controller.setTextureUrl('blob:second');const second=controller.loadTexture({},'blob:second',false);const live={disposeCalls:0,dispose(){this.disposeCalls++;},updateMinecraftTexture(){},setSlim(){}};pending.shift().resolve(live);await second;assert.equal(shown,1);
  controller.setTextureUrl('blob:third');assert.equal(live.disposeCalls,1);assert.ok(hidden>=3);
});

test('concurrent same-URL viewer loads use unique tokens and dispose reverse-resolved stale candidates once',async()=>{
  const pending=[],controller=createOptionalMinecraftViewerController({load:()=>new Promise((resolve)=>pending.push(resolve)),show(){},hide(){},unavailable(){}}),candidate=()=>({disposed:0,dispose(){this.disposed++;},updateMinecraftTexture(){},setSlim(){}});
  controller.setTextureUrl('blob:same');const first=controller.loadTexture({},'blob:same',false),second=controller.loadTexture({},'blob:same',false),newest=candidate(),oldest=candidate();pending[1](newest);await second;pending[0](oldest);await first;
  assert.equal(oldest.disposed,1);assert.equal(newest.disposed,0);controller.setTextureUrl(null);assert.equal(newest.disposed,1);
});

test('viewer render loop guards disposal and cancels its scheduled animation frame',async()=>{
  const source=await read('viewer.js');assert.match(source,/let disposed = false/);assert.match(source,/if \(disposed\) return/);assert.match(source,/cancelFrame\(frameHandle\)/);assert.match(source,/disposed = true[\s\S]*cancelFrame/);
});

test('app drives viewer invalidation from session renders and guards pending loads by URL',async()=>{
  const app=await read('app.js');assert.match(app,/session\.subscribe\([\s\S]*setTextureUrl/);assert.match(app,/loadTexture\(minecraftTextureImage, url/);assert.doesNotMatch(app,/let minecraftViewerLoad|let minecraftViewer =/);
});
