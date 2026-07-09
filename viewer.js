import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js';

const U = (x, y, w, h) => ({ x, y, w, h });
const AREAS = {
  head: [U(0,8,8,8), U(16,8,8,8), U(8,0,8,8), U(16,0,8,8), U(8,8,8,8), U(24,8,8,8)],
  body: [U(16,20,4,12), U(28,20,4,12), U(20,16,8,4), U(28,16,8,4), U(20,20,8,12), U(32,20,8,12)],
  rightArm: [U(40,20,4,12), U(48,20,4,12), U(44,16,4,4), U(48,16,4,4), U(44,20,4,12), U(52,20,4,12)],
  leftArm: [U(32,52,4,12), U(40,52,4,12), U(36,48,4,4), U(40,48,4,4), U(36,52,4,12), U(44,52,4,12)],
  rightLeg: [U(0,20,4,12), U(8,20,4,12), U(4,16,4,4), U(8,16,4,4), U(4,20,4,12), U(12,20,4,12)],
  leftLeg: [U(16,52,4,12), U(24,52,4,12), U(20,48,4,4), U(24,48,4,4), U(20,52,4,12), U(28,52,4,12)]
};

function materialFor(area, canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(area.w / 64, area.h / 64);
  texture.offset.set(area.x / 64, 1 - (area.y + area.h) / 64);
  texture.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.05 });
}

function playerPart(name, width, height, depth, canvas) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, AREAS[name].map((area) => materialFor(area, canvas)));
  mesh.name = name;
  return mesh;
}

export function createSkinViewer(container, skinCanvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.enableZoom = false; controls.target.set(0, 1.4, 0);
  scene.add(new THREE.HemisphereLight(0xfff6d8, 0x496145, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(4, 6, 5); scene.add(key);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), new THREE.MeshBasicMaterial({ color: 0x819c58, transparent:true, opacity:.42 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.42; scene.add(floor);
  const player = new THREE.Group(); scene.add(player);
  let slim = false;

  function buildPlayer() {
    player.clear();
    const head = playerPart('head', .8, .8, .8, skinCanvas); head.position.y = 1.55; player.add(head);
    const body = playerPart('body', .8, 1.2, .4, skinCanvas); body.position.y = .55; player.add(body);
    const armWidth = slim ? .3 : .4;
    const rightArm = playerPart('rightArm', armWidth, 1.2, .4, skinCanvas); rightArm.position.set(-.4 - armWidth / 2, .55, 0); player.add(rightArm);
    const leftArm = playerPart('leftArm', armWidth, 1.2, .4, skinCanvas); leftArm.position.set(.4 + armWidth / 2, .55, 0); player.add(leftArm);
    const rightLeg = playerPart('rightLeg', .4, 1.2, .4, skinCanvas); rightLeg.position.set(-.2, -.65, 0); player.add(rightLeg);
    const leftLeg = playerPart('leftLeg', .4, 1.2, .4, skinCanvas); leftLeg.position.set(.2, -.65, 0); player.add(leftLeg);
  }
  function resize() { const { width, height } = container.getBoundingClientRect(); renderer.setSize(width || 260, height || 280, false); camera.aspect = (width || 260) / (height || 280); camera.updateProjectionMatrix(); }
  function resetView() { camera.position.set(3.2, 2.2, 4.3); controls.target.set(0, .3, 0); controls.update(); }
  function render() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(render); }
  const observer = new ResizeObserver(resize); observer.observe(container); buildPlayer(); resize(); resetView(); render();
  return {
    updateSkin() { player.traverse((child) => child.material?.forEach?.((material) => { material.map.needsUpdate = true; })); },
    setSlim(nextSlim) { if (slim !== nextSlim) { slim = nextSlim; buildPlayer(); } },
    resetView,
    dispose() { observer.disconnect(); controls.dispose(); renderer.dispose(); container.replaceChildren(); }
  };
}
