// Small rotating 3D models for the project cards (Tank IO and Robot Fighter).
// Each <canvas class="preview3d" data-model="..."> gets its own renderer.
import * as THREE from 'three';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const theme = { body: new THREE.Color(), dark: new THREE.Color(), eye: new THREE.Color() };

// colours follow the theme tokens, the same as the background scene
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name, fallback) => new THREE.Color(cs.getPropertyValue(name).trim() || fallback);
  theme.body.copy(get('--a', '#7c5cff'));
  theme.eye.copy(get('--c', '#ff5ca8'));
  theme.dark.copy(theme.body).multiplyScalar(0.35);
}

function makeMats() {
  return {
    body: new THREE.MeshStandardMaterial({ color: theme.body, roughness: 0.4, metalness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: theme.dark, roughness: 0.6, metalness: 0.25 }),
    eye: new THREE.MeshBasicMaterial({ color: theme.eye }),
  };
}

function tank(mats) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(1.5, 0.32, 1), mats.body, 0, 0.3, 0);
  add(new THREE.BoxGeometry(1.6, 0.3, 0.22), mats.dark, 0, 0.2, 0.6);
  add(new THREE.BoxGeometry(1.6, 0.3, 0.22), mats.dark, 0, 0.2, -0.6);
  add(new THREE.CylinderGeometry(0.36, 0.42, 0.26, 28), mats.body, 0, 0.6, 0);
  const barrel = add(new THREE.CylinderGeometry(0.065, 0.065, 0.95, 14), mats.dark, 0.7, 0.6, 0);
  barrel.rotation.z = Math.PI / 2;
  return g;
}

function robot(mats) {
  const g = new THREE.Group();
  const add = (w, h, d, mat, x, y, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  add(0.7, 0.85, 0.45, mats.body, 0, 0.2);
  add(0.5, 0.45, 0.45, mats.body, 0, 0.99);
  add(0.18, 0.7, 0.2, mats.dark, -0.5, 0.2);
  add(0.18, 0.7, 0.2, mats.dark, 0.5, 0.2);
  add(0.22, 0.6, 0.25, mats.dark, -0.2, -0.6);
  add(0.22, 0.6, 0.25, mats.dark, 0.2, -0.6);
  add(0.1, 0.07, 0.02, mats.eye, -0.12, 1.02, 0.235);
  add(0.1, 0.07, 0.02, mats.eye, 0.12, 1.02, 0.235);
  return g;
}

const builders = { tank, robot };
// where each model sits in its thumbnail: the tank sits right, next to the app icon
const layouts = {
  tank: { x: 1.75, scale: 0.75, camera: [0, 1.6, 5.2], look: [0, 0, 0] },
  robot: { x: 0, scale: 1, camera: [0, 0.4, 6.5], look: [0, 0, 0] },
};

const previews = [];

function mount(canvas) {
  const kind = canvas.dataset.model;
  const build = builders[kind];
  const layout = layouts[kind];
  if (!build || !layout) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) {
    return; // no WebGL: the cover image under the canvas stays visible
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x222244, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  const mats = makeMats();
  const holder = new THREE.Group();
  holder.position.x = layout.x;
  holder.scale.setScalar(layout.scale);
  const model = build(mats);
  holder.add(model);
  scene.add(holder);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(...layout.camera);
  camera.lookAt(...layout.look);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  previews.push({ canvas, renderer, scene, camera, model, mats, visible: false, phase: Math.random() * 6 });
}

function render(time) {
  for (const p of previews) {
    if (!p.visible) continue;
    if (!reduce) p.model.rotation.y = Math.sin(time * 0.0006 + p.phase) * 0.7;
    p.renderer.render(p.scene, p.camera);
  }
  if (!reduce) requestAnimationFrame(render);
}

function applyTheme() {
  readTheme();
  for (const p of previews) {
    p.mats.body.color.copy(theme.body);
    p.mats.dark.color.copy(theme.dark);
    p.mats.eye.color.copy(theme.eye);
  }
  if (reduce) render(0);
}

function init() {
  const canvases = document.querySelectorAll('canvas.preview3d');
  if (!canvases.length) return;
  readTheme();
  canvases.forEach(mount);

  // only draw the models that are on screen
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const p = previews.find(x => x.canvas === e.target);
      if (p) p.visible = e.isIntersecting;
    }
  });
  canvases.forEach(c => io.observe(c));

  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (reduce) {
    for (const p of previews) p.visible = true;
    render(0);
  } else {
    requestAnimationFrame(render);
  }
}

init();
