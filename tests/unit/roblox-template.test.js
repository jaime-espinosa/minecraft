import test from 'node:test';
import assert from 'node:assert/strict';

import { ROBLOX_CLASSIC_TEMPLATE_V1, REGION_GROUPS, allRobloxRegions } from '../../src/compilers/roblox-classic/template-v1.js';

const expected = {
  torso: { up:[231,8,128,64], right:[165,74,64,128], front:[231,74,128,128], left:[361,74,64,128], back:[427,74,128,128], down:[231,204,128,64] },
  rightLimb: { up:[217,289,64,64], left:[19,355,64,128], back:[85,355,64,128], right:[151,355,64,128], front:[217,355,64,128], down:[217,485,64,64] },
  leftLimb: { up:[308,289,64,64], front:[308,355,64,128], left:[374,355,64,128], back:[440,355,64,128], right:[506,355,64,128], down:[308,485,64,64] },
};

test('pins exact official provenance without redistributing template media', () => {
  assert.deepEqual(ROBLOX_CLASSIC_TEMPLATE_V1.provenance, {
    officialSource:'https://create.roblox.com/docs/avatar/classic-clothing', verifiedDate:'2026-07-11',
    creatorDocsCommit:'4efde174e15740740cf2a5dddeec53075db618fe',
    shirtLfsSha256:'c87e4dfbc6cbee15e7f7283a74983f3762b715b1b366c0514754316474697d8c',
    pantsLfsSha256:'c57244d5bb9605f1e3b7de245c201666741b0fb147905703f3371c0aef17c73b',
  });
  assert.deepEqual(ROBLOX_CLASSIC_TEMPLATE_V1.dimensions, { width:585, height:559 });
  assert.equal(ROBLOX_CLASSIC_TEMPLATE_V1.version, 'roblox-classic-template-v1');
  assert.equal(ROBLOX_CLASSIC_TEMPLATE_V1.rules.coordinates, 'my-avatars-product-check');
  assert.equal(ROBLOX_CLASSIC_TEMPLATE_V1.rules.workflow, 'roblox-documented');
});

test('pins every half-open rectangle within the 585 by 559 canvas', () => {
  assert.deepEqual(REGION_GROUPS, expected);
  const regions = allRobloxRegions(); assert.equal(regions.length, 18);
  for (const { rectangle:[x,y,width,height] } of regions) {
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 585 && y + height <= 559);
  }
});
