let THREE;
let OrbitControls;

async function loadViewerDependencies(loader) {
  if (THREE && OrbitControls) return;
  if (typeof loader !== 'function') {
    throw new Error('Optional 3D preview unavailable: self-hosted Three.js viewer dependencies are not installed.');
  }
  const dependencies = await loader();
  THREE = dependencies.THREE;
  OrbitControls = dependencies.OrbitControls;
}

const U = (x, y, w, h) => ({ x, y, w, h });
const AREAS = {
  head: [U(0,8,8,8), U(16,8,8,8), U(8,0,8,8), U(16,0,8,8), U(8,8,8,8), U(24,8,8,8)],
  hat: [U(32,8,8,8), U(48,8,8,8), U(40,0,8,8), U(48,0,8,8), U(40,8,8,8), U(56,8,8,8)],
  body: [U(16,20,4,12), U(28,20,4,12), U(20,16,8,4), U(28,16,8,4), U(20,20,8,12), U(32,20,8,12)],
  jacket: [U(16,36,4,12), U(28,36,4,12), U(20,32,8,4), U(28,32,8,4), U(20,36,8,12), U(32,36,8,12)],
  rightArm: [U(40,20,4,12), U(48,20,4,12), U(44,16,4,4), U(48,16,4,4), U(44,20,4,12), U(52,20,4,12)],
  leftArm: [U(32,52,4,12), U(40,52,4,12), U(36,48,4,4), U(40,48,4,4), U(36,52,4,12), U(44,52,4,12)],
  rightArmOverlay: [U(40,36,4,12), U(48,36,4,12), U(44,32,4,4), U(48,32,4,4), U(44,36,4,12), U(52,36,4,12)],
  leftArmOverlay: [U(48,52,4,12), U(56,52,4,12), U(52,48,4,4), U(56,48,4,4), U(52,52,4,12), U(60,52,4,12)],
  rightArmSlim: [U(40,20,4,12), U(47,20,4,12), U(44,16,3,4), U(47,16,3,4), U(44,20,3,12), U(51,20,3,12)],
  leftArmSlim: [U(32,52,4,12), U(39,52,4,12), U(36,48,3,4), U(39,48,3,4), U(36,52,3,12), U(43,52,3,12)],
  rightArmOverlaySlim: [U(40,36,4,12), U(47,36,4,12), U(44,32,3,4), U(47,32,3,4), U(44,36,3,12), U(51,36,3,12)],
  leftArmOverlaySlim: [U(48,52,4,12), U(55,52,4,12), U(52,48,3,4), U(55,48,3,4), U(52,52,3,12), U(59,52,3,12)],
  rightLeg: [U(0,20,4,12), U(8,20,4,12), U(4,16,4,4), U(8,16,4,4), U(4,20,4,12), U(12,20,4,12)],
  leftLeg: [U(16,52,4,12), U(24,52,4,12), U(20,48,4,4), U(24,48,4,4), U(20,52,4,12), U(28,52,4,12)],
  rightLegOverlay: [U(0,36,4,12), U(8,36,4,12), U(4,32,4,4), U(8,32,4,4), U(4,36,4,12), U(12,36,4,12)],
  leftLegOverlay: [U(0,52,4,12), U(8,52,4,12), U(4,48,4,4), U(8,48,4,4), U(4,52,4,12), U(12,52,4,12)]
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

export async function createMinecraftAvatarViewer(container, minecraftTexture, { loadDependencies, requestFrame = globalThis.requestAnimationFrame, cancelFrame = globalThis.cancelAnimationFrame } = {}) {
  await loadViewerDependencies(loadDependencies);
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
  let disposed = false;
  let frameHandle = null;

  function disposePlayer() {
    player.traverse((child) => {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach((material) => { material.map?.dispose(); material.dispose(); });
    });
    player.clear();
  }

  function buildPlayer() {
    disposePlayer();
    const head = playerPart('head', .8, .8, .8, minecraftTexture); head.position.y = 1.55; player.add(head);
    const hat = playerPart('hat', .84, .84, .84, minecraftTexture); hat.position.copy(head.position); player.add(hat);
    const body = playerPart('body', .8, 1.2, .4, minecraftTexture); body.position.y = .55; player.add(body);
    const jacket = playerPart('jacket', .84, 1.24, .44, minecraftTexture); jacket.position.copy(body.position); player.add(jacket);
    const armWidth = slim ? .3 : .4;
    const rightArm = playerPart(slim ? 'rightArmSlim' : 'rightArm', armWidth, 1.2, .4, minecraftTexture); rightArm.position.set(-.4 - armWidth / 2, .55, 0); player.add(rightArm);
    const leftArm = playerPart(slim ? 'leftArmSlim' : 'leftArm', armWidth, 1.2, .4, minecraftTexture); leftArm.position.set(.4 + armWidth / 2, .55, 0); player.add(leftArm);
    const rightSleeve = playerPart(slim ? 'rightArmOverlaySlim' : 'rightArmOverlay', armWidth + .04, 1.24, .44, minecraftTexture); rightSleeve.position.copy(rightArm.position); player.add(rightSleeve);
    const leftSleeve = playerPart(slim ? 'leftArmOverlaySlim' : 'leftArmOverlay', armWidth + .04, 1.24, .44, minecraftTexture); leftSleeve.position.copy(leftArm.position); player.add(leftSleeve);
    const rightLeg = playerPart('rightLeg', .4, 1.2, .4, minecraftTexture); rightLeg.position.set(-.2, -.65, 0); player.add(rightLeg);
    const leftLeg = playerPart('leftLeg', .4, 1.2, .4, minecraftTexture); leftLeg.position.set(.2, -.65, 0); player.add(leftLeg);
    const rightPants = playerPart('rightLegOverlay', .44, 1.24, .44, minecraftTexture); rightPants.position.copy(rightLeg.position); player.add(rightPants);
    const leftPants = playerPart('leftLegOverlay', .44, 1.24, .44, minecraftTexture); leftPants.position.copy(leftLeg.position); player.add(leftPants);
  }
  function resize() { const { width, height } = container.getBoundingClientRect(); renderer.setSize(width || 260, height || 280, false); camera.aspect = (width || 260) / (height || 280); camera.updateProjectionMatrix(); }
  function resetView() { camera.position.set(3.2, 2.2, 4.3); controls.target.set(0, .3, 0); controls.update(); }
  function render() { if (disposed) return; controls.update(); renderer.render(scene, camera); frameHandle = requestFrame(render); }
  const observer = new ResizeObserver(resize); observer.observe(container); buildPlayer(); resize(); resetView(); render();
  return {
    updateMinecraftTexture(nextTexture) {
      minecraftTexture = nextTexture;
      player.traverse((child) => child.material?.forEach?.((material) => {
        material.map.image = minecraftTexture;
        material.map.needsUpdate = true;
      }));
    },
    setSlim(nextSlim) { if (slim !== nextSlim) { slim = nextSlim; buildPlayer(); } },
    resetView,
    dispose() { if (disposed) return; disposed = true; if (frameHandle !== null && typeof cancelFrame === 'function') cancelFrame(frameHandle); observer.disconnect(); disposePlayer(); controls.dispose(); renderer.dispose(); container.replaceChildren(); }
  };
}
