export const FACE_NAMES = Object.freeze(['right', 'left', 'top', 'bottom', 'front', 'back']);
export const BASE_PARTS = Object.freeze(['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg']);
export const OUTER_PARTS = Object.freeze(['hat', 'jacket', 'rightSleeve', 'leftSleeve', 'rightPants', 'leftPants']);

const region = (x, y, width, height) => ({ x, y, width, height });
const faces = (right, left, top, bottom, front, back) => ({ right, left, top, bottom, front, back });

const fixedParts = {
  head: { faces: faces(region(0, 8, 8, 8), region(16, 8, 8, 8), region(8, 0, 8, 8), region(16, 0, 8, 8), region(8, 8, 8, 8), region(24, 8, 8, 8)) },
  hat: { faces: faces(region(32, 8, 8, 8), region(48, 8, 8, 8), region(40, 0, 8, 8), region(48, 0, 8, 8), region(40, 8, 8, 8), region(56, 8, 8, 8)) },
  body: { faces: faces(region(16, 20, 4, 12), region(28, 20, 4, 12), region(20, 16, 8, 4), region(28, 16, 8, 4), region(20, 20, 8, 12), region(32, 20, 8, 12)) },
  jacket: { faces: faces(region(16, 36, 4, 12), region(28, 36, 4, 12), region(20, 32, 8, 4), region(28, 32, 8, 4), region(20, 36, 8, 12), region(32, 36, 8, 12)) },
  rightLeg: { faces: faces(region(0, 20, 4, 12), region(8, 20, 4, 12), region(4, 16, 4, 4), region(8, 16, 4, 4), region(4, 20, 4, 12), region(12, 20, 4, 12)) },
  leftLeg: { faces: faces(region(16, 52, 4, 12), region(24, 52, 4, 12), region(20, 48, 4, 4), region(24, 48, 4, 4), region(20, 52, 4, 12), region(28, 52, 4, 12)) },
  rightPants: { faces: faces(region(0, 36, 4, 12), region(8, 36, 4, 12), region(4, 32, 4, 4), region(8, 32, 4, 4), region(4, 36, 4, 12), region(12, 36, 4, 12)) },
  leftPants: { faces: faces(region(0, 52, 4, 12), region(8, 52, 4, 12), region(4, 48, 4, 4), region(8, 48, 4, 4), region(4, 52, 4, 12), region(12, 52, 4, 12)) },
};

const classicArms = {
  rightArm: { faces: faces(region(40, 20, 4, 12), region(48, 20, 4, 12), region(44, 16, 4, 4), region(48, 16, 4, 4), region(44, 20, 4, 12), region(52, 20, 4, 12)) },
  leftArm: { faces: faces(region(32, 52, 4, 12), region(40, 52, 4, 12), region(36, 48, 4, 4), region(40, 48, 4, 4), region(36, 52, 4, 12), region(44, 52, 4, 12)) },
  rightSleeve: { faces: faces(region(40, 36, 4, 12), region(48, 36, 4, 12), region(44, 32, 4, 4), region(48, 32, 4, 4), region(44, 36, 4, 12), region(52, 36, 4, 12)) },
  leftSleeve: { faces: faces(region(48, 52, 4, 12), region(56, 52, 4, 12), region(52, 48, 4, 4), region(56, 48, 4, 4), region(52, 52, 4, 12), region(60, 52, 4, 12)) },
};

const slimArms = {
  rightArm: { faces: faces(region(40, 20, 4, 12), region(47, 20, 4, 12), region(44, 16, 3, 4), region(47, 16, 3, 4), region(44, 20, 3, 12), region(51, 20, 3, 12)) },
  leftArm: { faces: faces(region(32, 52, 4, 12), region(39, 52, 4, 12), region(36, 48, 3, 4), region(39, 48, 3, 4), region(36, 52, 3, 12), region(43, 52, 3, 12)) },
  rightSleeve: { faces: faces(region(40, 36, 4, 12), region(47, 36, 4, 12), region(44, 32, 3, 4), region(47, 32, 3, 4), region(44, 36, 3, 12), region(51, 36, 3, 12)) },
  leftSleeve: { faces: faces(region(48, 52, 4, 12), region(55, 52, 4, 12), region(52, 48, 3, 4), region(55, 48, 3, 4), region(52, 52, 3, 12), region(59, 52, 3, 12)) },
};

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const makeLayout = (geometry, arms) => deepFreeze({
  version: 'minecraft-layout-v1',
  width: 64,
  height: 64,
  geometry,
  parts: { ...structuredClone(fixedParts), ...structuredClone(arms) },
});

const layouts = {
  classic: makeLayout('classic', classicArms),
  slim: makeLayout('slim', slimArms),
};

export const MINECRAFT_LAYOUT_V1 = deepFreeze(layouts);

export function getMinecraftLayout(profile) {
  const layout = layouts[profile?.geometry];
  if (!layout) throw new TypeError(`Unsupported Minecraft geometry ${JSON.stringify(profile?.geometry)}`);
  return layout;
}

export const rectanglesOverlap = (first, second) => !(
  first.x + first.width <= second.x
  || second.x + second.width <= first.x
  || first.y + first.height <= second.y
  || second.y + second.height <= first.y
);
