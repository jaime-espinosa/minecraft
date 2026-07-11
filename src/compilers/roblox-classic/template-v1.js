const freeze = (value) => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Reflect.ownKeys(value).forEach((key) => freeze(value[key])); Object.freeze(value); } return value; };

export const REGION_GROUPS = freeze({
  torso: { up:[231,8,128,64], right:[165,74,64,128], front:[231,74,128,128], left:[361,74,64,128], back:[427,74,128,128], down:[231,204,128,64] },
  rightLimb: { up:[217,289,64,64], left:[19,355,64,128], back:[85,355,64,128], right:[151,355,64,128], front:[217,355,64,128], down:[217,485,64,64] },
  leftLimb: { up:[308,289,64,64], front:[308,355,64,128], left:[374,355,64,128], back:[440,355,64,128], right:[506,355,64,128], down:[308,485,64,64] },
});

export const ROBLOX_CLASSIC_TEMPLATE_V1 = freeze({
  version: 'roblox-classic-template-v1', compilerVersion: 'roblox-classic-v1', dimensions: { width:585, height:559 },
  provenance: {
    officialSource:'https://create.roblox.com/docs/avatar/classic-clothing', verifiedDate:'2026-07-11',
    creatorDocsCommit:'4efde174e15740740cf2a5dddeec53075db618fe',
    shirtLfsSha256:'c87e4dfbc6cbee15e7f7283a74983f3762b715b1b366c0514754316474697d8c',
    pantsLfsSha256:'c57244d5bb9605f1e3b7de245c201666741b0fb147905703f3371c0aef17c73b',
  },
  rules: { workflow:'roblox-documented', coordinates:'my-avatars-product-check', alpha:'my-avatars-product-check', colors:'my-avatars-product-check', localPreflight:'my-avatars-product-check' },
  regions: REGION_GROUPS,
});

export const allRobloxRegions = () => Object.entries(REGION_GROUPS).flatMap(([group, faces]) => Object.entries(faces).map(([face, rectangle]) => ({ group, face, rectangle:[...rectangle] })));
