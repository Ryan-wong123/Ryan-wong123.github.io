// Three.js scene behind the page. The camera travels along a path through the
// particle field as you scroll. Each section has its own accent colour and
// solid shape. The pointer pushes particles, leaves a trail, and clicks send
// out a ring of sparks.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('scene');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = () => innerWidth <= 760;
const isLight = () => document.documentElement.dataset.theme === 'light';

// 0 = sphere, 1 = cube, 2 = torus. One entry per <main> section, in page order.
const SECTION_SHAPE = [0, 0, 2, 1, 0, 2, 1, 0];

// the scroll path: x and y wander, z runs into the screen
const path = new THREE.CatmullRomCurve3(
  Array.from({ length: 9 }, (_, i) => {
    const u = i / 8;
    return new THREE.Vector3(Math.sin(u * Math.PI * 3) * 2.4, Math.sin(u * Math.PI * 1.4) * 0.6, -u * 46);
  })
);

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas });
  } catch (e) {
    return; // no WebGL: the CSS blobs in .bg stay as the background
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall() ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 150);
  scene.add(camera);
  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const res = new THREE.Vector2();

  // colours: THREE.Color holds linear values, and the output pass encodes them
  const theme = { a: new THREE.Color(), b: new THREE.Color(), c: new THREE.Color(), bg: new THREE.Color() };
  const readTheme = () => {
    const cs = getComputedStyle(document.documentElement);
    const set = (color, name, fallback) => color.set(cs.getPropertyValue(name).trim() || fallback);
    set(theme.a, '--a', '#7c5cff');
    set(theme.b, '--b', '#22d3ee');
    set(theme.c, '--c', '#ff5ca8');
    set(theme.bg, '--bg', '#07090f');
  };
  readTheme();
  const accentOf = k => [theme.a, theme.b, theme.c][k % 3];

  // background: soft glows drawn in a shader, standing in for the CSS blobs
  const bgMat = new THREE.ShaderMaterial({
    uniforms: {
      uBg: { value: theme.bg },
      uA: { value: theme.a.clone() },
      uB: { value: theme.b.clone() },
      uC: { value: theme.c.clone() },
      uRes: { value: res },
      uTime: { value: 0 },
    },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform vec3 uBg; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
      uniform vec2 uRes; uniform float uTime;
      float glow(vec2 uv, vec2 c, float r){ vec2 p = (uv - c) * vec2(uRes.x / uRes.y, 1.0); return exp(-dot(p, p) / r); }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes;
        float t = uTime * 0.05;
        vec3 col = uBg;
        col += uA * glow(uv, vec2(0.15 + 0.05 * sin(t * 2.0), 0.85), 0.12) * 0.35;
        col += uB * glow(uv, vec2(0.85, 0.15 + 0.05 * cos(t * 1.5)), 0.14) * 0.3;
        col += uC * glow(uv, vec2(0.45 + 0.1 * sin(t), 0.45), 0.06) * 0.12;
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthWrite: false,
    depthTest: false,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -1;
  scene.add(bg);

  // particle field, positions are world-space and the camera flies through it
  const dustCount = isSmall() ? 500 : 1400;
  const home = new Float32Array(dustCount * 3);
  const cur = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    home[i * 3] = (Math.random() - 0.5) * 18;
    home[i * 3 + 1] = (Math.random() - 0.5) * 12;
    home[i * 3 + 2] = -50 + Math.random() * 62;
  }
  cur.set(home);
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new THREE.BufferAttribute(cur, 3);
  dustGeo.setAttribute('position', dustPos);
  const dustMat = new THREE.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, color: theme.a });
  scene.add(new THREE.Points(dustGeo, dustMat));

  // the path, drawn as a tube
  const tubeMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.25, depthWrite: false, color: theme.a });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(path, 400, 0.012, 6, false), tubeMat));

  // the actor: a glossy solid with a fresnel rim, wrapped in a wireframe knot
  const actor = new THREE.Group();
  actor.scale.setScalar(0.6);
  scene.add(actor);
  const knotMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.3, color: theme.b });
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.32, 220, 24), knotMat);
  knot.scale.setScalar(1.5);
  actor.add(knot);

  const morphGeo = new THREE.SphereGeometry(1, 72, 48);
  const solidMat = new THREE.MeshPhysicalMaterial({
    color: theme.a, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08,
  });
  const solid = new THREE.Mesh(morphGeo, solidMat);
  actor.add(solid);

  const rimMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: theme.a.clone() } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        gl_FragColor = vec4(uColor * f * 0.9, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const rim = new THREE.Mesh(morphGeo, rimMat);
  rim.scale.setScalar(1.06);
  solid.add(rim);

  // morph targets: every vertex of the sphere is mapped onto each shape
  const targets = [0, 1, 2].map(() => new Float32Array(morphGeo.attributes.position.count * 3));
  const uv = morphGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const th = uv.getX(i) * Math.PI * 2;
    const ph = uv.getY(i) * Math.PI;
    const pr = uv.getY(i) * Math.PI * 2;
    const sx = Math.sin(ph) * Math.cos(th);
    const sy = Math.cos(ph);
    const sz = Math.sin(ph) * Math.sin(th);
    const m = Math.max(Math.abs(sx), Math.abs(sy), Math.abs(sz));
    const R = 0.62, r = 0.36, ring = R + r * Math.cos(pr);
    const put = (k, x, y, z) => { targets[k][i * 3] = x; targets[k][i * 3 + 1] = y; targets[k][i * 3 + 2] = z; };
    put(0, sx, sy, sz);
    put(1, (sx / m) * 0.85, (sy / m) * 0.85, (sz / m) * 0.85);
    put(2, ring * Math.cos(th), r * Math.sin(pr), ring * Math.sin(th));
  }
  const morphPos = morphGeo.attributes.position;
  morphPos.array.set(targets[0]);
  let morphFrom = 0, morphTo = 0, morphT = 1;
  const setShape = k => {
    if (k === morphTo) return;
    morphFrom = morphTo;
    morphTo = k;
    morphT = 0;
  };
  const stepMorph = dt => {
    if (morphT >= 1) return;
    morphT = Math.min(1, morphT + dt / 1.2);
    const e = morphT < 0.5 ? 4 * morphT ** 3 : 1 - (-2 * morphT + 2) ** 3 / 2;
    const A = targets[morphFrom], B = targets[morphTo], P = morphPos.array;
    for (let i = 0; i < P.length; i++) P[i] = A[i] + (B[i] - A[i]) * e;
    morphPos.needsUpdate = true;
    morphGeo.computeVertexNormals();
  };

  // lights: a key light in the scene and a tinted fill that rides with the camera
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 5);
  scene.add(key);
  const fill = new THREE.PointLight(theme.a.clone(), 3, 14);
  fill.position.set(-2, -1, 2);
  camera.add(fill);

  // cursor trail and click bursts
  const TRAIL = 40;
  const trailHist = Array.from({ length: TRAIL }, () => new THREE.Vector3());
  const trailPos = new Float32Array(TRAIL * 3);
  const trailCol = new Float32Array(TRAIL * 3);
  const trailGeo = new THREE.BufferGeometry();
  const trailPosAttr = new THREE.BufferAttribute(trailPos, 3);
  const trailColAttr = new THREE.BufferAttribute(trailCol, 3);
  trailGeo.setAttribute('position', trailPosAttr);
  trailGeo.setAttribute('color', trailColAttr);
  const trailMat = new THREE.PointsMaterial({
    size: 0.12, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(trailGeo, trailMat));
  const bursts = [];

  // pointer state, in normalised device coordinates (-1 to 1)
  let pointer = null;
  let px = 0, py = 0, influence = 0;
  addEventListener('pointermove', e => {
    pointer = { x: (e.clientX / innerWidth) * 2 - 1, y: -((e.clientY / innerHeight) * 2 - 1) };
  }, { passive: true });
  addEventListener('mouseout', e => { if (!e.relatedTarget) pointer = null; }, { passive: true });

  // a point on the plane 6 units in front of the camera, under the pointer
  const pointerWorld = (out, ndc) => {
    v.set(ndc.x, ndc.y, 0.5).unproject(camera);
    dir.copy(v).sub(camera.position).normalize();
    return out.copy(camera.position).addScaledVector(dir, 6);
  };

  function burstFrom(ndc) {
    if (reduce) return;
    const origin = pointerWorld(new THREE.Vector3(), ndc);
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const n = 90;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = 1.6 + Math.random() * 0.6;
      pos[i * 3] = origin.x; pos[i * 3 + 1] = origin.y; pos[i * 3 + 2] = origin.z;
      vel[i * 3] = (right.x * Math.cos(a) + up.x * Math.sin(a)) * s;
      vel[i * 3 + 1] = (right.y * Math.cos(a) + up.y * Math.sin(a)) * s;
      vel[i * 3 + 2] = (right.z * Math.cos(a) + up.z * Math.sin(a)) * s;
    }
    const geo = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(pos, 3);
    geo.setAttribute('position', attr);
    const mat = new THREE.PointsMaterial({
      color: theme.c, size: 0.08, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    bursts.push({ pts, geo, mat, attr, vel, age: 0 });
  }

  addEventListener('pointerdown', e => {
    burstFrom({ x: (e.clientX / innerWidth) * 2 - 1, y: -((e.clientY / innerHeight) * 2 - 1) });
  }, { passive: true });
  // the cheat code sends a volley of bursts across the screen
  addEventListener('scene:celebrate', () => {
    for (let i = 0; i < 14; i++) {
      setTimeout(() => burstFrom({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 }), i * 90);
    }
  });

  // the timeline can steer the camera to a point on the path (null = follow scroll)
  let focusU = null;
  addEventListener('scene:focus', e => { focusU = e.detail; });

  // particles near the pointer (in screen space) are pushed outward and spring back
  const pushDust = (ndc, amount) => {
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const R = 0.28;
    for (let i = 0; i < dustCount; i++) {
      const hx = home[i * 3], hy = home[i * 3 + 1], hz = home[i * 3 + 2];
      let ox = 0, oy = 0, oz = 0;
      v.set(hx, hy, hz).project(camera);
      if (amount > 0 && v.z < 1) {
        const dx = (v.x - ndc.x) * camera.aspect;
        const dy = v.y - ndc.y;
        const d = Math.hypot(dx, dy);
        if (d < R && d > 1e-4) {
          const push = (R - d) * Math.abs(hz - camera.position.z) * 1.1 * amount;
          ox = (right.x * dx / d + up.x * dy / d) * push;
          oy = (right.y * dx / d + up.y * dy / d) * push;
          oz = (right.z * dx / d + up.z * dy / d) * push;
        }
      }
      cur[i * 3] += (hx + ox - cur[i * 3]) * 0.12;
      cur[i * 3 + 1] += (hy + oy - cur[i * 3 + 1]) * 0.12;
      cur[i * 3 + 2] += (hz + oz - cur[i * 3 + 2]) * 0.12;
    }
    dustPos.needsUpdate = true;
  };

  const updateTrail = () => {
    const shown = influence > 0.02 && pointer;
    for (let i = TRAIL - 1; i > 0; i--) trailHist[i].copy(trailHist[i - 1]);
    if (pointer) pointerWorld(trailHist[0], pointer);
    for (let i = 0; i < TRAIL; i++) {
      trailPos[i * 3] = trailHist[i].x;
      trailPos[i * 3 + 1] = trailHist[i].y;
      trailPos[i * 3 + 2] = trailHist[i].z;
      const f = shown ? (1 - i / TRAIL) ** 2 * influence : 0;
      trailCol[i * 3] = theme.b.r * f;
      trailCol[i * 3 + 1] = theme.b.g * f;
      trailCol[i * 3 + 2] = theme.b.b * f;
    }
    trailPosAttr.needsUpdate = true;
    trailColAttr.needsUpdate = true;
  };

  const updateBursts = dt => {
    for (let b = bursts.length - 1; b >= 0; b--) {
      const bu = bursts[b];
      bu.age += dt;
      const arr = bu.attr.array;
      for (let i = 0; i < arr.length; i++) arr[i] += bu.vel[i] * dt * (1 - bu.age / 1.2);
      bu.attr.needsUpdate = true;
      bu.mat.opacity = Math.max(0, 1 - bu.age / 1.2);
      if (bu.age >= 1.2) {
        scene.remove(bu.pts);
        bu.geo.dispose();
        bu.mat.dispose();
        bursts.splice(b, 1);
      }
    }
  };

  // scroll: the camera's place on the path, and which section is current
  const progress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? Math.min(1, scrollY / max) : 0;
  };
  const sectionEls = [...document.querySelectorAll('main > section')];
  let sectionU = [0];
  const measure = () => {
    const max = (document.documentElement.scrollHeight - innerHeight) || 1;
    sectionU = sectionEls.map(el => Math.min(1, Math.max(0, (el.getBoundingClientRect().top + scrollY) / max)));
  };
  const sectionAt = s => {
    let k = 0;
    sectionU.forEach((u, i) => { if (u <= s + 0.03) k = i; });
    return k;
  };

  let s = progress();
  let camX = 0, camY = 0;
  let side = 0;
  let last = 0;

  function update(t, dt) {
    const target = focusU ?? progress();
    s += (target - s) * (reduce ? 1 : 0.08);
    const base = path.getPoint(s);
    const ahead = path.getPoint(Math.min(1, s + 0.02));

    camX += (((pointer ? pointer.x : 0) * 0.25) - camX) * 0.05;
    camY += (((pointer ? pointer.y : 0) * -0.15) - camY) * 0.05;
    camera.position.set(base.x + camX, base.y + camY, base.z + 6);
    camera.lookAt(ahead.x, ahead.y, base.z);
    camera.updateMatrixWorld();

    // the actor sits to the right of the view, ahead of the camera
    actor.position.copy(v.set(base.x + side, base.y, base.z - 1));
    actor.rotation.y = camX * 0.6;
    spin(t);
    const k = sectionAt(s);
    setShape(SECTION_SHAPE[k]);
    stepMorph(dt);

    // colours ease toward this section's accent
    const acc = accentOf(k);
    dustMat.color.lerp(acc, 0.03);
    tubeMat.color.lerp(acc, 0.03);
    solidMat.color.lerp(acc, 0.03);
    rimMat.uniforms.uColor.value.lerp(acc, 0.03);
    knotMat.color.lerp(accentOf(k + 1), 0.03);
    fill.color.lerp(acc, 0.03);
    bgMat.uniforms.uA.value.lerp(acc, 0.03);
    bgMat.uniforms.uB.value.lerp(accentOf(k + 1), 0.03);
    bgMat.uniforms.uC.value.lerp(accentOf(k + 2), 0.03);
    bgMat.uniforms.uTime.value = t;

    // pointer effects
    influence += ((pointer ? 1 : 0) - influence) * 0.1;
    const ndc = pointer || { x: 0, y: 0 };
    px += (ndc.x - px) * 0.2;
    py += (ndc.y - py) * 0.2;
    if (!reduce) {
      pushDust({ x: px, y: py }, influence);
      updateTrail();
      updateBursts(dt);
    }

    composer.render();
  }

  // the knot and the solid turn at their own speeds, and the solid breathes slightly
  function spin(t) {
    knot.rotation.x = t * 0.2;
    knot.rotation.y = t * 0.3;
    solid.rotation.y = t * 0.25;
    solid.scale.setScalar(1 + 0.02 * Math.sin(t * 1.3));
  }

  // post-processing: bloom for the neon glow (off on light theme and phones)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.4, 0.25);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(res);
    bloom.enabled = !isLight() && !isSmall();
    actor.visible = !isSmall();
    side = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 7 * camera.aspect * 0.82;
    measure();
    if (reduce) update(0, 0);
  }

  new MutationObserver(() => {
    readTheme();
    bloom.enabled = !isLight() && !isSmall();
    if (reduce) update(0, 0);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  addEventListener('scroll', () => { if (reduce) update(0, 0); }, { passive: true });
  addEventListener('resize', layout, { passive: true });
  addEventListener('load', measure, { passive: true });

  layout();
  function loop(now) {
    const t = now / 1000;
    const dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;
    update(t, dt);
    requestAnimationFrame(loop);
  }
  if (reduce) update(0, 0);
  else requestAnimationFrame(loop);
}

if (canvas) init();
