// Interactive layer: magnetic buttons, spotlight panels, project detail sheet,
// scroll-lit timeline, skill filter, business card, breakout game, cheat code.
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

// breakout mini-game in the contact section
const bo = $('#breakout');
if (bo) {
  const ctx = bo.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const MUTED = '#98a2b8';
  let W = 0, H = 0, k = 1;
  let colors = ['#7c5cff', '#22d3ee', '#ff5ca8'];
  let pad, ball, bricks, lives, score, state;

  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    colors = ['--a', '--b', '--c'].map((n, i) => cs.getPropertyValue(n).trim() || colors[i]);
  };
  const serve = () => { ball = { x: pad.x, y: H - 26, r: 6, vx: 0, vy: 0 }; state = 'ready'; };
  function layoutGame() {
    W = bo.clientWidth || 520;
    H = Math.round(Math.min(W * 0.45, 260));
    bo.width = W * dpr;
    bo.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    k = W / 600;
    bricks = [];
    const cols = 9, rows = 4, gap = 6, bw = (W - gap * (cols + 1)) / cols, bh = 14;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({ x: gap + c * (bw + gap), y: 28 + r * (bh + gap), w: bw, h: bh, ci: (r + c) % 3, alive: true });
      }
    }
  }
  function reset() {
    layoutGame();
    pad = { x: W / 2, w: Math.max(70, W * 0.18), h: 8 };
    lives = 3;
    score = 0;
    serve();
  }
  function launch() {
    const speed = 4.2 * k;
    const ang = (Math.random() - 0.5) * 0.8;
    ball.vx = Math.sin(ang) * speed;
    ball.vy = -Math.cos(ang) * speed;
    state = 'play';
  }
  function step() {
    if (state === 'ready') { ball.x = pad.x; return; }
    if (state !== 'play') return;
    ball.x += ball.vx;
    ball.y += ball.vy;
    if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

    // paddle: the further from its centre the ball hits, the sharper the bounce
    const top = H - 16;
    if (ball.vy > 0 && ball.y + ball.r >= top && ball.x > pad.x - pad.w / 2 - ball.r && ball.x < pad.x + pad.w / 2 + ball.r) {
      const speed = Math.hypot(ball.vx, ball.vy);
      const ang = clamp((ball.x - pad.x) / (pad.w / 2), -1, 1) * 1.05;
      ball.vx = Math.sin(ang) * speed;
      ball.vy = -Math.cos(ang) * speed;
      ball.y = top - ball.r;
    }

    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        b.alive = false;
        score++;
        const ox = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
        const oy = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
        if (ox < oy) ball.vx = -ball.vx; else ball.vy = -ball.vy;
        break;
      }
    }

    if (bricks.every(b => !b.alive)) {
      state = 'won';
      ball.vx = ball.vy = 0;
    } else if (ball.y > H + ball.r) {
      lives--;
      if (lives <= 0) {
        state = 'over';
        ball.vx = ball.vy = 0;
      } else {
        serve();
      }
    }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = colors[b.ci];
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 3);
      ctx.fill();
    }
    ctx.fillStyle = colors[1];
    ctx.beginPath();
    ctx.roundRect(pad.x - pad.w / 2, H - 16, pad.w, pad.h, 4);
    ctx.fill();
    ctx.fillStyle = colors[2];
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score ${score}   Lives ${lives}`, 10, 8);
    const msg = { ready: 'Click to launch', over: 'Game over · click to retry', won: 'You win! · click to play again' }[state];
    if (msg) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors[0];
      ctx.font = '700 16px Inter, system-ui, sans-serif';
      ctx.fillText(msg, W / 2, H * 0.62);
      ctx.textAlign = 'start';
    }
  }

  const localX = e => e.clientX - bo.getBoundingClientRect().left;
  bo.addEventListener('pointermove', e => {
    pad.x = clamp(localX(e), pad.w / 2, W - pad.w / 2);
  }, { passive: true });
  const primary = () => {
    if (state === 'ready') launch();
    else if (state === 'over' || state === 'won') reset();
  };
  bo.addEventListener('pointerdown', primary);
  bo.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') pad.x = clamp(pad.x - 24, pad.w / 2, W - pad.w / 2);
    if (e.key === 'ArrowRight') pad.x = clamp(pad.x + 24, pad.w / 2, W - pad.w / 2);
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); primary(); }
  });

  let onScreen = false;
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(bo);
  const loop = () => {
    if (onScreen) { step(); draw(); }
    requestAnimationFrame(loop);
  };
  readColors();
  reset();
  loop();
  addEventListener('resize', () => { if (bo.clientWidth !== W) reset(); }, { passive: true });
  new MutationObserver(() => { readColors(); draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
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
