import { validateAppearanceSnapshotV1, validateMinecraftProfileV1 } from '../../domain/contracts.js';
import { FACE_NAMES, getMinecraftLayout } from './layout-v1.js';

const rgbaFromHex = (hex) => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
  255,
];

const setPixel = (rgba, x, y, color) => {
  const offset = (y * 64 + x) * 4;
  rgba.set(color, offset);
};

const fill = (rgba, region, color, rowLimit = region.height) => {
  for (let y = region.y; y < region.y + Math.min(region.height, rowLimit); y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) setPixel(rgba, x, y, color);
  }
};

const mix = (first, second) => first.map((channel, index) => (
  index === 3 ? 255 : Math.round((channel + second[index]) / 2)
));

const paletteColor = (palette, face, shading = 'block') => {
  const primary = rgbaFromHex(palette.primary);
  const selected = rgbaFromHex(face === 'top' ? palette.highlight : face === 'front' ? palette.primary : palette.shadow);
  return shading === 'soft' && face !== 'front' ? mix(primary, selected) : selected;
};

const paintPart = (rgba, part, palette, shading) => {
  for (const face of FACE_NAMES) fill(rgba, part.faces[face], paletteColor(palette, face, shading));
};

const paintHair = (rgba, hat, palette, style, volume, shading) => {
  for (const face of FACE_NAMES) {
    const rows = face === 'top' || face === 'bottom' || face === 'back'
      ? hat.faces[face].height
      : style === 'long' ? Math.min(8, 5 + volume) : style === 'curl' ? 2 + volume : style === 'sweep' ? 3 + volume : Math.max(2, volume);
    fill(rgba, hat.faces[face], paletteColor(palette, face, shading), rows);
  }
};

const paintFaceFeatures = (rgba, head, face) => {
  const front = head.faces.front;
  const eye = rgbaFromHex(face.eyeColor);
  setPixel(rgba, front.x + 2, front.y + 3, eye);
  setPixel(rgba, front.x + 5, front.y + 3, eye);
  const mouth = face.expression === 'grin' ? [246, 234, 213, 255] : [86, 45, 47, 255];
  const width = face.expression === 'neutral' ? 2 : 4;
  const start = front.x + (8 - width) / 2;
  for (let x = 0; x < width; x += 1) setPixel(rgba, start + x, front.y + 6, mouth);
};

const paintAccessories = (rgba, head, accessories) => {
  const front = head.faces.front;
  for (const accessory of accessories) {
    const color = rgbaFromHex(accessory.color);
    if (accessory.kind === 'glasses') {
      for (let x = 1; x < 7; x += 1) setPixel(rgba, front.x + x, front.y + 3, color);
      setPixel(rgba, front.x + 1, front.y + 4, color);
      setPixel(rgba, front.x + 6, front.y + 4, color);
    }
    if (accessory.kind === 'beard') {
      for (let x = 1; x < 7; x += 1) setPixel(rgba, front.x + x, front.y + 6, color);
      for (let x = 2; x < 6; x += 1) setPixel(rgba, front.x + x, front.y + 7, color);
    }
  }
};

const paintOutline = (rgba, part) => {
  const front = part.faces.front;
  const color = [20, 20, 30, 255];
  for (let x = front.x; x < front.x + front.width; x += 1) {
    setPixel(rgba, x, front.y, color);
    setPixel(rgba, x, front.y + front.height - 1, color);
  }
  for (let y = front.y; y < front.y + front.height; y += 1) {
    setPixel(rgba, front.x, y, color);
    setPixel(rgba, front.x + front.width - 1, y, color);
  }
};

const paintFootwear = (rgba, part, palette) => {
  const color = rgbaFromHex(palette.primary);
  for (const face of ['right', 'left', 'front', 'back']) {
    const region = part.faces[face];
    fill(rgba, { ...region, y: region.y + region.height - 3, height: 3 }, color);
  }
};

export function paintMinecraftTexture(snapshot, profile) {
  validateAppearanceSnapshotV1(snapshot);
  validateMinecraftProfileV1(profile);
  const layout = getMinecraftLayout(profile);
  const appearance = snapshot.semanticAppearance;
  const shading = appearance.style.shading;
  const rgba = new Uint8Array(64 * 64 * 4);

  paintPart(rgba, layout.parts.head, appearance.complexionPalette, shading);
  paintFaceFeatures(rgba, layout.parts.head, appearance.face);
  paintAccessories(rgba, layout.parts.head, appearance.accessories);
  paintHair(rgba, layout.parts.hat, appearance.hair.palette, appearance.hair.style, appearance.hair.volume, shading);
  paintPart(rgba, layout.parts.body, appearance.outfit.top, shading);
  paintPart(rgba, layout.parts.rightArm, appearance.outfit.top, shading);
  paintPart(rgba, layout.parts.leftArm, appearance.outfit.top, shading);
  paintPart(rgba, layout.parts.rightLeg, appearance.outfit.bottom, shading);
  paintPart(rgba, layout.parts.leftLeg, appearance.outfit.bottom, shading);
  paintFootwear(rgba, layout.parts.rightLeg, appearance.outfit.footwear);
  paintFootwear(rgba, layout.parts.leftLeg, appearance.outfit.footwear);

  if (profile.outerLayers) {
    paintPart(rgba, layout.parts.jacket, appearance.outfit.top, shading);
    paintPart(rgba, layout.parts.rightSleeve, appearance.outfit.top, shading);
    paintPart(rgba, layout.parts.leftSleeve, appearance.outfit.top, shading);
    paintPart(rgba, layout.parts.rightPants, appearance.outfit.bottom, shading);
    paintPart(rgba, layout.parts.leftPants, appearance.outfit.bottom, shading);
    if (appearance.outfit.outerwear) {
      const front = layout.parts.jacket.faces.front;
      fill(rgba, { x: front.x + 3, y: front.y, width: 2, height: front.height }, rgbaFromHex(appearance.outfit.top.highlight));
    }
  }
  if (appearance.style.outline) {
    paintOutline(rgba, layout.parts.head);
    paintOutline(rgba, layout.parts.body);
  }
  return rgba;
}
