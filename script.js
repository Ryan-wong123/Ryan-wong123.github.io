document.getElementById('year').textContent = new Date().getFullYear();

// theme
const root = document.documentElement;
try { const s = localStorage.getItem('theme'); if (s) root.dataset.theme = s; } catch (e) {}
document.getElementById('theme').addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});

// typing effect
const words = ['full-stack web apps', 'games in Unity', 'AI-powered tools', 'automation workflows', 'mobile applications'];
const el = document.getElementById('type');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (still) { el.textContent = words[0]; } else {
  let w = 0, i = 0, del = false;
  (function tick() {
    const word = words[w];
    el.textContent = word.slice(0, i);
    if (!del && i === word.length) { del = true; return setTimeout(tick, 1600); }
    if (del && i === 0) { del = false; w = (w + 1) % words.length; }
    i += del ? -1 : 1;
    setTimeout(tick, del ? 35 : 75);
  })();
}

// reveal + counters
const count = n => {
  const to = +n.dataset.count; let v = 0;
  const step = () => { v += Math.max(1, to / 30); n.textContent = Math.min(to, Math.round(v)) + '+'; if (v < to) requestAnimationFrame(step); };
  step();
};
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  e.target.querySelectorAll('[data-count]').forEach(count);
  io.unobserve(e.target);
}), { threshold: 0.1 });
document.querySelectorAll('.reveal, .hero').forEach(x => io.observe(x));
document.querySelector('.hero').classList.add('in');

// 3D tilt on project cards (mouse only, skipped for reduced motion)
const finePointer = matchMedia('(pointer: fine)').matches;
if (finePointer && !still) {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) translateY(-6px) rotateX(${-y * 8}deg) rotateY(${x * 10}deg)`;
      card.style.setProperty('--px', x.toFixed(3));
      card.style.setProperty('--py', y.toFixed(3));
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
      card.style.removeProperty('--px');
      card.style.removeProperty('--py');
    });
  });
}

// skills globe: the skill tags orbit on a sphere and can be dragged
const globe = document.getElementById('globe');
if (globe) {
  const names = [...new Set([...document.querySelectorAll('.skillgrid .tags span')].map(s => s.textContent))];
  const n = names.length;
  const items = names.map((name, i) => {
    const el = document.createElement('span');
    el.textContent = name;
    globe.appendChild(el);
    // evenly spaced points on a sphere (Fibonacci lattice)
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    return { el, x: Math.cos(phi) * r, y, z: Math.sin(phi) * r };
  });
  let rx = -0.25, ry = 0, vx = 0, vy = 0, drag = null;
  const spin = still ? 0 : 0.003;
  const radius = () => Math.min(globe.clientWidth, 420) * 0.42;
  const place = () => {
    const R = radius();
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
    for (const it of items) {
      // rotate around Y, then X
      let x = it.x * cy + it.z * sy;
      let z = -it.x * sy + it.z * cy;
      let y = it.y * cx - z * sx;
      z = it.y * sx + z * cx;
      const depth = (z + 1) / 2; // 0 at the back, 1 at the front
      it.el.style.transform = `translate(-50%, -50%) translate3d(${(x * R).toFixed(1)}px, ${(y * R).toFixed(1)}px, 0)`;
      it.el.style.opacity = (0.25 + depth * 0.75).toFixed(2);
      it.el.style.zIndex = Math.round(depth * 100);
    }
  };
  const tick = () => {
    if (!drag) {
      ry += spin + vy;
      rx += vx;
      vx *= 0.95;
      vy *= 0.95;
    }
    place();
    requestAnimationFrame(tick);
  };
  globe.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, y: e.clientY };
    vx = vy = 0;
    globe.setPointerCapture(e.pointerId);
  });
  globe.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
    vy = dx * 0.004;
    vx = dy * 0.004;
    ry += vy;
    rx += vx;
  });
  const end = () => { drag = null; };
  globe.addEventListener('pointerup', end);
  globe.addEventListener('pointercancel', end);
  place();
  requestAnimationFrame(tick);
}

// scroll progress + active link
const bar = document.getElementById('progress');
const links = [...document.querySelectorAll('#links a')];
const secs = links.map(a => document.querySelector(a.getAttribute('href')));
addEventListener('scroll', () => {
  const h = document.documentElement;
  bar.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + '%';
  let cur = -1;
  secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < 140) cur = i; });
  links.forEach((a, i) => a.classList.toggle('active', i === cur));
}, { passive: true });
