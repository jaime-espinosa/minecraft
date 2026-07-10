import { createSkinViewer } from './viewer.js';

const $ = (id) => document.getElementById(id);
const input = $('image-input'), dropZone = $('drop-zone'), sourcePreview = $('source-preview');
const form = $('settings-form'), generateButton = $('generate-button'), canvas = $('skin-canvas'), skinSheetImage = $('skin-sheet-image');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const status = $('status'), resultContent = $('result-content'), placeholder = $('result-placeholder');
const download = $('download-button'), resetButton = $('reset-button'), autoColors = $('auto-colors'), colorGrid = $('color-grid');
const fidelityScore = $('fidelity-score'), fidelityValue = fidelityScore.querySelector('output');
const colorIds = ['skin-color', 'hair-color', 'shirt-color', 'pants-color', 'shoe-color'];
const cropEditor = $('face-crop-editor'), cropPreview = $('face-crop-preview'), cropPreviewCtx = cropPreview.getContext('2d');
const cropX = $('crop-x'), cropY = $('crop-y'), cropZoom = $('crop-zoom'), faceDetectionStatus = $('face-detection-status');
let sourceImage = null, sourceUrl = null, downloadUrl = null;
const crop = { x: .5, y: .42, zoom: 2.2 };
const viewer = createSkinViewer($('viewer'), canvas);

const clamp = (number) => Math.max(0, Math.min(255, Math.round(number)));
const shade = (hex, factor) => {
  const value = hex.replace('#', '');
  return `#${[0, 2, 4].map((i) => clamp(parseInt(value.slice(i, i + 2), 16) * factor).toString(16).padStart(2, '0')).join('')}`;
};
const hex = ([r, g, b]) => `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
function setStatus(message, state = '') { status.textContent = message; status.dataset.state = state; }
function fill(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

function paintBox(faces, color) {
  fill(faces.right[0], faces.right[1], faces.right[2], faces.right[3], shade(color, .74));
  fill(faces.left[0], faces.left[1], faces.left[2], faces.left[3], shade(color, .84));
  fill(faces.top[0], faces.top[1], faces.top[2], faces.top[3], shade(color, 1.08));
  fill(faces.bottom[0], faces.bottom[1], faces.bottom[2], faces.bottom[3], shade(color, .63));
  fill(faces.front[0], faces.front[1], faces.front[2], faces.front[3], color);
  fill(faces.back[0], faces.back[1], faces.back[2], faces.back[3], shade(color, .82));
}
function box(x, y, frontW, height, depth) { return { right:[x,y + depth,depth,height], front:[x + depth,y + depth,frontW,height], left:[x + depth + frontW,y + depth,depth,height], back:[x + depth + frontW + depth,y + depth,frontW,height], top:[x + depth,y,frontW,depth], bottom:[x + depth + frontW,y,frontW,depth] }; }
function average(data, region) {
  const values = [[], [], []];
  for (let y = region.y; y < region.y + region.h; y += 2) for (let x = region.x; x < region.x + region.w; x += 2) {
    const offset = (y * 32 + x) * 4; if (data[offset + 3] > 100) values.forEach((list, index) => list.push(data[offset + index]));
  }
  return hex(values.map((list) => { list.sort((a,b) => a - b); return list[Math.floor(list.length / 2)] || 100; }));
}
function drawCrop(target, size) {
  const side = Math.min(sourceImage.naturalWidth, sourceImage.naturalHeight) / crop.zoom;
  const sx = Math.max(0, Math.min(sourceImage.naturalWidth - side, sourceImage.naturalWidth * crop.x - side / 2));
  const sy = Math.max(0, Math.min(sourceImage.naturalHeight - side, sourceImage.naturalHeight * crop.y - side / 2));
  target.drawImage(sourceImage, sx, sy, side, side, 0, 0, size, size);
}
function updateCropPreview() { if (!sourceImage) return; cropPreviewCtx.clearRect(0, 0, 160, 160); drawCrop(cropPreviewCtx, 160); }
function paletteFromImage() {
  const tiny = document.createElement('canvas'); tiny.width = tiny.height = 32;
  const tinyCtx = tiny.getContext('2d', { willReadFrequently: true }); drawCrop(tinyCtx, 32);
  const facePixels = tinyCtx.getImageData(0, 0, 32, 32).data;
  const full = document.createElement('canvas'); full.width = full.height = 32;
  const fullCtx = full.getContext('2d', { willReadFrequently: true });
  const side = Math.min(sourceImage.naturalWidth, sourceImage.naturalHeight);
  fullCtx.drawImage(sourceImage, (sourceImage.naturalWidth - side) / 2, (sourceImage.naturalHeight - side) / 2, side, side, 0, 0, 32, 32);
  const fullPixels = fullCtx.getImageData(0, 0, 32, 32).data;
  return { skin:average(facePixels,{x:9,y:10,w:14,h:12}), hair:average(facePixels,{x:7,y:1,w:18,h:9}), shirt:average(fullPixels,{x:8,y:19,w:16,h:8}), pants:average(fullPixels,{x:5,y:27,w:8,h:5}), shoes:average(fullPixels,{x:4,y:30,w:10,h:2}), tiny };
}
function paintFace(palette) {
  const hair = palette.hair, feature = '#24201e', smile = shade(hair, .65);
  fill(9, 10, 2, 1, hair); fill(13, 10, 2, 1, hair);
  fill(9, 11, 1, 1, feature); fill(14, 11, 1, 1, feature);
  fill(11, 12, 2, 1, shade(palette.skin, .62));
  const expression = $('expression').value;
  if (expression === 'smile') fill(10, 14, 4, 1, smile);
  if (expression === 'grin') { fill(10, 13, 4, 1, '#f6ead5'); fill(10, 14, 4, 1, smile); }
  if (expression === 'neutral') fill(11, 14, 2, 1, smile);
  fill(8, 15, 8, 1, shade(palette.shirt, .62));
  const accessory = $('accessory').value;
  if (accessory === 'glasses') { fill(8, 11, 8, 1, '#26272a'); fill(9, 12, 2, 1, '#b8d5d0'); fill(13, 12, 2, 1, '#b8d5d0'); }
  if (accessory === 'beard') { fill(9, 14, 6, 2, shade(hair, .78)); fill(8, 14, 1, 1, shade(hair, .78)); }
}
function colorScore(actual, expected) {
  const distance = Math.abs(actual[0] - expected[0]) + Math.abs(actual[1] - expected[1]) + Math.abs(actual[2] - expected[2]);
  return 1 - distance / 765;
}
function rgbFromHex(value) { const hexValue = value.replace('#', ''); return [0, 2, 4].map((index) => parseInt(hexValue.slice(index, index + 2), 16)); }
function scoreReference(palette) {
  const cells = Array.from({ length: 64 }, () => ({ color: palette.skin, weight: 1 }));
  const set = (x, y, color, weight) => { cells[y * 8 + x] = { color, weight }; };
  [[9,10],[10,10],[13,10],[14,10]].forEach(([x,y]) => set(x - 8, y - 8, palette.hair, 4));
  [[9,11],[14,11]].forEach(([x,y]) => set(x - 8, y - 8, '#24201e', 5));
  [[11,12],[12,12]].forEach(([x,y]) => set(x - 8, y - 8, shade(palette.skin, .62), 3));
  [[10,14],[11,14],[12,14],[13,14]].forEach(([x,y]) => set(x - 8, y - 8, shade(palette.hair, .65), 4));
  for (let x = 0; x < 8; x += 1) set(x, 7, shade(palette.shirt, .62), 2);
  const pixels = ctx.getImageData(8, 8, 8, 8).data;
  let total = 0, weighted = 0;
  cells.forEach((cell, index) => { weighted += colorScore(pixels.slice(index * 4, index * 4 + 3), rgbFromHex(cell.color)) * cell.weight; total += cell.weight; });
  const hairPixels = ctx.getImageData(40, 8, 8, 3).data;
  const hairTarget = rgbFromHex(palette.hair);
  for (let index = 0; index < 24; index += 1) { weighted += colorScore(hairPixels.slice(index * 4, index * 4 + 3), hairTarget) * 3; total += 3; }
  return weighted / total;
}
function paintHairOverlay(palette) {
  const color = palette.hair;
  const style = $('hair-style').value;
  const volume = Number($('curl-volume').value);
  const hat = box(32, 0, 8, 8, 8);
  const height = style === 'long' || style === 'curl' ? 3 : 2;
  fill(hat.front[0], hat.front[1], 8, height, color);
  fill(hat.right[0], hat.right[1], 4, style === 'long' || style === 'curl' ? 7 : 5, shade(color, .76));
  fill(hat.left[0], hat.left[1], 4, style === 'long' || style === 'curl' ? 7 : 5, shade(color, .82));
  fill(hat.top[0], hat.top[1], 8, 8, shade(color, 1.06));
  if (palette.tiny) {
    const pixels = palette.tiny.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, 32, 32).data;
    const hairLightness = rgbFromHex(color).reduce((sum, channel) => sum + channel, 0) / 3;
    for (let y = 2; y < 7; y += 1) for (let x = 0; x < 8; x += 1) {
      if (x > 1 && x < 6 && y > 3) continue;
      const offset = ((y * 4 + 2) * 32 + (x * 4 + 2)) * 4;
      const lightness = (pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3;
      if (lightness < hairLightness * 1.25) fill(hat.front[0] + x, hat.front[1] + y, 1, 1, x % 2 ? shade(color, .82) : color);
    }
  }
  if (style === 'sweep') fill(hat.front[0] + 4, hat.front[1] + 1, 4, 1, color);
  if (style === 'long') { fill(hat.front[0] + 7, hat.front[1] + 2, 1, 6, color); fill(hat.back[0], hat.back[1], 8, 8, shade(color, .72)); }
  if (style === 'curl') {
    const curls = [[0,2],[1,3],[0,4],[7,2],[6,3],[7,4],[1,1],[6,1],[2,0],[5,0],[0,5],[7,5],[1,4],[6,4]];
    curls.slice(0, volume === 1 ? 8 : volume === 2 ? 12 : curls.length).forEach(([x, y]) => fill(hat.front[0] + x, hat.front[1] + y, 1, 1, x % 2 ? shade(color, .72) : shade(color, 1.12)));
    fill(hat.back[0], hat.back[1], 8, 8, shade(color, .7));
  }
}
function paintOuterLayers(colors) {
  const armWidth = $('slim').checked ? 3 : 4;
  paintBox(box(16, 32, 8, 12, 4), colors.shirt);
  paintBox(box(40, 32, armWidth, 12, 4), colors.shirt);
  paintBox(box(48, 48, armWidth, 12, 4), colors.shirt);
  paintBox(box(0, 32, 4, 12, 4), colors.pants);
  paintBox(box(0, 48, 4, 12, 4), colors.pants);
  fill(4, 45, 4, 3, colors.shoes); fill(4, 61, 4, 3, colors.shoes);
}
function generateSkin() {
  const palette = autoColors.checked ? paletteFromImage() : null;
  const colors = palette ? palette : { skin:$('skin-color').value, hair:$('hair-color').value, shirt:$('shirt-color').value, pants:$('pants-color').value, shoes:$('shoe-color').value, tiny:null };
  if (palette) { const mapping = { 'skin-color':colors.skin, 'hair-color':colors.hair, 'shirt-color':colors.shirt, 'pants-color':colors.pants, 'shoe-color':colors.shoes }; Object.entries(mapping).forEach(([id, value]) => { $(id).value = value; }); }
  ctx.clearRect(0, 0, 64, 64);
  paintBox(box(0,0,8,8,8), colors.skin); paintFace(colors);
  paintBox(box(16,16,8,12,4), colors.shirt); paintBox(box(0,16,4,12,4), colors.pants); paintBox(box(16,48,4,12,4), colors.pants);
  paintBox(box(40,16,$('slim').checked ? 3 : 4,12,4), colors.shirt); paintBox(box(32,48,$('slim').checked ? 3 : 4,12,4), colors.shirt);
  fill(4, 29, 4, 3, colors.shoes); fill(20, 61, 4, 3, colors.shoes);
  paintOuterLayers(colors); paintFace(colors); paintHairOverlay(colors);
  if ($('accessory').value === 'jacket') { fill(20, 36, 8, 12, shade(colors.shirt, .83)); fill(20, 36, 8, 1, shade(colors.shirt, 1.15)); }
  const score = scoreReference(colors); fidelityValue.value = score.toFixed(2); fidelityValue.textContent = score.toFixed(2); fidelityScore.dataset.score = score.toFixed(4); fidelityScore.hidden = false;
  viewer.setSlim($('slim').checked); viewer.updateSkin();
}
function updateDownload() { canvas.toBlob((blob) => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = URL.createObjectURL(blob); download.href = downloadUrl; skinSheetImage.src = downloadUrl; download.hidden = false; }); }
function processFile(file) {
  if (!file || !file.type.startsWith('image/')) { setStatus('Choose a PNG, JPG, WEBP, or GIF image file.', 'error'); return; }
  if (sourceUrl) URL.revokeObjectURL(sourceUrl); sourceUrl = URL.createObjectURL(file); const image = new Image();
  image.onload = () => { sourceImage = image; sourcePreview.src = sourceUrl; sourcePreview.hidden = false; dropZone.classList.add('has-image'); dropZone.querySelectorAll('.upload-prompt').forEach((node) => node.hidden = true); cropEditor.hidden = false; crop.x = .5; crop.y = .42; crop.zoom = 2.2; cropX.value = 50; cropY.value = 42; cropZoom.value = 220; updateCropPreview(); detectFace(); generateButton.disabled = false; setStatus('Portrait ready. Refine the face crop, then forge your skin.'); };
  image.onerror = () => { URL.revokeObjectURL(sourceUrl); sourceUrl = null; setStatus('That image could not be decoded. Try another file.', 'error'); };
  image.src = sourceUrl;
}
input.addEventListener('change', () => processFile(input.files[0]));
['dragenter','dragover'].forEach((event) => dropZone.addEventListener(event, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
['dragleave','drop'].forEach((event) => dropZone.addEventListener(event, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
dropZone.addEventListener('drop', (e) => processFile(e.dataTransfer.files[0]));
autoColors.addEventListener('change', () => colorGrid.classList.toggle('is-auto', autoColors.checked)); colorGrid.classList.add('is-auto');
function applyCropControl() { crop.x = Number(cropX.value) / 100; crop.y = Number(cropY.value) / 100; crop.zoom = Number(cropZoom.value) / 100; updateCropPreview(); }
[cropX, cropY, cropZoom].forEach((control) => control.addEventListener('input', applyCropControl));
async function detectFace() {
  if (!('FaceDetector' in window)) { faceDetectionStatus.textContent = 'Adjust the crop to frame the face.'; return; }
  try {
    const faces = await new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }).detect(sourceImage);
    if (!faces.length) { faceDetectionStatus.textContent = 'No face found. Adjust the crop.'; return; }
    const face = faces[0].boundingBox, minSide = Math.min(sourceImage.naturalWidth, sourceImage.naturalHeight);
    crop.x = (face.x + face.width / 2) / sourceImage.naturalWidth; crop.y = (face.y + face.height / 2) / sourceImage.naturalHeight;
    crop.zoom = Math.max(1.5, Math.min(5, minSide / Math.max(face.width * 2.05, face.height * 2.05)));
    cropX.value = Math.round(crop.x * 100); cropY.value = Math.round(crop.y * 100); cropZoom.value = Math.round(crop.zoom * 100); updateCropPreview(); faceDetectionStatus.textContent = 'Face found. Adjust if needed.';
  } catch { faceDetectionStatus.textContent = 'Adjust the crop to frame the face.'; }
}
form.addEventListener('submit', (event) => { event.preventDefault(); if (!sourceImage) return; generateButton.disabled = true; setStatus('Forging your skin...', 'working'); requestAnimationFrame(() => { generateSkin(); updateDownload(); placeholder.hidden = true; resultContent.hidden = false; resetButton.hidden = false; generateButton.disabled = false; setStatus('Skin forged. Rotate your player, then download the PNG.'); }); });
$('view-reset').addEventListener('click', () => viewer.resetView());
resetButton.addEventListener('click', () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); if (downloadUrl) URL.revokeObjectURL(downloadUrl); sourceUrl = downloadUrl = null; sourceImage = null; input.value = ''; sourcePreview.hidden = true; sourcePreview.removeAttribute('src'); skinSheetImage.removeAttribute('src'); cropEditor.hidden = true; fidelityScore.hidden = true; fidelityScore.removeAttribute('data-score'); dropZone.classList.remove('has-image'); dropZone.querySelectorAll('.upload-prompt').forEach((node) => node.hidden = false); ctx.clearRect(0,0,64,64); viewer.updateSkin(); generateButton.disabled = true; placeholder.hidden = false; resultContent.hidden = true; download.hidden = true; resetButton.hidden = true; setStatus('Choose a portrait to begin.'); });
