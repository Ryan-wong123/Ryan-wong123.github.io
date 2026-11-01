// Interactive layer: magnetic buttons, spotlight panels, project detail sheet,
// scroll-lit timeline, skill filter, business card, cheat code.
const fine = matchMedia('(pointer: fine)').matches;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const maxScroll = () => (document.documentElement.scrollHeight - innerHeight) || 1;

// magnetic buttons: they drift a little toward the pointer
if (fine && !calm) {
  $$('.btn').forEach(btn => {
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.25;
      btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}

// spotlight: a soft glow follows the pointer across glass panels
if (fine) {
  $$('.glass').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  });
}

// project detail sheet: opens from the card's position and closes back into it
const detail = $('#detail');
const sheet = $('.detail-sheet', detail);
const sheetBody = $('.detail-body', detail);
let openedFrom = null;

function openDetail(card) {
  openedFrom = card;
  const copy = card.cloneNode(true);
  copy.removeAttribute('style');
  copy.removeAttribute('tabindex');
  copy.classList.remove('card');
  copy.classList.add('detail-card');
  copy.querySelectorAll('canvas').forEach(c => c.remove());
  sheetBody.replaceChildren(copy);
  detail.hidden = false;
  if (!calm) {
    const from = card.getBoundingClientRect();
    const to = sheet.getBoundingClientRect();
    sheet.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: 0.2 },
      { transform: 'none', opacity: 1 },
    ], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  $('.detail-close', detail).focus();
}

function closeDetail() {
  if (detail.hidden) return;
  const done = () => {
    detail.hidden = true;
    if (openedFrom) openedFrom.focus({ preventScroll: true });
  };
  const to = openedFrom ? openedFrom.getBoundingClientRect() : null;
  if (calm || !to) return done();
  const from = sheet.getBoundingClientRect();
  const anim = sheet.animate([
    { transform: 'none', opacity: 1 },
    { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: 0.2 },
  ], { duration: 300, easing: 'ease-in', fill: 'forwards' });
  anim.onfinish = () => { anim.cancel(); done(); };
}

$$('#projects .card').forEach(card => {
  card.tabIndex = 0;
  card.addEventListener('click', e => { if (!e.target.closest('a')) openDetail(card); });
  card.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === card) openDetail(card); });
});
$('.detail-close', detail).addEventListener('click', closeDetail);
detail.addEventListener('click', e => { if (e.target === detail) closeDetail(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

// scroll-lit timeline: the line fills and each role lights up as you reach it
const timelines = $$('.timeline');
let tlQueued = false;
function litTimeline() {
  tlQueued = false;
  const line = innerHeight * 0.6;
  for (const tl of timelines) {
    const r = tl.getBoundingClientRect();
    tl.style.setProperty('--fill', clamp((line - r.top) / r.height, 0, 1).toFixed(3));
    for (const a of $$('article', tl)) a.classList.toggle('lit', a.getBoundingClientRect().top < line);
  }
}
addEventListener('scroll', () => { if (!tlQueued) { tlQueued = true; requestAnimationFrame(litTimeline); } }, { passive: true });
addEventListener('resize', litTimeline, { passive: true });
litTimeline();

// hovering a role steers the 3D camera to that point on the path
if (fine) {
  $$('.timeline article').forEach(a => {
    a.addEventListener('pointerenter', () => {
      const r = a.getBoundingClientRect();
      const u = clamp((r.top + scrollY + r.height / 2) / maxScroll(), 0, 1);
      window.dispatchEvent(new CustomEvent('scene:focus', { detail: u }));
    });
    a.addEventListener('pointerleave', () => window.dispatchEvent(new CustomEvent('scene:focus', { detail: null })));
  });
}

// skill filter: click a skill on the globe to light up the work that uses it
const filterBar = $('#filterbar');
const globeEl = $('#globe');
let activeSkill = null;
function setFilter(name) {
  activeSkill = name === activeSkill ? null : name;
  document.body.classList.toggle('filtering', !!activeSkill);
  $$('.hl').forEach(el => el.classList.remove('hl'));
  $$('.globe span').forEach(s => s.classList.toggle('on', s.textContent === activeSkill));
  if (activeSkill) {
    $$('.tags span').filter(s => s.textContent === activeSkill).forEach(s => s.closest('.glass')?.classList.add('hl'));
    filterBar.textContent = `Showing work with ${activeSkill} · click to clear`;
    filterBar.hidden = false;
  } else {
    filterBar.hidden = true;
  }
}
let press = null;
globeEl.addEventListener('pointerdown', e => { press = { x: e.clientX, y: e.clientY, label: e.target.closest('span') }; });
globeEl.addEventListener('pointerup', e => {
  if (press && press.label && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) setFilter(press.label.textContent);
  press = null;
});
filterBar.addEventListener('click', () => setFilter(activeSkill));

// business card: tilts and catches light as the pointer moves
const biz = $('#bizcard');
if (biz && fine && !calm) {
  biz.addEventListener('pointermove', e => {
    const r = biz.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    biz.style.transform = `perspective(700px) rotateX(${(0.5 - y) * 18}deg) rotateY(${(x - 0.5) * 22}deg)`;
    biz.style.setProperty('--gx', `${x * 100}%`);
    biz.style.setProperty('--gy', `${y * 100}%`);
  });
  biz.addEventListener('pointerleave', () => { biz.style.transform = ''; });
}

// nav dot: a bar under the section you're reading
const navLinks = $('#links');
const navDot = document.createElement('span');
navDot.className = 'navdot';
navDot.setAttribute('aria-hidden', 'true');
navLinks.appendChild(navDot);
function moveNavDot() {
  const a = $('#links a.active');
  navDot.style.width = a ? `${a.offsetWidth}px` : '0';
  if (a) navDot.style.left = `${a.offsetLeft}px`;
}
addEventListener('scroll', () => requestAnimationFrame(moveNavDot), { passive: true });
moveNavDot();

// theme toggle spins when pressed
const themeBtn = $('#theme');
themeBtn.addEventListener('click', () => { if (!calm) themeBtn.classList.add('flip'); });
themeBtn.addEventListener('animationend', () => themeBtn.classList.remove('flip'));

// cheat code: up up down down left right left right b a
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let typed = [];
const toast = $('#toast');
let partyTimer = 0;
function celebrate() {
  window.dispatchEvent(new Event('scene:celebrate'));
  document.body.classList.add('party');
  toast.textContent = '🎮 Cheat code unlocked';
  toast.classList.add('show');
  clearTimeout(partyTimer);
  partyTimer = setTimeout(() => {
    document.body.classList.remove('party');
    toast.classList.remove('show');
  }, 4000);
}
addEventListener('keydown', e => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  typed = [...typed, key].slice(-KONAMI.length);
  if (typed.join() === KONAMI.join()) celebrate();
});

// GitHub contribution graph: last year of public activity from a contributions endpoint
const graph = $('#graph');
if (graph) {
  const user = 'Ryan-wong123';
  const showFallback = () => {
    $('#activity-total').textContent = '';
    $('#graph-fallback').hidden = false;
    graph.closest('.graph-scroll').hidden = true;
  };
  fetch(`https://github-contributions-api.jogruber.de/v4/${user}?y=last`)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(({ total, contributions }) => {
      // start the first column on a Sunday so weeks line up
      const pad = new Date(`${contributions[0].date}T00:00:00`).getDay();
      const cells = [...Array(pad).fill(null), ...contributions];
      const frag = document.createDocumentFragment();
      for (const d of cells) {
        const cell = document.createElement('span');
        cell.className = d ? 'day' : 'day blank';
        if (d) {
          cell.dataset.level = d.level;
          cell.title = `${d.count} contribution${d.count === 1 ? '' : 's'} on ${d.date}`;
        }
        frag.appendChild(cell);
      }
      graph.replaceChildren(frag);
      $('#activity-total').textContent = `${total.lastYear.toLocaleString()} contributions in the last year`;
    })
    .catch(showFallback);
}
