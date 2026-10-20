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
