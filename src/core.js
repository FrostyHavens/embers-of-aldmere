// ===== Core: canvas, loop, input, RNG, scenes =====
'use strict';
const G = window.G = {};
G.W = 320; G.H = 224;
G.TILE = 24;

// ---------- RNG (seedable, deterministic for tests) ----------
G.rngState = (Date.now() ^ 0x5bd1e995) >>> 0;
G.rand = function () { // xorshift32 -> [0,1)
  let x = G.rngState; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
  G.rngState = x; return x / 4294967296;
};
G.r = n => (n <= 0 ? 0 : Math.floor(G.rand() * n)); // 0..n-1
G.chance = n => G.r(n) === 0; // 1 in n
G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- Canvas ----------
G.canvas = document.getElementById('screen');
G.ctx = G.canvas.getContext('2d');
G.canvas.width = G.W; G.canvas.height = G.H;
G.ctx.imageSmoothingEnabled = false;
G.makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return c; };
function resize() {
  const s = Math.max(1, Math.floor(Math.min(window.innerWidth / G.W, window.innerHeight / G.H) * 4) / 4);
  G.canvas.style.width = (G.W * s) + 'px'; G.canvas.style.height = (G.H * s) + 'px';
}
window.addEventListener('resize', resize); resize();

// ---------- Input ----------
// A = confirm/talk, B = cancel, C = menu/info, plus directions.
G.keys = {}; G.pressed = {}; G.repeatT = {};
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  KeyZ: 'A', Space: 'A', Enter: 'A', KeyJ: 'A',
  KeyX: 'B', Escape: 'B', Backspace: 'B', KeyK: 'B',
  KeyC: 'C', ShiftLeft: 'C', ShiftRight: 'C', KeyL: 'C',
  KeyM: 'M', KeyT: 'T'
};
window.addEventListener('keydown', e => {
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (!G.keys[k]) { G.pressed[k] = true; G.repeatT[k] = 0; }
  G.keys[k] = true;
  G.audio && G.audio.unlock();
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) { G.keys[k] = false; } });
window.addEventListener('blur', () => { G.keys = {}; });
// touch/mouse -> unlock audio
window.addEventListener('pointerdown', () => G.audio && G.audio.unlock());

G.input = {
  // edge-triggered
  p(k) { return !!G.pressed[k]; },
  // held
  h(k) { return !!G.keys[k]; },
  // edge + auto-repeat (for cursors/menus)
  rep(k, delay = 14, rate = 5) {
    if (G.pressed[k]) return true;
    if (!G.keys[k]) return false;
    const t = G.repeatT[k] || 0;
    return t >= delay && (t - delay) % rate === 0;
  },
  dir() { // held direction (for walking)
    if (G.keys.up) return 'up'; if (G.keys.down) return 'down';
    if (G.keys.left) return 'left'; if (G.keys.right) return 'right'; return null;
  },
  repDir(delay, rate) {
    for (const d of ['up', 'down', 'left', 'right']) if (this.rep(d, delay, rate)) return d;
    return null;
  },
  clear() { G.pressed = {}; }
};
G.DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// ---------- Scene stack ----------
// A scene: {update(), draw(ctx), onEnter?, onExit?, transparent?}
G.scenes = [];
G.push = s => { G.scenes.push(s); s.onEnter && s.onEnter(); return s; };
G.pop = () => { const s = G.scenes.pop(); s && s.onExit && s.onExit(); return s; };
G.replace = s => { while (G.scenes.length) G.pop(); return G.push(s); };
G.top = () => G.scenes[G.scenes.length - 1];

// ---------- Coroutine-ish task runner (for cutscenes & battle flow) ----------
// Generators yield: number (wait frames), a Promise-like {done()} object, or nothing (1 frame)
G.Tasks = class {
  constructor() { this.list = []; }
  add(gen) { this.list.push({ gen, wait: 0, obj: null }); }
  get busy() { return this.list.length > 0; }
  update() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      if (t.wait > 0) { t.wait--; continue; }
      if (t.obj && !t.obj.done()) continue;
      const back = t.obj; t.obj = null;
      let r;
      try { r = t.gen.next(back); } catch (e) { console.error(e); this.list.splice(i, 1); continue; }
      if (r.done) { this.list.splice(i, 1); continue; }
      const v = r.value;
      if (typeof v === 'number') t.wait = v - 1;
      else if (v && typeof v.done === 'function') { t.obj = v; if (v.done()) { /* resolves next frame */ } }
    }
  }
};

// Fade overlay
G.fade = { a: 0, target: 0, speed: 0.08, color: '#000' };
G.fadeTo = (a, speed = 0.08, color = '#000') => { G.fade.target = a; G.fade.speed = speed; G.fade.color = color; return { done: () => G.fade.a === G.fade.target }; };

// Screen flash / shake
G.fx = { shake: 0, flash: 0, flashColor: '#fff' };

G.frame = 0;
function step() {
  G.frame++;
  const s = G.top();
  if (s) s.update();
  // fade
  const f = G.fade;
  if (f.a < f.target) f.a = Math.min(f.target, f.a + f.speed);
  else if (f.a > f.target) f.a = Math.max(f.target, f.a - f.speed);
  if (G.fx.shake > 0) G.fx.shake--;
  if (G.fx.flash > 0) G.fx.flash--;
  for (const k in G.keys) if (G.keys[k]) G.repeatT[k] = (G.repeatT[k] || 0) + 1;
  if (G.pressed.T && G.toggleAuto) G.toggleAuto();
  if (G.toastT > 0) G.toastT--;
  G.pressed = {};
  G.audio && G.audio.tick();
}
function draw() {
  const ctx = G.ctx;
  ctx.save();
  if (G.fx.shake > 0) ctx.translate(G.r(5) - 2, G.r(3) - 1);
  ctx.fillStyle = '#000'; ctx.fillRect(-4, -4, G.W + 8, G.H + 8);
  // draw from lowest non-transparent scene upward
  let start = G.scenes.length - 1;
  while (start > 0 && G.scenes[start].transparent) start--;
  for (let i = Math.max(0, start); i < G.scenes.length; i++) G.scenes[i].draw(ctx);
  ctx.restore();
  if (G.fx.flash > 0) { ctx.globalAlpha = Math.min(1, G.fx.flash / 6); ctx.fillStyle = G.fx.flashColor; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
  if (G.fade.a > 0) { ctx.globalAlpha = G.fade.a; ctx.fillStyle = G.fade.color; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
  if (G.toastT > 0 && G.win) { const w = G.textWidth(G.toastMsg) + 20; ctx.globalAlpha = Math.min(1, G.toastT / 15); G.win(ctx, (G.W - w) / 2, 40, w, 20); G.textC(ctx, G.toastMsg, G.W / 2, 46, '#f8e060'); ctx.globalAlpha = 1; }
}
G.toast = (msg, t = 90) => { G.toastMsg = msg; G.toastT = t; };
G.step = step; G.drawFrame = draw;

let last = performance.now(), acc = 0;
G.speedMul = 1;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  const dt = 1000 / 60;
  let n = 0;
  while (acc >= dt && n < 5) { for (let k = 0; k < G.speedMul; k++) step(); acc -= dt; n++; }
  draw();
  requestAnimationFrame(loop);
}
G.start = () => { if (location.hash === '#test') return; requestAnimationFrame(t => { last = t; loop(t); }); };

// ---------- Storage (safe) ----------
G.store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

// ---------- Touch controls (phones/tablets) ----------
(function () {
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
  G.canvas.tabIndex = 0;
  G.canvas.addEventListener('pointerdown', () => { try { G.canvas.focus(); } catch (e) { } });
  if (!touch) return;
  const css = document.createElement('style');
  css.textContent = '.tc{position:fixed;z-index:5;display:flex;gap:10px;touch-action:none;user-select:none;-webkit-user-select:none}' +
    '.tc button{width:54px;height:54px;border-radius:50%;border:2px solid #8898e0;background:rgba(28,44,140,.55);color:#f0f0ff;font:bold 16px monospace}' +
    '.tc button:active,.tc button.on{background:rgba(240,208,96,.7);color:#101030}' +
    '#tcpad{left:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(3,48px);grid-template-rows:repeat(3,48px);gap:2px}' +
    '#tcpad button{width:48px;height:48px;border-radius:8px}' +
    '#tcbtn{right:14px;bottom:calc(20px + env(safe-area-inset-bottom,0px));align-items:flex-end}';
  document.head.appendChild(css);
  const pad = document.createElement('div'); pad.id = 'tcpad'; pad.className = 'tc';
  const cells = ['', 'up', '', 'left', '', 'right', '', 'down', ''];
  const lab = { up: '▲', down: '▼', left: '◀', right: '▶' };
  cells.forEach(k => { const b = document.createElement(k ? 'button' : 'span'); if (k) { b.textContent = lab[k]; b.dataset.k = k; } pad.appendChild(b); });
  const btns = document.createElement('div'); btns.id = 'tcbtn'; btns.className = 'tc';
  [['T', 'T'], ['C', 'C'], ['B', 'B'], ['A', 'A']].forEach(([k, t]) => { const b = document.createElement('button'); b.textContent = t; b.dataset.k = k; if (k === 'A') b.style.marginBottom = '30px'; btns.appendChild(b); });
  document.body.appendChild(pad); document.body.appendChild(btns);
  const down = k => { if (!G.keys[k]) { G.pressed[k] = true; G.repeatT[k] = 0; } G.keys[k] = true; G.audio && G.audio.unlock(); };
  const up = k => { G.keys[k] = false; };
  [pad, btns].forEach(el => {
    el.addEventListener('pointerdown', e => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; e.preventDefault(); e.target.classList.add('on'); down(k); e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); });
    const rel = e => { const k = e.target.dataset && e.target.dataset.k; if (!k) return; e.target.classList.remove('on'); up(k); };
    el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel); el.addEventListener('pointerleave', rel);
  });
})();
