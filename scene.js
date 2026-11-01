// Three.js scene drawn behind the page: a drifting particle field and a
// wireframe knot that follows the pointer and scroll.
import * as THREE from 'three';

const canvas = document.getElementById('scene');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function init() {
  if (!canvas) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (e) {
    return; // no WebGL: the CSS blobs in .bg stay as the background
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 6;

  // particle field
  const count = innerWidth < 760 ? 500 : 1400;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 18;
    positions[i + 1] = (Math.random() - 0.5) * 12;
    positions[i + 2] = (Math.random() - 0.5) * 10 - 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.5, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // wireframe knot with a small icosahedron inside
  const knotMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.3 });
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.32, 220, 24), knotMat);
  const coreMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.45 });
  knot.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), coreMat));
  scene.add(knot);

  // colours follow the theme tokens in style.css
  const paint = () => {
    const cs = getComputedStyle(document.documentElement);
    const pick = (name, fallback) => new THREE.Color(cs.getPropertyValue(name).trim() || fallback);
    dustMat.color.copy(pick('--a', '#7c5cff'));
    knotMat.color.copy(pick('--b', '#22d3ee'));
    coreMat.color.copy(pick('--c', '#ff5ca8'));
  };
  paint();
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // pointer and scroll input
  let mx = 0, my = 0, px = 0, py = 0, sy = scrollY;
  addEventListener('pointermove', e => {
    mx = (e.clientX / innerWidth) * 2 - 1;
    my = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  addEventListener('scroll', () => {
    sy = scrollY;
    if (reduce) draw(0);
  }, { passive: true });

  // the knot sits right of the text on wide screens and hides on phones
  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfWidth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
    knot.visible = w > 760;
    knot.position.x = halfWidth * 0.8;
    knot.scale.setScalar(w > 1100 ? 1 : 0.75);
    if (reduce) draw(0);
  }

  function draw(t) {
    const time = t * 0.001;
    px += (mx - px) * 0.04;
    py += (my - py) * 0.04;
    dust.rotation.y = time * 0.02 + px * 0.12;
    dust.rotation.x = py * 0.08;
    dust.position.y = sy * 0.0015;
    knot.rotation.x = time * 0.2 + py * 0.5;
    knot.rotation.y = time * 0.3 + px * 0.5;
    knot.position.y = Math.sin(time * 0.6) * 0.12 - sy * 0.0012;
    camera.position.x = px * 0.25;
    camera.position.y = -py * 0.15;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  function loop(t) {
    draw(t);
    requestAnimationFrame(loop);
  }

  addEventListener('resize', layout, { passive: true });
  layout();
  if (!reduce) requestAnimationFrame(loop);
}

init();
