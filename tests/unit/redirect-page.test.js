import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const html=await readFile(new URL('../../compat/minecraft/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

const redirect=(hash,search='?private=1')=>{let target=null;vm.runInNewContext(script,{location:{hash,search,replace(value){target=value;}}});return target;};

test('old Minecraft page maps only the three recognized hashes and drops query parameters',()=>{
  assert.equal(redirect('#/solid'),'/my-avatars/#/studio');
  assert.equal(redirect('#/solid/library'),'/my-avatars/#/library');
  assert.equal(redirect('#/experimental'),'/my-avatars/#/experimental/capture');
  assert.equal(redirect(''),'/my-avatars/#/studio');
  assert.equal(redirect('#/unknown'),'/my-avatars/#/studio');
  assert.ok(!redirect('#/solid','?token=secret').includes('?'));
});

test('compatibility page is static, accessible, and performs no remote work',()=>{
  assert.match(html,/<!doctype html>/i); assert.match(html,/My Avatars/); assert.match(html,/Redirecting/);
  assert.doesNotMatch(html,/<script[^>]+src=|https?:\/\/|fetch\s*\(|XMLHttpRequest|indexedDB/i);
});
