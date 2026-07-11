import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { createAvatarKernel } from '../../src/avatar-kernel/kernel.js';
import { createRobloxClassicCompiler, createRobloxLocalPreflight, validateRobloxPackageManifest } from '../../src/compilers/roblox-classic/compiler.js';
import { createStoredZip } from '../../src/compilers/roblox-classic/package.js';
import { REGION_GROUPS } from '../../src/compilers/roblox-classic/template-v1.js';
import { canonicalJson } from '../../src/domain/canonical-json.js';

const u16 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
const u32 = (bytes, offset) => new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
const set16 = (bytes, offset, value) => new DataView(bytes.buffer, bytes.byteOffset + offset, 2).setUint16(0, value, true);
const set32 = (bytes, offset, value) => new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value, true);
const insertBytes = (bytes, offset, inserted) => {
  const result = new Uint8Array(bytes.length + inserted.length);
  result.set(bytes.subarray(0, offset)); result.set(inserted, offset); result.set(bytes.subarray(offset), offset + inserted.length);
  return result;
};
const addFirstCentralVariable = (bytes, fieldOffset, privateBytes) => {
  const endOffset = bytes.length - 22, centralOffset = u32(bytes, endOffset + 16), nameLength = u16(bytes, centralOffset + 28);
  const changed = insertBytes(bytes, centralOffset + 46 + nameLength, privateBytes), changedEnd = endOffset + privateBytes.length;
  set16(changed, centralOffset + fieldOffset, privateBytes.length);
  set32(changed, changedEnd + 12, u32(bytes, endOffset + 12) + privateBytes.length);
  return changed;
};
const parseZip = (bytes) => {
  const entries = []; let offset = 0; const decoder = new TextDecoder();
  while (u32(bytes, offset) === 0x04034b50) {
    const size = u32(bytes, offset + 18), nameLength = u16(bytes, offset + 26), extraLength = u16(bytes, offset + 28);
    const name = decoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength)); const start = offset + 30 + nameLength + extraLength;
    entries.push({ name, bytes: bytes.slice(start, start + size), crc: u32(bytes, offset + 14) }); offset = start + size;
  }
  return entries;
};
const decodePngIndependent = (png) => {
  let offset = 8, width, height; const idat = [];
  while (offset < png.length) { const length = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0); const type = new TextDecoder().decode(png.slice(offset+4,offset+8)); const data=png.slice(offset+8,offset+8+length); if(type==='IHDR'){width=new DataView(data.buffer,data.byteOffset,8).getUint32(0);height=new DataView(data.buffer,data.byteOffset,8).getUint32(4);} if(type==='IDAT')idat.push(data); offset += 12+length; }
  const compressed = new Uint8Array(idat.reduce((n,a)=>n+a.length,0)); let at=0; for(const part of idat){compressed.set(part,at);at+=part.length;} const scan=inflateSync(compressed); const rgba=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++){assert.equal(scan[y*(width*4+1)],0);rgba.set(scan.subarray(y*(width*4+1)+1,y*(width*4+1)+1+width*4),y*width*4);} return {width,height,rgba};
};
const inAnyRegion = (x,y) => Object.values(REGION_GROUPS).some((group)=>Object.values(group).some(([rx,ry,w,h])=>x>=rx&&x<rx+w&&y>=ry&&y<ry+h));

test('compiles deterministic exact four-entry privacy-safe Roblox Classic package', async () => {
  const kernel=createAvatarKernel(), snapshot=await kernel.snapshot(kernel.start().value), compiler=createRobloxClassicCompiler();
  const first=await compiler.compile({snapshot,profile:{blockAvatarNoticeAccepted:true}}), second=await compiler.compile({snapshot,profile:{blockAvatarNoticeAccepted:true}});
  assert.equal(first.ok,true); assert.deepEqual(first,second); assert.equal(first.value.compiler,'roblox-classic-v1'); assert.equal(first.value.artifacts.length,1);
  const artifact=first.value.artifacts[0]; assert.equal(artifact.filename,'my-avatar-roblox-classic.zip'); assert.equal(artifact.mediaType,'application/zip');
  const entries=parseZip(artifact.bytes); assert.deepEqual(entries.map(({name})=>name),['README.txt','manifest.json','my-avatar-roblox-pants.png','my-avatar-roblox-shirt.png']);
  for(const name of ['my-avatar-roblox-shirt.png','my-avatar-roblox-pants.png']){const decoded=decodePngIndependent(entries.find((entry)=>entry.name===name).bytes);assert.deepEqual([decoded.width,decoded.height],[585,559]);let mapped=0;for(let y=0;y<559;y++)for(let x=0;x<585;x++){const alpha=decoded.rgba[(y*585+x)*4+3];if(inAnyRegion(x,y)){assert.ok(alpha>0);mapped++;}else assert.equal(alpha,0);}assert.ok(mapped>0);}
  const manifest=JSON.parse(new TextDecoder().decode(entries.find(({name})=>name==='manifest.json').bytes));
  assert.equal(manifest.recipeRevision,snapshot.recipeRevision); assert.equal(manifest.identityRevision,snapshot.identityRevision); assert.equal(manifest.sourceDigest,snapshot.sourceDigest); assert.equal(manifest.externalStatus,'not-submitted');
  assert.deepEqual(Object.keys(manifest.semanticSummary),['bottom','footwear','outerwear','top']); assert.doesNotMatch(JSON.stringify(manifest),/photo|provenance|face|hair|credential/i);
  assert.equal(manifest.localPreflight.passed,true); assert.equal(manifest.localPreflight.checks.length,6);
  assert.deepEqual(manifest.localPreflight.checks.map(({id})=>id),['shirt-dimensions','shirt-required-regions','shirt-transparent-outside','pants-dimensions','pants-required-regions','pants-transparent-outside']);
  assert.ok(manifest.localPreflight.checks.every((item)=>Object.keys(item).join(',')==='id,message,passed'&&item.passed&&item.message.length>0));
  const readme=new TextDecoder().decode(entries.find(({name})=>name==='README.txt').bytes); for(const line of ['Unzip the My Avatars package locally.','Upload the shirt and pants images separately','Do not upload manifest.json or README.txt.','does not create a Classic T-shirt or ShirtGraphic','Test the candidates on a Block Avatar in Studio.','Many modern or user-generated bodies','Hair, faces, accessories, bodies, upload, moderation, fees, and publication']) assert.match(readme,new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
  assert.doesNotMatch(`${readme}\n${JSON.stringify(manifest)}`,/accepted|approved|roblox-valid|works with roblox avatars|one-click|universal|marketplace acceptance|free publication|password|api key/i);
  assert.equal((await compiler.preflight(first.value)).passed,true);
});

test('pins synthetic shirt and pants full-pixel digests and rejects bad compile inputs', async () => {
  const golden=JSON.parse(await readFile(new URL('../fixtures/roblox/golden-v1.json',import.meta.url))); const kernel=createAvatarKernel(), snapshot=await kernel.snapshot(kernel.start().value), compiler=createRobloxClassicCompiler();
  const result=await compiler.compile({snapshot,profile:{blockAvatarNoticeAccepted:true}}); const entries=parseZip(result.value.artifacts[0].bytes); const pngs=entries.filter(({name})=>name.endsWith('.png')); assert.deepEqual(pngs.map(({name,bytes})=>[name,bytes.length]),golden.pngByteLengths);
  assert.deepEqual(pngs.map(({name,bytes})=>[name,createHash('sha256').update(decodePngIndependent(bytes).rgba).digest('hex')]),golden.decodedRgbaSha256);
  assert.equal((await compiler.compile({snapshot,profile:{blockAvatarNoticeAccepted:false}})).fault.kind,'invalid-profile');
  assert.equal((await compiler.compile({snapshot,profile:{blockAvatarNoticeAccepted:true},extra:true})).fault.kind,'invalid-snapshot');
});

test('preflight isolates corruption without affecting a later valid bundle', async () => {
  const kernel=createAvatarKernel(), snapshot=await kernel.snapshot(kernel.start().value), compiler=createRobloxClassicCompiler(), compiled=await compiler.compile({snapshot,profile:{blockAvatarNoticeAccepted:true}}); const corrupt=structuredClone(compiled.value); corrupt.artifacts[0].bytes[40]^=255;
  assert.equal((await compiler.preflight(corrupt)).passed,false); assert.equal((await compiler.preflight(compiled.value)).passed,true);
});

test('preflight rejects a CRC-valid package whose manifest filenames are inconsistent', async () => {
  const kernel=createAvatarKernel(), snapshot=await kernel.snapshot(kernel.start().value), compiler=createRobloxClassicCompiler(), compiled=await compiler.compile({snapshot,profile:{blockAvatarNoticeAccepted:true}});
  const entries=parseZip(compiled.value.artifacts[0].bytes), manifestEntry=entries.find(({name})=>name==='manifest.json'), manifest=JSON.parse(new TextDecoder().decode(manifestEntry.bytes)); manifest.files[0].filename='wrong.png';
  const tampered=structuredClone(compiled.value); tampered.artifacts[0].bytes=createStoredZip(entries.map(({name,bytes})=>({name,bytes:name==='manifest.json'?new TextEncoder().encode(canonicalJson(manifest)):bytes})));
  assert.equal((await compiler.preflight(tampered)).passed,false);
});

test('preflight rejects CRC-valid size-adjusted ZIP metadata channels and noncanonical fixed fields', async () => {
  const kernel=createAvatarKernel(), snapshot=await kernel.snapshot(kernel.start().value), compiler=createRobloxClassicCompiler(), compiled=await compiler.compile({snapshot,profile:{blockAvatarNoticeAccepted:true}}), original=compiled.value.artifacts[0].bytes;
  const endOffset=original.length-22, centralOffset=u32(original,endOffset+16);
  const mutations=[
    addFirstCentralVariable(original,30,new TextEncoder().encode('private-extra')),
    addFirstCentralVariable(original,32,new TextEncoder().encode('private-comment')),
    [4,21], [6,1],
    [centralOffset+4,21], [centralOffset+6,21], [centralOffset+8,1], [centralOffset+34,1], [centralOffset+36,1], [centralOffset+38,1],
    [endOffset+4,1], [endOffset+6,1], [endOffset+8,3],
  ].map((mutation)=>Array.isArray(mutation)?(()=>{const changed=original.slice();set16(changed,mutation[0],mutation[1]);return changed;})():mutation);
  for(const bytes of mutations){const tampered=structuredClone(compiled.value);tampered.artifacts[0].bytes=bytes;assert.equal((await compiler.preflight(tampered)).passed,false);}
});

test('local preflight reports real independent dimension, region, and outside-alpha checks', async () => {
  const kernel=createAvatarKernel(), snapshot=await kernel.snapshot(kernel.start().value), compiler=createRobloxClassicCompiler(), compiled=await compiler.compile({snapshot,profile:{blockAvatarNoticeAccepted:true}}), entries=parseZip(compiled.value.artifacts[0].bytes);
  const shirt=decodePngIndependent(entries.find(({name})=>name==='my-avatar-roblox-shirt.png').bytes), pants=decodePngIndependent(entries.find(({name})=>name==='my-avatar-roblox-pants.png').bytes);
  const valid=createRobloxLocalPreflight(shirt,pants); assert.equal(valid.passed,true);
  shirt.rgba[(0*585+0)*4+3]=255;
  const outside=createRobloxLocalPreflight(shirt,pants); assert.equal(outside.passed,false); assert.equal(outside.checks.find(({id})=>id==='shirt-transparent-outside').passed,false);
  const [x,y]=REGION_GROUPS.torso.front; shirt.rgba[(y*585+x)*4+3]=0;
  const missing=createRobloxLocalPreflight(shirt,pants); assert.equal(missing.checks.find(({id})=>id==='shirt-required-regions').passed,false);
});

test('closed manifest validator and package preflight reject nested private or decorated fields', async () => {
  const kernel=createAvatarKernel(), snapshot=await kernel.snapshot(kernel.start().value), compiler=createRobloxClassicCompiler(), compiled=await compiler.compile({snapshot,profile:{blockAvatarNoticeAccepted:true}}), entries=parseZip(compiled.value.artifacts[0].bytes), manifest=JSON.parse(new TextDecoder().decode(entries.find(({name})=>name==='manifest.json').bytes));
  assert.equal(validateRobloxPackageManifest(manifest),manifest);
  for(const mutate of [
    (value)=>{value.semanticSummary.top.embedding='private';},
    (value)=>{value.semanticSummary.photoId='photo-1';},
    (value)=>{value.files[0].blob='private';},
    (value)=>{value.localPreflight.checks[0].focus={};},
  ]){const changed=structuredClone(manifest);mutate(changed);assert.throws(()=>validateRobloxPackageManifest(changed));const tampered=structuredClone(compiled.value);tampered.artifacts[0].bytes=createStoredZip(entries.map(({name,bytes})=>({name,bytes:name==='manifest.json'?new TextEncoder().encode(canonicalJson(changed)):bytes})));assert.equal((await compiler.preflight(tampered)).passed,false);}
  const symbol=structuredClone(manifest);symbol.semanticSummary.top[Symbol('mask')]=true;assert.throws(()=>validateRobloxPackageManifest(symbol));
  const hidden=structuredClone(manifest);Object.defineProperty(hidden.files[0],'rawPhoto',{value:true});assert.throws(()=>validateRobloxPackageManifest(hidden));
  const accessor=structuredClone(manifest);Object.defineProperty(accessor.semanticSummary,'outerwear',{enumerable:true,get:()=>false});assert.throws(()=>validateRobloxPackageManifest(accessor));
});
