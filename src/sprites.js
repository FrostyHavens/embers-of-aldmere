// ===== Sprites: procedural original character art (map chibis, battle figures, portraits) =====
// All designs are original and generated from parameters. No external assets.
'use strict';
(function () {
  // ------------------------------------------------------------------
  // Colour helpers (ints 0xRRGGBB)
  // ------------------------------------------------------------------
  function h2i(h) {
    if (typeof h === 'number') return h;
    if (!h || h[0] !== '#') return 0xff00ff;
    if (h.length === 4) { const n = parseInt(h.slice(1), 16); return (((n >> 8) & 15) * 17 << 16) | (((n >> 4) & 15) * 17 << 8) | ((n & 15) * 17); }
    return parseInt(h.slice(1, 7), 16);
  }
  const cl = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
  const pack = (r, g, b) => (cl(r) << 16) | (cl(g) << 8) | cl(b);
  const R_ = i => (i >> 16) & 255, G_ = i => (i >> 8) & 255, B_ = i => i & 255;
  function mix(a, b, t) { return pack(R_(a) + (R_(b) - R_(a)) * t, G_(a) + (G_(b) - G_(a)) * t, B_(a) + (B_(b) - B_(a)) * t); }
  function mul(a, f) { return pack(R_(a) * f, G_(a) * f, B_(a) * f); }
  function lighten(a, t) { return mix(a, 0xffffff, t); }
  const OUT = 0x120a1a;               // outline colour
  const darkLine = c => mix(mul(c, 0.5), 0x140a2a, 0.3);

  // 5-tone ramps: 0 deep, 1 shadow, 2 base, 3 light, 4 highlight
  const rampCache = {};
  function ramp(hex, kind) {
    kind = kind || 'cloth';
    const key = hex + kind;
    if (rampCache[key]) return rampCache[key];
    const b = h2i(hex); let r;
    if (kind === 'metal') r = [mix(mul(b, 0.3), 0x0c0c34, 0.35), mix(mul(b, 0.6), 0x282050, 0.2), b, mix(b, 0xffffff, 0.4), mix(b, 0xffffff, 0.82)];
    else if (kind === 'skin') r = [mix(mul(b, 0.52), 0x581830, 0.3), mix(mul(b, 0.8), 0x902838, 0.14), b, mix(b, 0xfff4e8, 0.32), mix(b, 0xffffff, 0.55)];
    else if (kind === 'hair') r = [mix(mul(b, 0.38), 0x140828, 0.3), mix(mul(b, 0.66), 0x281850, 0.18), b, mix(b, 0xfff0d0, 0.3), mix(b, 0xffffff, 0.6)];
    else if (kind === 'glow') r = [b, b, lighten(b, 0.3), lighten(b, 0.6), 0xffffff];
    else r = [mix(mul(b, 0.42), 0x180c38, 0.3), mix(mul(b, 0.68), 0x302058, 0.18), b, mix(b, 0xfff4d0, 0.24), mix(b, 0xffffff, 0.5)];
    r.max = (kind === 'metal' || kind === 'hair' || kind === 'glow') ? 4 : 3;
    if (kind === 'skin') r.max = 3;
    rampCache[key] = r; return r;
  }
  const BAYER = [-0.375, 0.125, 0.375, -0.125];

  // ------------------------------------------------------------------
  // Pixel buffer with groups (for interior lines), shaded primitives
  // ------------------------------------------------------------------
  class Buf {
    constructor(w, h, lx, dAmp) {
      this.w = w; this.h = h; const n = w * h;
      this.c = new Int32Array(n).fill(-1); this.al = new Uint8Array(n); this.g = new Int16Array(n).fill(-1);
      this.fam = []; this.flg = []; this.ids = {}; this.cg = 0;
      const L = [0.55 * (lx || -1), -0.62, 0.58]; const m = Math.hypot(L[0], L[1], L[2]); this.L = L.map(v => v / m);
      this.dAmp = dAmp == null ? 0.12 : dAmp; this.clip = null; this.only = null; this.th = [0.9, 0.58, 0.2, -0.18];
      this.grp('base');
    }
    grp(name, flags) {
      let id = this.ids[name];
      if (id === undefined) { id = this.fam.length; this.ids[name] = id; this.fam.push(name.split(':')[0]); this.flg.push(flags || ''); }
      this.cg = id; return this;
    }
    put(x, y, c, a) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      if (this.clip && !this.clip(x + 0.5, y + 0.5)) return;
      const i = y * this.w + x;
      if (this.only) { const gi = this.g[i]; if (gi < 0 || this.only.indexOf(this.fam[gi]) < 0) return; }
      this.c[i] = c; this.al[i] = a == null ? 255 : a; this.g[i] = this.cg;
    }
    at(x, y) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1; return this.c[y * this.w + x]; }
    famAt(x, y) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; const g = this.g[y * this.w + x]; return g < 0 ? null : this.fam[g]; }
    // blended glow pixel (after outline)
    glow(x, y, c, a) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
      const i = y * this.w + x; a = Math.min(255, a);
      if (this.c[i] >= 0) {
        const ea = this.al[i] / 255, na = a / 255;
        const oa = na + ea * (1 - na);
        this.c[i] = mix(this.c[i], c, na / oa); this.al[i] = Math.round(oa * 255);
      } else { this.c[i] = c; this.al[i] = a; this.g[i] = this.ids.fx === undefined ? this.grp('fx', 'nx').cg : this.ids.fx; }
    }
    tone(R, nx, ny, nz, x, y, shift) {
      const L = this.L; let d = nx * L[0] + ny * L[1] + nz * L[2];
      if (this.dAmp) d += BAYER[((y & 1) << 1) | (x & 1)] * this.dAmp;
      const th = this.th;
      let t = d > th[0] ? 4 : d > th[1] ? 3 : d > th[2] ? 2 : d > th[3] ? 1 : 0;
      t += shift || 0; if (t > R.max) t = R.max; if (t < 0) t = 0;
      return R[t];
    }
    col(R, o, nx, ny, nz, x, y) {
      if (typeof R === 'number') return R;
      if (o.flat != null) return R[o.flat];
      return this.tone(R, nx, ny, nz, x, y, o.shift);
    }
    ell(cx, cy, rx, ry, R, o) {
      o = o || {};
      const rot = o.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot), rm = Math.max(rx, ry) + 1;
      for (let y = Math.floor(cy - rm); y <= Math.ceil(cy + rm); y++) for (let x = Math.floor(cx - rm); x <= Math.ceil(cx + rm); x++) {
        const px = x + 0.5 - cx, py = y + 0.5 - cy;
        const lx = px * cs + py * sn, ly = -px * sn + py * cs;
        const dx = lx / rx, dy = ly / ry, r2 = dx * dx + dy * dy;
        if (r2 > 1) continue;
        if (o.test && !o.test(x + 0.5, y + 0.5, dx, dy)) continue;
        const nx = dx * cs - dy * sn, ny = dx * sn + dy * cs;
        this.put(x, y, this.col(R, o, nx * (o.nk || 1), ny * (o.nk || 1), Math.sqrt(1 - r2), x, y));
      }
    }
    cap(ax, ay, bx, by, ra, rb, R, o) {
      o = o || {};
      const vx = bx - ax, vy = by - ay, ll = vx * vx + vy * vy || 1e-6, rm = Math.max(ra, rb) + 1;
      for (let y = Math.floor(Math.min(ay, by) - rm); y <= Math.ceil(Math.max(ay, by) + rm); y++)
        for (let x = Math.floor(Math.min(ax, bx) - rm); x <= Math.ceil(Math.max(ax, bx) + rm); x++) {
          const px = x + 0.5, py = y + 0.5;
          let t = ((px - ax) * vx + (py - ay) * vy) / ll; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const qx = ax + vx * t, qy = ay + vy * t, r = ra + (rb - ra) * t;
          const dx = px - qx, dy = py - qy, d2 = dx * dx + dy * dy;
          if (d2 > r * r) continue;
          if (o.test && !o.test(px, py, t)) continue;
          const nx = dx / r, ny = dy / r;
          this.put(x, y, this.col(R, o, nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), x, y));
        }
    }
    // polyline limb through points with radii
    chain(pts, rs, R, o) { for (let i = 0; i < pts.length - 1; i++) this.cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rs[i], rs[i + 1], R, o); }
    poly(pts, R, o) {
      o = o || {};
      let y0 = 1e9, y1 = -1e9;
      pts.forEach(p => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      const H = Math.max(1, y1 - y0);
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        const py = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py)) xs.push(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xl = xs[k], xr = xs[k + 1], mid = (xl + xr) / 2 + (o.cx || 0), half = Math.max(0.5, (xr - xl) / 2);
          for (let x = Math.round(xl); x < Math.round(xr); x++) {
            const px = x + 0.5;
            if (o.test && !o.test(px, py)) continue;
            let nx = (px - mid) / half * (o.nk || 0.9), ny = ((py - y0) / H - 0.5) * (o.vg == null ? 0.5 : o.vg);
            if (o.folds) nx += Math.sin(px * o.folds[0] + (o.folds[2] || 0)) * o.folds[1];
            if (o.nfn) { const n = o.nfn(px, py, nx, ny); nx = n[0]; ny = n[1]; }
            nx = Math.max(-1, Math.min(1, nx)); ny = Math.max(-1, Math.min(1, ny));
            const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny)), m = Math.hypot(nx, ny, nz);
            this.put(x, py, this.col(R, o, nx / m, ny / m, nz / m, x, y));
          }
        }
      }
    }
    line(ax, ay, bx, by, c) {
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let i = 0; i <= n; i++) this.put(ax + (bx - ax) * i / n, ay + (by - ay) * i / n, c);
    }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, c); }
    // dark interior lines where a front group overlaps a different family behind it
    lines() {
      const { w, h, c, g, fam, flg } = this, out = c.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, gi = g[i];
        if (gi < 0 || flg[gi].indexOf('n') >= 0) continue;
        const f = fam[gi];
        const chk = j => { const gj = g[j]; return gj > gi && fam[gj] !== f && flg[gj].indexOf('n') < 0 && flg[gj].indexOf('s') < 0; };
        if ((x > 0 && chk(i - 1)) || (x < w - 1 && chk(i + 1)) || (y > 0 && chk(i - w)) || (y < h - 1 && chk(i + w))) out[i] = darkLine(c[i]);
      }
      this.c = out;
    }
    outline(col) {
      const { w, h, c, g, flg } = this, out = c.slice(), og = g.slice();
      col = col == null ? OUT : col;
      const olId = this.grp('ol', 'n').cg;
      const op = j => c[j] >= 0 && flg[g[j]].indexOf('x') < 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (c[i] >= 0) continue;
        if ((x > 0 && op(i - 1)) || (x < w - 1 && op(i + 1)) || (y > 0 && op(i - w)) || (y < h - 1 && op(i + w))) { out[i] = col; og[i] = olId; this.al[i] = 255; }
      }
      this.c = out; this.g = og;
    }
    toCanvas(flip, cv) {
      const { w, h, c, al } = this;
      cv = cv || G.makeCanvas(w, h);
      const x = cv.getContext('2d'), img = x.createImageData(w, h), d = img.data;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const i = yy * w + (flip ? w - 1 - xx : xx), v = c[i]; if (v < 0) continue;
        const o = (yy * w + xx) * 4; d[o] = R_(v); d[o + 1] = G_(v); d[o + 2] = B_(v); d[o + 3] = al[i];
      }
      x.putImageData(img, 0, 0); return cv;
    }
  }

  // ------------------------------------------------------------------
  // Shared helpers
  // ------------------------------------------------------------------
  const rad = d => d * Math.PI / 180;
  const dirv = a => [Math.cos(rad(a)), Math.sin(rad(a))];
  function ik(a, b, l1, l2, sign) {
    let dx = b[0] - a[0], dy = b[1] - a[1]; let d = Math.hypot(dx, dy);
    const mx = l1 + l2 - 0.05, mn = Math.abs(l1 - l2) + 0.5;
    if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
    if (d < mn) { const s = mn / (d || 1); dx *= s; dy *= s; d = mn; }
    const ang = Math.atan2(dy, dx), cs = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const t = ang + sign * Math.acos(Math.max(-1, Math.min(1, cs)));
    return { j: [a[0] + Math.cos(t) * l1, a[1] + Math.sin(t) * l1], e: [a[0] + dx, a[1] + dy] };
  }
  const keyMap = new WeakMap();
  function specKey(s) { let k = keyMap.get(s); if (!k) { k = JSON.stringify(s); keyMap.set(s, k); } return k; }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  const DEF = {
    skin: '#f2c49c', hair: '#7a4220', outfit: '#3a62c0', trim: '#e0b848', eyes: '#2a5aa8',
    boots: '#5c3a22', leather: '#7a4e2c', wood: '#8e5c30', steel: '#b4bccc', gold: '#e8b030', bone: '#e6dcc0', horse: '#8a5a34'
  };
  const HUMANOID = { human: 1, dwarf: 1, elf: 1, halfling: 1, birdfolk: 1, goblin: 1, orc: 1, skeleton: 1 };
  function pal(spec) {
    const s = spec || {};
    const body = s.body || 'human';
    let skin = s.skin || (body === 'goblin' ? '#7cae4a' : body === 'orc' ? '#8a9a6a' : DEF.skin);
    if (body === 'skeleton') skin = DEF.bone;
    const outfit = s.outfit || DEF.outfit;
    return {
      body, skin, hair: s.hair || DEF.hair, outfit, trim: s.trim || DEF.trim,
      pants: s.pants || G.shade(mixHex(outfit, '#40344a', 0.5), 0.9),
      boots: s.boots || DEF.boots, eyes: s.eyes || (body === 'goblin' ? '#f0d020' : body === 'skeleton' ? '#ff4020' : DEF.eyes),
      armor: s.armor || null, cape: s.cape || null, headColor: s.headColor || (s.head === 'helmet' || s.head === 'horned' ? (s.armor || DEF.steel) : s.head === 'circlet' ? DEF.gold : (s.trim || '#806040')),
      beard: s.beard || null, horse: s.horse || DEF.horse
    };
  }
  function mixHex(a, b, t) { return '#' + mix(h2i(a), h2i(b), t).toString(16).padStart(6, '0'); }
  function weaponCat(w) {
    if (w === 'sword' || w === 'mace') return 'blade';
    if (w === 'dagger') return 'dagger';
    if (w === 'axe') return 'heavy';
    if (w === 'lance' || w === 'spear') return 'pole';
    if (w === 'bow') return 'bow';
    if (w === 'staff' || w === 'rod') return 'staff';
    return 'unarmed';
  }

  // ==================================================================
  // BATTLE SPRITES (96x96, drawn facing right then mirrored)
  // ==================================================================
  const BB = { // battle body plans (px, before spec.scale)
    human: { leg: 29, tor: 19, R: 7.2, sw: 6.6, au: 11.5, al: 11, ar: 2.5, lr: 2.9 },
    elf: { leg: 31, tor: 19.5, R: 7.0, sw: 6.0, au: 12, al: 11.5, ar: 2.2, lr: 2.6 },
    dwarf: { leg: 19, tor: 17, R: 7.6, sw: 9.2, au: 10, al: 9.5, ar: 3.1, lr: 3.7 },
    halfling: { leg: 20, tor: 14.5, R: 7.3, sw: 6.0, au: 8.5, al: 8, ar: 2.1, lr: 2.5 },
    goblin: { leg: 18, tor: 14, R: 8.0, sw: 6.2, au: 10, al: 10, ar: 2.0, lr: 2.3, hunch: 16 },
    orc: { leg: 29, tor: 22, R: 7.6, sw: 10, au: 13, al: 12.5, ar: 3.5, lr: 3.9, hunch: 7 },
    skeleton: { leg: 29, tor: 19, R: 7.0, sw: 5.6, au: 11.5, al: 11, ar: 1.35, lr: 1.6 },
    birdfolk: { leg: 29, tor: 19, R: 7.0, sw: 6.2, au: 11.5, al: 11, ar: 2.3, lr: 2.6 }
  };

  const BK = 1.15; // global battle figure scale
  // pose tables: hand positions are relative to the near shoulder in units of arm length
  function getPose(cat, pose, spec) {
    const sh = !!spec.shield;
    const P = {
      blade: {
        idle: { lean: 4, ff: 0.32, fb: -0.3, hn: [0.4, 0.72], en: 1, w: -58, hf: sh ? [0.5, 0.5] : [0.15, 0.85], ef: 1 },
        ready: { lean: -8, hip: [-3, 1], ff: 0.45, fb: -0.38, hn: [-0.12, -0.9], en: 1, w: -160, hf: sh ? [0.62, 0.3] : [0.55, 0.35], ef: 1, head: -3 },
        attack: { lean: 17, hip: [5, 2], ff: 0.66, fb: -0.48, hn: [0.8, 0.36], en: 1, w: 32, hf: sh ? [0.1, 0.6] : [-0.25, 0.7], ef: 1, head: 6, arc: [-75, 32], yell: 1 }
      },
      dagger: {
        idle: { lean: 6, ff: 0.35, fb: -0.3, hn: [0.5, 0.55], en: 1, w: -25, hf: [0.4, 0.6], ef: 1, crouch: 2 },
        ready: { lean: -4, hip: [-3, 1], ff: 0.45, fb: -0.35, hn: [-0.3, 0.3], en: 1, w: -20, hf: [0.6, 0.3], ef: 1, crouch: 3 },
        attack: { lean: 18, hip: [6, 2], ff: 0.72, fb: -0.5, hn: [1, 0.12], en: 1, w: 2, hf: [-0.3, 0.6], ef: 1, head: 6, stab: 1, yell: 1 }
      },
      heavy: {
        idle: { lean: 5, ff: 0.34, fb: -0.3, hn: [0.42, 0.72], en: 1, w: -62, hf: 's', hfo: -7, ef: 1 },
        ready: { lean: -10, hip: [-4, 1], ff: 0.45, fb: -0.4, hn: [-0.08, -0.92], en: 1, w: -160, hf: 's', hfo: -6, ef: 1, head: -4 },
        attack: { lean: 20, hip: [5, 3], ff: 0.68, fb: -0.5, hn: [0.88, 0.4], en: 1, w: 34, hf: 's', hfo: -6, ef: 1, head: 8, arc: [-95, 34], yell: 1, crouch: 2 }
      },
      pole: {
        idle: { lean: 3, ff: 0.32, fb: -0.3, hn: [0.3, 0.78], en: 1, w: -78, hf: 's', hfo: 9, ef: 1 },
        ready: { lean: -6, hip: [-4, 0], ff: 0.45, fb: -0.4, hn: [-0.3, 0.45], en: 1, w: -8, hf: 's', hfo: 13, ef: 1, head: -2 },
        attack: { lean: 14, hip: [6, 2], ff: 0.72, fb: -0.5, hn: [0.42, 0.3], en: 1, w: 0, hf: 's', hfo: 13, ef: 1, head: 4, stab: 1, yell: 1 }
      },
      bow: {
        idle: { lean: 2, ff: 0.3, fb: -0.28, hn: [0.1, 0.85], en: 1, hf: [0.38, 0.75], ef: 1, w: 62 },
        ready: { lean: -2, ff: 0.42, fb: -0.36, hn: [0.02, -0.14], en: 1, hf: [0.98, 0.0], ef: 1, w: 0, draw: 1, head: 2 },
        attack: { lean: -5, hip: [-2, 0], ff: 0.42, fb: -0.36, hn: [-0.42, -0.12], en: 1, hf: [0.98, 0.0], ef: 1, w: -2, shot: 1 }
      },
      staff: {
        idle: { lean: 2, ff: 0.3, fb: -0.28, hn: [0.42, 0.74], en: 1, w: -94, hf: [0.12, 0.86], ef: 1 },
        ready: { lean: -5, hip: [-2, 0], ff: 0.38, fb: -0.3, hn: [0.55, -0.3], en: 1, w: -68, hf: [0.4, 0.22], ef: 1, head: -3, glow: 0.5 },
        attack: { lean: 13, hip: [7, 1], ff: 0.55, fb: -0.42, hn: [0.95, 0.05], en: 1, w: -18, hf: [-0.2, 0.62], ef: 1, head: 5, glow: 0.6, yell: 1 }
      },
      unarmed: {
        idle: { lean: 7, ff: 0.36, fb: -0.36, hn: [0.5, 0.3], en: 1, hf: [0.72, 0.12], ef: 1, crouch: 2 },
        ready: { lean: -3, hip: [-3, 0], ff: 0.45, fb: -0.4, hn: [-0.28, 0.34], en: 1, hf: [0.72, 0.02], ef: 1, crouch: 3 },
        attack: { lean: 17, hip: [7, 2], ff: 0.74, fb: -0.5, hn: [1.0, -0.04], en: 1, hf: [0.05, 0.45], ef: 1, head: 5, punch: 1, yell: 1 }
      }
    };
    const t = P[cat] || P.unarmed;
    let p;
    if (pose === 'cast') {
      p = { lean: -4, ff: 0.28, fb: -0.28, hn: [0.28, -0.92], en: -1, hf: [0.08, -0.88], ef: -1, w: -84, head: -9, glow: 1, cast: 1 };
      if (cat === 'heavy' || cat === 'pole') { p.hf = 's'; p.hfo = -8; }
      if (cat === 'bow') { p.hf = [0.3, -0.9]; p.hn = [0.1, -0.85]; p.w = -80; }
      if (spec.shield && cat !== 'heavy' && cat !== 'pole') { p.hf = [0.5, 0.35]; p.ef = 1; }
    } else if (pose === 'hurt') {
      p = { lean: -17, hip: [-7, -1], ff: 0.12, fb: -0.42, hn: [-0.15, 0.8], en: 1, hf: [-0.5, 0.55], ef: 1, w: cat === 'bow' ? 100 : 118, head: -16, shut: 1, lift: 1 };
      if (cat === 'heavy' || cat === 'pole') { p.hf = 's'; p.hfo = cat === 'pole' ? 8 : -6; p.w = cat === 'pole' ? -120 : 150; p.hn = [-0.1, 0.6]; }
    } else p = t[pose] || t.idle;
    if (pose === 'cast' && cat === 'staff') { p = Object.assign({}, p, { hn: [0.38, -0.62], hf: [0.3, -0.7], w: -82 }); }
    if (spec.shield && p.hf === 's') { p = Object.assign({}, p, { hf: pose === 'cast' ? [0.55, 0.2] : [0.55, 0.32], ef: 1 }); }
    if (spec.weapon === 'rod' && pose === 'idle') p = Object.assign({}, p, { hn: [0.55, 0.5], w: -55 });
    return Object.assign({ lean: 0, hip: [0, 0], ff: 0.3, fb: -0.3, crouch: 0, head: 0 }, p);
  }

  // ------------------------------------------------------------------
  // Weapon rendering (battle) — returns tip point
  // ------------------------------------------------------------------
  function drawWeapon(B, spec, P, hand, ang, k, pose, far) {
    const w = spec.weapon, d = dirv(ang), n = [-d[1], d[0]];
    const at = (u, v) => [hand[0] + d[0] * u + n[0] * v, hand[1] + d[1] * u + n[1] * v];
    const steel = ramp(spec.weaponColor || DEF.steel, 'metal'), wood = ramp(DEF.wood), gold = ramp(DEF.gold, 'metal'), leather = ramp(DEF.leather);
    let tip = at(10 * k, 0);
    B.grp('weapon');
    if (w === 'sword' || w === 'dagger') {
      const L = (w === 'sword' ? 22 : 11) * k, bw = (w === 'sword' ? 1.7 : 1.4) * k;
      const g0 = at(-4 * k, 0), g1 = at(2, 0);
      B.cap(g0[0], g0[1], g1[0], g1[1], 1.2 * k, 1.2 * k, leather);
      const pm = at(-5 * k, 0); B.ell(pm[0], pm[1], 1.6 * k, 1.6 * k, gold);
      const b0 = at(2.5 * k, 0), b1 = at(L - 2, 0); tip = at(L + 1, 0);
      B.poly([at(2.5 * k, -bw), at(L - 3, -bw), tip, at(L - 3, bw), at(2.5 * k, bw)], steel, { nfn: (x, y) => { const v = (x - hand[0]) * n[0] + (y - hand[1]) * n[1]; return [n[0] * v / bw * 0.9 - 0.2, n[1] * v / bw * 0.9 - 0.2]; } });
      // fuller / edge highlight
      B.line(at(3 * k, -0.3)[0], at(3 * k, -0.3)[1], at(L - 4, -0.3)[0], at(L - 4, -0.3)[1], steel[4]);
      const c0 = at(2 * k, -4.5 * k), c1 = at(2 * k, 4.5 * k);
      B.grp('guard'); B.cap(c0[0], c0[1], c1[0], c1[1], 1.2 * k, 1.2 * k, gold);
      void b0; void b1;
    } else if (w === 'mace') {
      const a = at(-4 * k, 0), b = at(15 * k, 0);
      B.cap(a[0], a[1], b[0], b[1], 1.2 * k, 1.3 * k, wood);
      const h = at(18 * k, 0); tip = at(22 * k, 0);
      B.grp('whead');
      for (let i = 0; i < 6; i++) { const a2 = ang + i * 60; const q = [h[0] + Math.cos(rad(a2)) * 4.2 * k, h[1] + Math.sin(rad(a2)) * 4.2 * k]; B.ell(q[0], q[1], 1.5 * k, 1.5 * k, steel); }
      B.ell(h[0], h[1], 3.6 * k, 3.6 * k, steel);
    } else if (w === 'axe') {
      const a = at(-10 * k, 0), b = at(24 * k, 0);
      B.cap(a[0], a[1], b[0], b[1], 1.3 * k, 1.4 * k, wood);
      B.grp('whead');
      const u0 = 16 * k, u1 = 25 * k;
      B.poly([at(u0 + 1, -1.5 * k), at(u1 - 1, -1.5 * k), at(u1 + 2 * k, -7 * k), at(u1 - 1 * k, -10 * k), at(u0 - 3 * k, -10.5 * k), at(u0 - 2 * k, -7 * k)], steel, { nfn: (x, y) => { const u = (x - hand[0]) * d[0] + (y - hand[1]) * d[1]; const t = (u - (u0 + u1) / 2) / 6; return [d[0] * t - 0.3, d[1] * t - 0.3]; } });
      // back spike
      B.poly([at(u0 + 2, 1.2 * k), at(u1 - 3, 1.2 * k), at((u0 + u1) / 2, 5 * k)], steel);
      const e0 = at(u0 - 3 * k, -10 * k), e1 = at(u1 + 1.5 * k, -7 * k);
      B.line(e0[0], e0[1], e1[0], e1[1], steel[4]);
      tip = at((u0 + u1) / 2, -10 * k);
    } else if (w === 'lance') {
      const lc = ramp(spec.lanceColor || mixHex(spec.trim || DEF.trim, '#f0e8d8', 0.35));
      const a = at(-12 * k, 0), b = at(36 * k, 0); tip = at(40 * k, 0);
      B.cap(a[0], a[1], b[0], b[1], 1.8 * k, 0.8 * k, lc);
      B.grp('whead'); B.cap(at(33 * k, 0)[0], at(33 * k, 0)[1], tip[0], tip[1], 1.2 * k, 0.5, steel);
      B.grp('vamp'); const vp = at(4 * k, 0);
      B.ell(vp[0], vp[1], 1.8 * k, 4 * k, steel, { rot: rad(ang) });
      // stripes on shaft
      B.grp('weapon');
      for (let u = 10; u < 32; u += 7) { const s0 = at(u * k, -2), s1 = at(u * k + 2, 2); B.only = ['weapon']; B.line(s0[0], s0[1], s1[0], s1[1], lc[1]); B.only = null; }
    } else if (w === 'spear') {
      const a = at(-18 * k, 0), b = at(26 * k, 0);
      B.cap(a[0], a[1], b[0], b[1], 1.1 * k, 1.1 * k, wood);
      B.grp('whead');
      const hb = 25 * k, ht = 34 * k; tip = at(ht, 0);
      B.poly([at(hb, 0), at(hb + 3 * k, -2.6 * k), at(ht, 0), at(hb + 3 * k, 2.6 * k)], steel, { nfn: (x, y) => { const v = (x - hand[0]) * n[0] + (y - hand[1]) * n[1]; return [n[0] * v / 2.5 - 0.3, n[1] * v / 2.5 - 0.3]; } });
      B.grp('tassel'); const ts = at(hb - 1, 0); B.ell(ts[0], ts[1] + 2, 1.4, 2.5, ramp(spec.trim || '#c03030'));
    } else if (w === 'staff' || w === 'rod') {
      const long = w === 'staff';
      const a = at((long ? -20 : -6) * k, 0), L = (long ? 25 : 17) * k, b = at(L, 0);
      if (long) {
        B.chain([a, at(-4, 0.5), at(8 * k, -0.4), at(18 * k, 0.5), b], [1.3 * k, 1.4 * k, 1.3 * k, 1.4 * k, 1.5 * k], wood);
        // head: curled wood holding orb
        B.grp('whead');
        const o = at(L + 3.5 * k, 0);
        B.chain([at(L - 2, 0), at(L + 2 * k, -3.2 * k), at(L + 6 * k, -2.5 * k), at(L + 7.5 * k, 0.5)], [1.4 * k, 1.3 * k, 1.2 * k, 1 * k], wood);
        B.grp('gem'); B.ell(o[0], o[1], 2.6 * k, 2.6 * k, ramp(spec.gem || spec.trim || '#e04040', 'metal'));
        tip = o;
      } else {
        B.cap(a[0], a[1], b[0], b[1], 1.2 * k, 1.2 * k, gold);
        B.grp('gem'); const o = at(L + 2.5 * k, 0);
        B.ell(o[0], o[1], 2.8 * k, 2.8 * k, ramp(spec.gem || '#40a0f0', 'metal'));
        const w0 = at(L, -3 * k), w1 = at(L, 3 * k); B.grp('whead'); B.cap(w0[0], w0[1], w1[0], w1[1], 1, 1, gold);
        tip = o;
      }
    } else if (w === 'claws') {
      B.grp('claws');
      for (let i = -1; i <= 1; i++) { const a = at(0, i * 1.6 * k), b = at(8 * k, i * 2.3 * k); B.cap(a[0], a[1], b[0], b[1], 0.9, 0.5, steel); }
      tip = at(8 * k, 0);
    } else {
      tip = at(2 * k, 0);
    }
    return tip;
  }

  function drawBow(B, spec, hand, ang, k, drawHand, arrow) {
    const d = dirv(ang), n = [-d[1], d[0]];
    const at = (u, v) => [hand[0] + d[0] * u + n[0] * v, hand[1] + d[1] * u + n[1] * v];
    const wood = ramp(spec.bowColor || '#9a6434'), half = 17 * k, bend = drawHand ? 7 * k : 4.5 * k;
    const pts = [];
    for (let i = -4; i <= 4; i++) { const t = i / 4; pts.push(at(bend * (1 - t * t) - bend * 0.6, t * half)); }
    B.grp('bow');
    B.chain(pts, pts.map((p, i) => (i === 0 || i === 8) ? 0.8 : 1.3 * k), wood);
    const tA = pts[0], tB = pts[8], str = 0xe8e0d0;
    B.grp('string', 'n');
    if (drawHand) { B.line(tA[0], tA[1], drawHand[0], drawHand[1], str); B.line(tB[0], tB[1], drawHand[0], drawHand[1], str); }
    else { B.line(tA[0], tA[1], tB[0], tB[1], str); }
    let tip = at(4 * k, 0);
    if (arrow) {
      B.grp('arrow');
      const a0 = arrow[0], a1 = arrow[1];
      B.line(a0[0], a0[1], a1[0], a1[1], 0xc09060);
      const dd = [a1[0] - a0[0], a1[1] - a0[1]], m = Math.hypot(dd[0], dd[1]); const u = [dd[0] / m, dd[1] / m];
      B.poly([[a1[0] + u[0] * 3, a1[1] + u[1] * 3], [a1[0] - u[1] * 1.6, a1[1] + u[0] * 1.6], [a1[0] + u[1] * 1.6, a1[1] - u[0] * 1.6]], ramp(DEF.steel, 'metal'), { flat: 3 });
      B.put(a0[0] - u[1], a0[1] + u[0], 0xe03030); B.put(a0[0] + u[1], a0[1] - u[0], 0xe03030);
      B.put(a0[0] + u[0] - u[1], a0[1] + u[1] + u[0], 0xf0f0f0);
      tip = [a1[0] + u[0] * 3, a1[1] + u[1] * 3];
    }
    return tip;
  }

  // ------------------------------------------------------------------
  // Head (battle, 3/4 view facing right)
  // ------------------------------------------------------------------
  function drawHeadBattle(B, spec, C, hx, hy, R, k, P, pose) {
    const body = C.body, skinR = ramp(C.skin, body === 'skeleton' ? 'cloth' : 'skin');
    const hairR = ramp(C.hair, 'hair');
    const hs = spec.hairStyle || 'short', head = spec.head;
    const hooded = head === 'hood', helm = head === 'helmet' || head === 'horned';
    const fullHelm = head === 'horned';
    const shadowFace = hooded ? -1 : 0;
    // back hair (long styles) behind head
    if (body !== 'skeleton' && body !== 'birdfolk' && !hooded && !fullHelm) {
      B.grp('hair:back');
      if (hs === 'long') B.poly([[hx - R * 0.9, hy - R * 0.4], [hx + R * 0.1, hy - R * 0.2], [hx - R * 0.1, hy + R * 2.1], [hx - R * 0.8, hy + R * 2.3], [hx - R * 1.35, hy + R * 1.4]], hairR, { folds: [0.9, 0.35] });
      if (hs === 'ponytail') B.chain([[hx - R * 0.8, hy - R * 0.5], [hx - R * 1.5, hy - R * 0.1], [hx - R * 1.75, hy + R * 0.9], [hx - R * 1.5, hy + R * 1.7]], [2.2 * k, 2.6 * k, 2.0 * k, 1.1 * k], hairR);
      if (hs === 'braid') for (let i = 0; i < 5; i++) B.ell(hx - R * 0.95 - i * 0.2, hy + R * (0.3 + i * 0.42), 2.1 * k - i * 0.15, 1.9 * k, hairR);
    }
    // neck
    B.grp('head:neck');
    B.cap(hx - R * 0.15, hy + R * 0.6, hx - R * 0.2, hy + R * 1.35, R * 0.33, R * 0.36, skinR, { shift: -1 });
    // skull + jaw
    B.grp('head');
    if (body === 'skeleton') {
      B.ell(hx, hy - R * 0.08, R * 0.95, R * 0.92, skinR);
      B.ell(hx + R * 0.35, hy + R * 0.55, R * 0.5, R * 0.36, skinR, { shift: -1 });
    } else {
      B.ell(hx, hy, R * 0.95, R, skinR, { shift: shadowFace });
      B.ell(hx + R * 0.32, hy + R * 0.42, R * 0.6, R * 0.52, skinR, { shift: shadowFace });
      if (body === 'goblin') { B.poly([[hx + R * 0.8, hy - R * 0.1], [hx + R * 1.45, hy + R * 0.35], [hx + R * 0.8, hy + R * 0.35]], skinR); }
      else if (body === 'birdfolk') { /* beak drawn later */ }
      else B.rect(hx + R * 0.93, hy + R * 0.12, 1, 1, skinR[2]); // nose bump
    }
    // ears
    if (!hooded && !fullHelm) {
      B.grp('ear');
      if (body === 'elf') B.poly([[hx - R * 0.35, hy - R * 0.05], [hx - R * 0.05, hy + R * 0.4], [hx - R * 1.3, hy - R * 0.75]], skinR);
      else if (body === 'goblin') B.poly([[hx - R * 0.3, hy - R * 0.25], [hx - R * 0.1, hy + R * 0.35], [hx - R * 1.9, hy - R * 0.3]], skinR);
      else if (body === 'orc') B.poly([[hx - R * 0.35, hy - R * 0.15], [hx - R * 0.05, hy + R * 0.35], [hx - R * 1.0, hy - R * 0.45]], skinR);
      else if (body !== 'skeleton' && body !== 'birdfolk') B.ell(hx - R * 0.2, hy + R * 0.12, R * 0.22, R * 0.3, skinR);
    }
    // hair
    const hairTest = (px, py) => {
      const dx = (px - hx) / R, dy = (py - hy) / R;
      const fringe = -0.3 + ((Math.floor(px) % 3 === 0) ? 0.18 : 0) - dx * 0.12;
      if (dx > -0.05 && dy > fringe) return false; // face
      if (dx > -0.55 && dy > 0.05 && dx < 0.2) return dx < -0.38 && dy < 0.35; // ear gap
      return dy < 0.55;
    };
    if (body === 'birdfolk') {
      B.grp('hair');
      // feather crest swept back
      B.ell(hx - R * 0.1, hy - R * 0.2, R * 1.02, R * 0.9, hairR, { test: (px, py) => { const dx = (px - hx) / R, dy = (py - hy) / R; return !(dx > 0.05 && dy > -0.35) && dy < 0.5; } });
      for (let i = 0; i < 3; i++) { const a = rad(-28 + i * 22); B.ell(hx - R * (0.95 + i * 0.12), hy - R * (0.72 - i * 0.42), R * 0.85, R * 0.24, hairR, { rot: a }); }
      B.ell(hx - R * 0.2, hy - R * 1.0, R * 0.6, R * 0.2, hairR, { rot: rad(-12) });
      B.grp('beak');
      const hr = ramp('#e0a830', 'metal');
      B.poly([[hx + R * 0.7, hy - R * 0.12], [hx + R * 1.55, hy + R * 0.12], [hx + R * 1.3, hy + R * 0.48], [hx + R * 0.7, hy + R * 0.42]], hr);
    } else if (body !== 'skeleton' && hs !== 'bald' && !hooded && !fullHelm) {
      B.grp('hair');
      const rx = R * (hs === 'curly' ? 1.18 : 1.07), ry = R * (hs === 'curly' ? 1.1 : 1.02);
      B.ell(hx - R * 0.08, hy - R * 0.14, rx, ry, hairR, { test: (px, py, dx, dy) => { if (!hairTest(px, py)) return false; if (hs === 'curly') { const a = Math.atan2(dy, dx); return Math.hypot(dx, dy) < 0.86 + 0.14 * Math.cos(a * 9); } return true; } });
      if (hs === 'spiky') {
        for (let i = 0; i < 5; i++) {
          const a = rad(-80 - i * 30), bx = hx - R * 0.1 + Math.cos(a) * R * 0.7, by = hy - R * 0.2 + Math.sin(a) * R * 0.7;
          const tx = hx - R * 0.1 + Math.cos(a - 0.25) * R * 1.6, ty = hy - R * 0.2 + Math.sin(a - 0.25) * R * 1.55;
          B.poly([[bx + Math.cos(a + 1.57) * 2.6 * k, by + Math.sin(a + 1.57) * 2.6 * k], [tx, ty], [bx - Math.cos(a + 1.57) * 2.6 * k, by - Math.sin(a + 1.57) * 2.6 * k]], hairR);
        }
        B.poly([[hx + R * 0.2, hy - R * 0.9], [hx + R * 1.25, hy - R * 0.55], [hx + R * 0.5, hy - R * 0.35]], hairR);
      }
      if (hs === 'ponytail' || hs === 'braid') { B.grp('tie'); B.ell(hx - R * 0.85, hy - R * 0.35, 1.4 * k, 1.6 * k, ramp(C.trim)); }
      if (hs === 'long') B.poly([[hx - R * 0.9, hy - R * 0.2], [hx - R * 0.2, hy], [hx - R * 0.5, hy + R * 1.3], [hx - R * 1.1, hy + R * 0.9]], hairR, { folds: [1.1, 0.4] });
    } else if (hs === 'bald' && body !== 'skeleton' && !hooded && !helm && spec.age === 'old') {
      B.grp('hair'); B.ell(hx - R * 0.6, hy + R * 0.05, R * 0.35, R * 0.35, hairR);
    }
    // beard
    if (C.beard && body !== 'skeleton' && !fullHelm) {
      B.grp('beard');
      const bR = ramp(C.beard, 'hair'), long = body === 'dwarf' ? 1.5 : 0.9;
      B.poly([[hx - R * 0.15, hy + R * 0.05], [hx + R * 0.95, hy + R * 0.3], [hx + R * 1.05, hy + R * (0.6 + long * 0.4)], [hx + R * 0.45, hy + R * (0.7 + long)], [hx - R * 0.1, hy + R * (0.5 + long * 0.6)], [hx - R * 0.35, hy + R * 0.3]], bR, { folds: [1.2, 0.3] });
      B.grp('head:mouth'); // keep mouth area visible
      B.ell(hx + R * 0.68, hy + R * 0.5, R * 0.18, R * 0.1, skinR, { flat: 1 });
      B.grp('beard:m');
      B.poly([[hx + R * 0.35, hy + R * 0.3], [hx + R * 1.05, hy + R * 0.34], [hx + R * 0.95, hy + R * 0.48], [hx + R * 0.55, hy + R * 0.44]], bR);
    }
    // headgear
    const hc = C.headColor;
    if (head === 'helmet' || head === 'horned') {
      const mR = ramp(hc, 'metal');
      B.grp('hat');
      B.ell(hx - R * 0.05, hy - R * 0.18, R * 1.12, R * 1.02, mR, { test: (px, py) => { const dx = (px - hx) / R, dy = (py - hy) / R; if (fullHelm) return dy < 0.95 && !(dx > 0.85 && dy > 0.25); return dy < -0.12 || (dx < -0.2 && dy < 0.55); } });
      if (!fullHelm) {
        B.grp('hat:rim'); B.cap(hx - R * 1.05, hy - R * 0.08, hx + R * 1.05, hy - R * 0.2, 1.1 * k, 1.1 * k, mR, { shift: -1 });
        B.cap(hx + R * 0.72, hy - R * 0.18, hx + R * 0.8, hy + R * 0.35, 0.9 * k, 0.7 * k, mR); // nasal
        B.grp('crest'); B.chain([[hx - R * 0.2, hy - R * 1.05], [hx - R * 0.8, hy - R * 1.2], [hx - R * 1.4, hy - R * 0.9]], [1.8 * k, 2.2 * k, 1.2 * k], ramp(C.trim));
      } else {
        B.grp('hat:rim'); B.cap(hx - R * 1.0, hy - R * 0.25, hx + R * 1.02, hy - R * 0.25, 1.2 * k, 1.2 * k, mR, { shift: -1 });
        B.grp('horn');
        const bn = ramp('#eadcc0');
        B.chain([[hx - R * 0.35, hy - R * 0.7], [hx - R * 1.05, hy - R * 1.15], [hx - R * 1.2, hy - R * 1.75], [hx - R * 0.85, hy - R * 2.15]], [2.4 * k, 2.0 * k, 1.4 * k, 0.6], bn);
        B.grp('horn:b');
        B.chain([[hx + R * 0.35, hy - R * 0.8], [hx + R * 0.75, hy - R * 1.3], [hx + R * 1.2, hy - R * 1.65], [hx + R * 1.7, hy - R * 1.6]], [2.0 * k, 1.7 * k, 1.1 * k, 0.6], bn);
      }
    } else if (head === 'hood') {
      const cR = ramp(hc);
      B.grp('hat');
      B.ell(hx - R * 0.15, hy - R * 0.05, R * 1.22, R * 1.18, cR, { test: (px, py) => { const dx = (px - hx) / R, dy = (py - hy) / R; return !(dx > 0.0 && dy > -0.45 + dx * 0.1 && dy < 1.0) || dx > 0.95; } });
      B.poly([[hx - R * 1.3, hy], [hx + R * 0.2, hy + R * 0.8], [hx + R * 0.6, hy + R * 1.6], [hx - R * 1.4, hy + R * 1.7]], cR, { folds: [0.8, 0.3] });
      B.poly([[hx + R * 0.1, hy - R * 1.1], [hx + R * 1.15, hy - R * 0.5], [hx + R * 0.9, hy - R * 0.2], [hx + R * 0.1, hy - R * 0.5]], cR, { shift: 1 });
    } else if (head === 'hat' || head === 'wizardhat') {
      const cR = ramp(hc);
      B.grp('hat');
      if (head === 'wizardhat') {
        B.poly([[hx - R * 0.95, hy - R * 0.45], [hx + R * 0.85, hy - R * 0.55], [hx + R * 0.1, hy - R * 1.7], [hx - R * 0.7, hy - R * 2.5], [hx - R * 1.6, hy - R * 2.4], [hx - R * 0.8, hy - R * 1.6]], cR, { vg: 0.8 });
        B.grp('hat:band'); B.poly([[hx - R * 0.95, hy - R * 0.45], [hx + R * 0.85, hy - R * 0.55], [hx + R * 0.72, hy - R * 0.85], [hx - R * 0.85, hy - R * 0.75]], ramp(C.trim, 'metal'));
        B.grp('hat:brim'); B.ell(hx - R * 0.05, hy - R * 0.45, R * 1.75, R * 0.3, cR, { rot: rad(-4) });
        B.grp('star', 'n'); B.put(hx - R * 0.3, hy - R * 1.35, 0xfff080); B.put(hx - R * 0.3 + 1, hy - R * 1.35, 0xfff080); B.put(hx - R * 0.3, hy - R * 1.35 + 1, 0xfff080); B.put(hx - R * 0.3 + 1, hy - R * 1.35 + 1, 0xffffff);
      } else {
        B.ell(hx - R * 0.1, hy - R * 0.75, R * 0.85, R * 0.6, cR, { test: (px, py) => py < hy - R * 0.45 });
        B.grp('hat:band'); B.cap(hx - R * 0.9, hy - R * 0.55, hx + R * 0.7, hy - R * 0.62, 1.1, 1.1, ramp(C.trim));
        B.grp('hat:brim'); B.ell(hx, hy - R * 0.45, R * 1.6, R * 0.26, cR, { rot: rad(-5) });
        B.grp('feather'); B.chain([[hx - R * 0.8, hy - R * 0.6], [hx - R * 1.4, hy - R * 1.3], [hx - R * 1.6, hy - R * 1.8]], [1.4, 1.7, 0.6], ramp('#e04830'));
      }
    } else if (head === 'bandana') {
      const cR = ramp(hc);
      B.grp('hat');
      B.ell(hx - R * 0.05, hy - R * 0.2, R * 1.02, R * 1.02, cR, { test: (px, py) => { const dy = (py - hy) / R; return dy > -0.72 && dy < -0.28; } });
      B.chain([[hx - R * 0.9, hy - R * 0.45], [hx - R * 1.5, hy - R * 0.2], [hx - R * 2.0, hy + R * 0.25]], [1.6 * k, 1.4 * k, 0.8], cR);
      B.chain([[hx - R * 0.9, hy - R * 0.45], [hx - R * 1.6, hy - R * 0.55], [hx - R * 2.2, hy - R * 0.35]], [1.6 * k, 1.3 * k, 0.8], cR);
    } else if (head === 'circlet') {
      B.grp('hat');
      const gR = ramp(hc, 'metal');
      B.ell(hx - R * 0.05, hy - R * 0.2, R * 1.04, R * 1.02, gR, { test: (px, py) => { const dy = (py - hy) / R; return dy > -0.55 && dy < -0.38; } });
      B.grp('gem'); B.ell(hx + R * 0.72, hy - R * 0.5, 1.2, 1.3, ramp(spec.gem || '#40c0e0', 'metal'));
    }
    return { hx, hy, R, hooded, fullHelm, skinR };
  }

  function drawFaceBattle(B, spec, C, H, P, pose, k) {
    const { hx, hy, R } = H, body = C.body;
    B.only = ['head', 'beard', 'face']; B.grp('face', 'n');
    const eyeC = h2i(C.eyes), dark = 0x1c1020;
    const ey = Math.round(hy - R * 0.02), ex = Math.round(hx + R * 0.28), fx = Math.round(hx + R * 0.82);
    if (H.fullHelm) {
      B.only = ['hat', 'visor']; B.grp('visor', 'n');
      B.line(hx + R * 0.15, ey, hx + R * 1.0, ey - 1, 0x0c0610); B.line(hx + R * 0.2, ey + 1, hx + R * 0.95, ey, 0x0c0610);
      B.line(hx + R * 0.72, ey + 1, hx + R * 0.72, hy + R * 0.7, 0x0c0610);
      B.put(ex, ey, eyeC); B.put(ex + 1, ey, lighten(eyeC, 0.6)); B.put(ex + 2, ey, eyeC); B.put(fx, ey - 1, eyeC); B.put(fx + 1, ey - 1, lighten(eyeC, 0.5));
      B.only = null; return;
    }
    if (body === 'skeleton') {
      B.rect(ex - 1, ey - 1, 3, 3, dark); B.rect(fx, ey - 1, 2, 3, dark);
      B.put(ex, ey, eyeC); B.put(fx, ey, eyeC);
      B.put(hx + R * 0.85, hy + R * 0.3, dark);
      for (let i = 0; i < 4; i++) B.put(hx + R * 0.2 + i * 1.3, hy + R * 0.72, dark);
      B.only = null; return;
    }
    const brow = H.skinR[0];
    if (P.shut) {
      B.put(ex - 1, ey - 1, dark); B.put(ex, ey, dark); B.put(ex + 1, ey, dark); B.put(ex, ey + 1, dark); B.put(ex - 1, ey + 1, dark);
      B.put(fx, ey, dark); B.put(fx + 1, ey, dark);
    } else {
      const angry = body === 'goblin' || body === 'orc' || pose === 'attack' || pose === 'ready';
      const irisD = mul(eyeC, 0.55);
      B.put(ex - 1, ey - 1, dark); B.put(ex, ey - 1, dark); B.put(ex + 1, ey - 1, dark);
      B.put(ex, ey, 0xffffff); B.put(ex + 1, ey, irisD);
      B.put(ex, ey + 1, eyeC); B.put(ex + 1, ey + 1, irisD);
      B.put(ex - 1, ey, 0xf0f0f0);
      B.put(fx, ey - 1, dark); B.put(fx, ey, irisD); B.put(fx, ey + 1, eyeC);
      if (!H.hooded && body !== 'birdfolk') { B.put(ex - 1, ey - 3 + (angry ? 1 : 0), mul(h2i(C.hair), 0.6)); B.put(ex, ey - 3, mul(h2i(C.hair), 0.6)); B.put(ex + 1, ey - 3 + (angry ? 1 : 0), mul(h2i(C.hair), 0.6)); }
      if (body === 'birdfolk') { B.put(ex - 1, ey + 2, h2i(C.trim)); B.put(ex, ey + 2, h2i(C.trim)); B.put(ex - 2, ey + 1, h2i(C.trim)); }
      if (spec.glowEyes || H.hooded && spec.glowEyes !== false && spec.enemy) { B.put(ex, ey, 0xffffff); B.put(ex + 1, ey, eyeC); B.put(fx, ey, eyeC); }
    }
    void brow;
    // mouth
    const mx = Math.round(hx + R * 0.62), my = Math.round(hy + R * 0.55);
    if (body !== 'birdfolk') {
      if (P.yell || P.shut) { B.put(mx, my, 0x401018); B.put(mx + 1, my, 0x401018); B.put(mx, my + 1, 0x802030); B.put(mx + 1, my + 1, 0x401018); }
      else { B.put(mx, my, mul(H.skinR[0], 0.9)); B.put(mx + 1, my, H.skinR[0]); }
      if (body === 'orc') { B.only = null; B.grp('tusk'); B.put(mx + 1, my - 1, 0xfff8e0); B.put(mx + 1, my - 2, 0xfff8e0); B.put(mx - 1, my - 1, 0xe8e0c0); }
      if (body === 'goblin') { B.put(mx + 1, my + 1, 0xffffff); }
    }
    B.only = null;
  }

  // ------------------------------------------------------------------
  // Humanoid battle figure
  // ------------------------------------------------------------------
  function battleHumanoid(B, spec, pose, opt) {
    opt = opt || {};
    const C = pal(spec), body = C.body, bp = BB[body] || BB.human, k = (1 + ((spec.scale || 1) - 1) * 0.45) * (opt.k || 1) * BK;
    const cat = weaponCat(spec.weapon), P = getPose(cat, pose, spec);
    const L = bp.leg * k, T = bp.tor * k, R = bp.R * k, SW = bp.sw * k, AU = bp.au * k, AL = bp.al * k, A = AU + AL, AR = bp.ar * k, LR = bp.lr * k;
    const hover = spec.wings && !opt.seat ? 5 : 0;
    const gy = (opt.ground || 90) - hover;
    const baseX = opt.x || 39;
    const hip0 = opt.seat ? [opt.seat[0] + (P.hip[0] * 0.3), opt.seat[1]] : [baseX + P.hip[0], 0];
    // feet
    const ankY = gy - 2 * k;
    let fF = [hip0[0] + P.ff * L, ankY], fB = [hip0[0] + P.fb * L, ankY];
    if (P.lift) fF[1] -= 3 * k;
    if (!opt.seat) {
      const mdx = hover ? 0 : Math.max(Math.abs(fF[0] - hip0[0]), Math.abs(fB[0] - hip0[0]));
      hip0[1] = ankY - Math.sqrt(Math.max(1, (0.97 * L) ** 2 - mdx * mdx)) + (P.crouch || 0) * k + P.hip[1] * 0.5;
      if (hover) { const sw = pose === 'attack' ? 0.35 : pose === 'hurt' ? -0.1 : 0.15; fF = [hip0[0] + L * sw, hip0[1] + L * 0.88]; fB = [hip0[0] - L * 0.15, hip0[1] + L * 0.86]; }
    }
    const lean = rad(P.lean + (bp.hunch || 0) * (opt.seat ? 0.3 : 1));
    const up = [Math.sin(lean), -Math.cos(lean)], fw = [Math.cos(lean), Math.sin(lean)];
    const hip = hip0;
    const tp = (a, l) => [hip[0] + fw[0] * a + up[0] * l, hip[1] + fw[1] * a + up[1] * l];
    const S = tp(0, T);
    const shN = tp(SW * 0.05, T - 2.5 * k), shF = tp(-SW * 0.35, T - 3 * k);
    const hl = rad(P.head || 0);
    const hc = [S[0] + up[0] * (2 * k + R * 0.95) + R * 0.12 + (bp.hunch ? bp.hunch * 0.28 * k : 0), S[1] + up[1] * (2 * k + R * 0.95) + (bp.hunch ? bp.hunch * 0.08 * k : 0)];
    hc[0] += Math.sin(hl) * R * 0.3;
    // hands
    const hN = [shN[0] + P.hn[0] * A, shN[1] + P.hn[1] * A];
    const armN = ik(shN, hN, AU, AL, P.en);
    const wAng = P.w == null ? 0 : P.w;
    let hF;
    if (P.hf === 's') { const d = dirv(wAng); hF = [armN.e[0] + d[0] * P.hfo * k, armN.e[1] + d[1] * P.hfo * k]; }
    else hF = [shF[0] + P.hf[0] * A, shF[1] + P.hf[1] * A];
    const armF = ik(shF, hF, AU, AL, P.ef);
    const legF = ik(hip, fF, L * 0.5, L * 0.5, -1), legB = ik(hip, fB, L * 0.5, L * 0.5, -1);
    const skinR = ramp(C.skin, body === 'skeleton' ? 'cloth' : 'skin'), outR = ramp(C.outfit), trimR = ramp(C.trim), pantsR = ramp(C.pants), bootR = ramp(C.boots);
    const metR = C.armor ? ramp(C.armor, 'metal') : null;
    const bones = body === 'skeleton';
    const sleeve = spec.robe ? outR : (bones ? skinR : outR);
    const gloveR = metR || (body === 'birdfolk' ? ramp('#c89030') : skinR);
    let tip = null;

    // ---- wings (behind everything): folded on the back, open when casting/hurt/hovering
    if (spec.wings || body === 'birdfolk') {
      const wc = spec.wingColor || C.hair, wR = ramp(wc, 'hair'), wD = ramp(G.shade(wc, 0.72), 'hair'), wL = ramp(mixHex(wc, '#fff4e0', 0.45), 'hair');
      const open = pose === 'cast' ? 1 : pose === 'hurt' ? 0.75 : pose === 'ready' ? 0.85 : pose === 'attack' ? 0.3 : hover ? 0.7 : 0;
      const base = tp(-SW * 0.35, T - 3 * k), len = 32 * k;
      const TR = [[0.97, 0.12], [0.88, 0.2], [0.86, 0.5], [0.76, 0.42], [0.72, 0.78], [0.62, 0.62], [0.57, 0.92], [0.47, 0.72], [0.42, 0.97], [0.32, 0.74], [0.26, 0.86], [0.1, 0.62], [0, 0.3]];
      const wing = (off, sh, g, sc) => {
        const a = rad(98 + open * 132 + off), d = [Math.cos(a), Math.sin(a)];
        let n = [-d[1], d[0]]; if (n[0] > 0) n = [-n[0], -n[1]];
        const Lw = len * sc * (0.85 + open * 0.2), Ww = (9 + open * 7) * k * sc;
        const P = (u, v) => [base[0] + d[0] * u * Lw + n[0] * v * Ww, base[1] + d[1] * u * Lw + n[1] * v * Ww];
        B.grp(g);
        const pts = [P(0, -0.35), P(0.25, -0.55), P(0.6, -0.42), P(1, 0)].concat(TR.map(q => P(q[0], q[1])));
        B.poly(pts, wD, { shift: sh, nk: 0.6, vg: 0.4 });
        B.grp(g + ':c');
        B.poly([P(0, -0.35), P(0.25, -0.55), P(0.55, -0.42), P(0.58, 0.1), P(0.48, 0.42), P(0.38, 0.3), P(0.28, 0.45), P(0.17, 0.32), P(0.06, 0.4), P(0, 0.3)], wR, { shift: sh, nk: 0.7, vg: 0.5 });
        B.grp(g + ':m'); B.poly([P(0, -0.35), P(0.25, -0.55), P(0.4, -0.45), P(0.3, -0.1), P(0.05, 0.05)], wL, { shift: sh, nk: 0.5 });
        B.only = [g]; B.grp(g + ':q', 'n');
        for (let i = 1; i < TR.length - 2; i += 2) { const q = TR[i], e = P(q[0] - 0.14, q[1] - 0.5); const o = P(q[0], q[1]); B.line(o[0], o[1], e[0], e[1], wD[0]); }
        B.only = null;
      };
      wing(16 + open * 8, -1, 'wingF', 0.92);
      wing(0, 0, 'wingN', 1);
    }
    // ---- cape
    if (C.cape) {
      B.grp('cape');
      const cR = ramp(C.cape), flow = pose === 'attack' ? 14 : pose === 'hurt' ? -2 : pose === 'ready' ? 6 : 3;
      const top = tp(-SW * 0.2, T + 1), topB = tp(-SW * 0.9, T - 3), hem = gy - 6 * k;
      B.poly([top, tp(SW * 0.2, T - 1), [hip[0] - 3 * k, hem], [hip[0] - 10 * k - flow, hem + 2], [topB[0] - 5 * k - flow * 0.6, (topB[1] + hem) / 2], topB], cR, { folds: [0.55, 0.45], nk: 0.5 });
    }
    // ---- far arm
    const drawArm = (arm, sh, grp, isNear) => {
      B.grp(grp);
      const e = arm.j, h = arm.e;
      if (bones) {
        B.cap(sh[0], sh[1], e[0], e[1], AR, AR, skinR); B.cap(e[0], e[1], h[0], h[1], AR, AR * 0.9, skinR);
        B.ell(e[0], e[1], AR * 1.3, AR * 1.3, skinR);
      } else {
        B.cap(sh[0], sh[1], e[0], e[1], AR * 1.12, AR * 0.95, (C.armor && !spec.robe) ? ramp(G.shade(C.armor, 0.75), 'metal') : sleeve);
        const fore = spec.robe ? outR : (C.armor ? metR : (body === 'birdfolk' ? outR : skinR));
        B.cap(e[0], e[1], h[0], h[1], AR * 0.95, AR * 0.85, fore);
        if (spec.robe) { B.grp(grp + ':cuff'); const m = [e[0] + (h[0] - e[0]) * 0.72, e[1] + (h[1] - e[1]) * 0.72]; B.cap(m[0], m[1], e[0] + (h[0] - e[0]) * 0.88, e[1] + (h[1] - e[1]) * 0.88, AR * 1.25, AR * 1.35, trimR); }
      }
      B.grp(grp + ':hand');
      if (spec.weapon === 'fists' && isNear) { B.ell(h[0], h[1], AR * 1.25, AR * 1.2, ramp(C.trim)); }
      else B.ell(h[0], h[1], AR * 1.0 + 0.3, AR * 1.0 + 0.2, bones ? skinR : gloveR);
    };
    // bow in far hand: draw far arm first, bow later
    drawArm(armF, shF, 'armF', false);

    // ---- legs
    const drawLeg = (leg, grp, near) => {
      B.grp(grp);
      const kn = leg.j, an = leg.e;
      if (bones) {
        B.cap(hip[0], hip[1], kn[0], kn[1], LR, LR, skinR); B.cap(kn[0], kn[1], an[0], an[1], LR, LR * 0.9, skinR); B.ell(kn[0], kn[1], LR * 1.4, LR * 1.4, skinR);
      } else {
        B.cap(hip[0] + (near ? 1 : -1), hip[1], kn[0], kn[1], LR * 1.05, LR * 0.9, pantsR);
        B.cap(kn[0], kn[1], an[0], an[1], LR * 0.9, LR * 0.75, pantsR);
      }
      // boot
      B.grp(grp + ':boot');
      const bR = bones ? skinR : (C.armor ? metR : bootR);
      if (!bones) B.cap(kn[0] + (an[0] - kn[0]) * 0.45, kn[1] + (an[1] - kn[1]) * 0.45, an[0], an[1], LR * 0.98, LR * 0.9, bR);
      B.ell(an[0] + 2.2 * k, an[1] + 0.8 * k, (bones ? 2.4 : 3.4) * k, 1.8 * k, bR);
      if (C.armor && !bones) { B.grp(grp + ':knee'); B.ell(kn[0] + 0.5, kn[1], LR * 1.05, LR * 1.0, metR); }
    };
    if (!opt.seat) { drawLeg(legB, 'legB', false); drawLeg(legF, 'legF', true); }

    // ---- torso
    const torsoPts = [tp(-SW * 0.85, T * 0.98), tp(-SW, T * 0.62), tp(-SW * 0.85, T * 0.2), tp(-SW * 0.9, 0), tp(SW * 0.88, 0), tp(SW * 0.82, T * 0.32), tp(SW * 1.02, T * 0.64), tp(SW * 0.75, T * 0.97), tp(0, T * 1.04)];
    if (spec.robe) {
      B.grp('robe');
      const hem = gy - 1.5 * k;
      const fx = Math.max(fF[0], hip[0] + 4 * k) + 3.5 * k, bx = Math.min(fB[0], hip[0] - 4 * k) - 3.5 * k;
      B.poly([tp(-SW * 0.85, T * 0.98), tp(-SW, T * 0.6), tp(-SW * 1.05, T * 0.1), [bx - 1, hem], [bx + 3, hem + 1], [fx - 3, hem + 1], [fx + 1, hem], tp(SW * 1.05, T * 0.15), tp(SW * 0.95, T * 0.62), tp(SW * 0.75, T * 0.97), tp(0, T * 1.04)], outR, { folds: [0.7, 0.28], vg: 0.3 });
      B.grp('robe:trim');
      B.poly([[bx - 1, hem - 2.5 * k], [fx + 1, hem - 2.5 * k], [fx + 1, hem], [fx - 3, hem + 1], [bx + 3, hem + 1], [bx - 1, hem]], trimR, { vg: 0 });
      // front panel stripe
      const s0 = tp(SW * 0.55, T * 0.9), s1 = [fx - 2, hem - 2];
      B.only = ['robe']; B.cap(s0[0], s0[1], s1[0], s1[1], 1.1 * k, 1.8 * k, trimR); B.only = null;
    } else {
      // skirt (tunic hem)
      if (!bones || C.armor) {
        B.grp('skirt');
        const kmF = [hip[0] + (legF.j[0] - hip[0]) * 0.55, hip[1] + (legF.j[1] - hip[1]) * 0.55], kmB = [hip[0] + (legB.j[0] - hip[0]) * 0.55, hip[1] + (legB.j[1] - hip[1]) * 0.55];
        if (opt.seat) { kmF[0] = hip[0] + 7 * k; kmF[1] = hip[1] + 3 * k; kmB[0] = hip[0] - 7 * k; kmB[1] = hip[1] + 3 * k; }
        B.poly([tp(-SW * 0.92, 2 * k), tp(SW * 0.9, 2 * k), [kmF[0] + 2.5 * k, kmF[1] + 1], [(kmF[0] + kmB[0]) / 2, Math.max(kmF[1], kmB[1]) + 1.5 * k], [kmB[0] - 2.5 * k, kmB[1] + 1]], bones ? ramp('#6a5a48') : outR, { folds: [0.9, 0.3] });
      }
      B.grp('torso');
      if (bones && !C.armor) {
        // spine + ribcage + pelvis
        B.cap(tp(-SW * 0.4, 0)[0], tp(-SW * 0.4, 0)[1], tp(-SW * 0.4, T)[0], tp(-SW * 0.4, T)[1], 1.2 * k, 1.2 * k, skinR);
        for (let i = 0; i < 4; i++) { const l = T * (0.45 + i * 0.14); const a = tp(-SW * 0.5, l), b = tp(SW * 0.85, l - 2.5 * k); B.cap(a[0], a[1], b[0], b[1], 1.1 * k, 0.9 * k, skinR); }
        B.ell(tp(0, 1.5 * k)[0], tp(0, 1.5 * k)[1], SW * 0.85, 2.8 * k, skinR);
      } else {
        B.poly(torsoPts, metR || outR, { nk: 0.95, vg: 0.6 });
        if (metR) {
          // plate edge highlight & tunic collar
          B.grp('torso:plate');
          B.only = ['torso'];
          const a = tp(-SW * 0.6, T * 0.35), b = tp(SW * 0.9, T * 0.42);
          B.line(a[0], a[1], b[0], b[1], metR[1]);
          B.only = null;
        } else if (!spec.robe) {
          // tunic neckline/trim
          B.grp('torso:collar');
          B.only = ['torso'];
          const a = tp(SW * 0.1, T * 1.0), b = tp(SW * 0.72, T * 0.7);
          B.cap(a[0], a[1], b[0], b[1], 1.1 * k, 0.9 * k, trimR);
          B.only = null;
        }
      }
      // belt
      B.grp('belt');
      const b0 = tp(-SW * 0.95, 1.5 * k), b1 = tp(SW * 0.92, 1.5 * k);
      B.cap(b0[0], b0[1], b1[0], b1[1], 1.5 * k, 1.5 * k, bones && !C.armor ? ramp('#5a4030') : ramp(spec.belt || '#6a4028'), { nk: 0.5 });
      B.grp('buckle'); const bk = tp(SW * 0.55, 1.5 * k); B.ell(bk[0], bk[1], 1.4 * k, 1.5 * k, ramp(DEF.gold, 'metal'));
    }
    if (opt.seat) { // seated near leg (over horse side)
      B.grp('legF');
      const kn = [hip[0] + 8 * k, hip[1] + 5 * k], an = [hip[0] + 6 * k, hip[1] + 16 * k];
      B.cap(hip[0], hip[1], kn[0], kn[1], LR * 1.05, LR * 0.95, pantsR);
      B.cap(kn[0], kn[1], an[0], an[1], LR * 0.9, LR * 0.8, pantsR);
      B.grp('legF:boot'); const bR2 = C.armor ? metR : bootR;
      B.cap(kn[0] - 0.5, kn[1] + 5 * k, an[0], an[1], LR, LR * 0.9, bR2); B.ell(an[0] + 2.2 * k, an[1] + 1, 3.3 * k, 1.8 * k, bR2);
      if (C.armor) { B.grp('legF:knee'); B.ell(kn[0], kn[1], LR * 1.1, LR * 1.05, metR); }
    }
    // ---- head
    const H = drawHeadBattle(B, spec, C, hc[0], hc[1], R, k, P, pose);
    // ---- shield on far hand
    if (spec.shield) {
      B.grp('shield');
      const sc = ramp(spec.shieldColor || C.trim), rim = ramp(C.armor || DEF.steel, 'metal');
      const s = [armF.e[0] + 2.5 * k, armF.e[1] + 1 * k];
      const tilt = pose === 'attack' ? 0.35 : pose === 'hurt' ? -0.4 : 0.1;
      B.ell(s[0], s[1], 5.6 * k, 9.5 * k, rim, { rot: tilt, nk: 0.8 });
      B.grp('shield:face'); B.ell(s[0], s[1], 4.2 * k, 8.0 * k, sc, { rot: tilt, nk: 0.8 });
      B.grp('shield:boss'); B.ell(s[0] + 0.5, s[1] - 0.5, 1.8 * k, 1.9 * k, rim);
      B.only = ['shield']; B.grp('shield:x', 'n');
      B.cap(s[0] - Math.sin(tilt) * 7 * k, s[1] - 6.5 * k, s[0] + Math.sin(tilt) * 7 * k, s[1] + 6.5 * k, 0.6, 0.6, sc[0]);
      B.only = null;
    }
    // ---- bow (far hand)
    if (spec.weapon === 'bow') {
      const arrow = P.draw ? [[armN.e[0], armN.e[1]], [armF.e[0] + 5 * k, armF.e[1]]] : P.shot ? [[armF.e[0] + 12 * k, armF.e[1] - 0.5], [armF.e[0] + 26 * k, armF.e[1] - 1]] : null;
      tip = drawBow(B, spec, armF.e, pose === 'idle' ? 18 : pose === 'hurt' ? 45 : pose === 'cast' ? -35 : wAng, k, P.draw ? armN.e : null, arrow);
      if (P.shot) { B.grp('streak', 'n'); for (let i = 0; i < 3; i++) B.line(armF.e[0] + (4 + i * 2) * k, armF.e[1] - 3 + i * 3, armF.e[0] + (9 + i * 2) * k, armF.e[1] - 3 + i * 3, 0xf0f0ff); }
    }
    // ---- main weapon (near hand)
    if (spec.weapon && spec.weapon !== 'bow') {
      tip = drawWeapon(B, spec, P, armN.e, wAng, k, pose);
    }
    // ---- near arm over weapon grip
    drawArm(armN, shN, 'armN', true);
    if (spec.weapon === 'claws') tip = drawWeapon(B, spec, P, armN.e, pose === 'attack' ? 0 : -30, k, pose);
    if (!tip) tip = armN.e;
    // pauldron
    if (C.armor) { B.grp('paul'); B.ell(shN[0] - 0.5, shN[1] + 0.5, AR * 1.9, AR * 1.55, metR, { rot: lean * 0.5 }); B.grp('paul:rim'); B.only = ['paul']; B.line(shN[0] - AR * 1.6, shN[1] + AR * 1.1, shN[0] + AR * 1.6, shN[1] + AR * 1.1, metR[1]); B.only = null; }
    return { P, H, C, k, tip, hN: armN.e, hF: armF.e, shN, cat, S, hip };
  }

  // post-outline effects for humanoids
  function battleFX(B, spec, pose, info) {
    const P = info.P, k = info.k;
    if (P.arc) {
      const c = info.shN, tp2 = info.tip;
      const r1 = Math.min(40 * k, Math.hypot(tp2[0] - c[0], tp2[1] - c[1]) * 0.8);
      const a1 = Math.atan2(tp2[1] - c[1], tp2[0] - c[0]), a0 = rad(P.arc[0]);
      for (let y = Math.floor(c[1] - r1 - 2); y <= c[1] + r1 + 2; y++) for (let x = Math.floor(c[0] - r1 - 2); x <= c[0] + r1 + 2; x++) {
        const dx = x + 0.5 - c[0], dy = y + 0.5 - c[1], d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (a < a0 || a > a1) continue;
        const t = (a - a0) / (a1 - a0), th = 1 + Math.pow(t, 0.8) * 8 * k;
        if (d > r1 + 0.5 || d < r1 - th) continue;
        const e = (r1 - d) / th;
        B.glow(x, y, e < 0.22 ? 0xffffff : e < 0.6 ? 0xc8ecff : 0x70b8f0, (40 + t * 200) * (1 - e * 0.55));
      }
    }
    const glowAt = (p, r, g, st) => {
      for (let y = Math.floor(p[1] - r); y <= p[1] + r; y++) for (let x = Math.floor(p[0] - r); x <= p[0] + r; x++) {
        const d = Math.hypot(x + 0.5 - p[0], y + 0.5 - p[1]) / r; if (d > 1) continue;
        const q = d < 0.18 ? 0xffffff : d < 0.4 ? lighten(g, 0.6) : g;
        B.glow(x, y, q, Math.pow(1 - d, 1.4) * 255 * (0.85 + BAYER[((y & 1) << 1) | (x & 1)] * 0.4));
      }
      if (st) for (let i = 1; i < r * 1.5; i++) { const a = 230 * (1 - i / (r * 1.5)); B.glow(p[0] + i, p[1], 0xffffff, a); B.glow(p[0] - i, p[1], 0xffffff, a); B.glow(p[0], p[1] + i, 0xffffff, a); B.glow(p[0], p[1] - i, 0xffffff, a); }
    };
    if (P.glow || P.cast) {
      const g = h2i(spec.glow || (spec.weapon === 'staff' || spec.weapon === 'rod' ? '#ffd860' : '#80d0ff'));
      if (P.cast) {
        glowAt(info.tip, 13 * k, g, true); glowAt(info.hN, 6 * k, g); glowAt(info.hF, 6 * k, g);
        for (let j = 0; j < 8; j++) { const a = rad(j * 45 + 20), rr = 17 * k * (j % 2 ? 0.8 : 1.05); const q = [info.tip[0] + Math.cos(a) * rr, info.tip[1] + Math.sin(a) * rr]; B.glow(q[0], q[1], 0xffffff, 255); B.glow(q[0] + 1, q[1], g, 170); B.glow(q[0] - 1, q[1], g, 170); B.glow(q[0], q[1] + 1, g, 170); B.glow(q[0], q[1] - 1, g, 170); }
      } else glowAt(info.tip, 8 * k * P.glow, g, P.glow > 0.55);
    }
    if (P.punch) {
      const p = info.tip; for (let j = 0; j < 8; j++) { const a = rad(j * 45 + 22); for (let r = 4; r < 8; r++) B.glow(p[0] + 3 + Math.cos(a) * r * k, p[1] + Math.sin(a) * r * k, 0xfff0a0, 220 - r * 20); }
    }
    if (P.stab) {
      const p = info.tip; for (let i = 0; i < 3; i++) B.line && [0].forEach(() => { for (let x = 0; x < 10; x++) B.glow(p[0] - 14 - x + i * 3, p[1] - 4 + i * 4, 0xe0f0ff, 200 - x * 18); });
    }
  }

  // ------------------------------------------------------------------
  // Horse (battle) for mounted units
  // ------------------------------------------------------------------
  function battleHorse(B, spec, pose) {
    const C = pal(spec), hR = ramp(C.horse), mane = ramp(spec.mane || G.shade(C.horse, 0.45), 'hair'), hoof = ramp('#3a2a28'), clothR = ramp(C.trim), cloth2 = ramp(C.outfit);
    const dx = pose === 'attack' ? 8 : pose === 'hurt' ? -6 : pose === 'ready' ? -3 : 0;
    const rear = pose === 'ready' ? -8 : pose === 'hurt' ? -5 : pose === 'attack' ? 4 : 0;
    const cx = 44 + dx, cy = 60;
    const rot = rad(rear);
    const rp = (x, y) => [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
    // legs: [hipLocal, knee offset, hoof target]
    const gy = 90;
    const legs = {
      idle: [[-13, 0, -14, 0], [13, 0, 14, 0], [-17, 0, -20, 0], [17, 0, 18, 0]],
      ready: [[-13, 0, -16, 0], [13, -8, 20, -12], [-17, 0, -22, 0], [17, -6, 22, -8]],
      attack: [[-13, 0, -22, 0], [13, 0, 28, -2], [-17, 0, -10, 0], [17, 0, 20, -4]],
      hurt: [[-13, 0, -12, 0], [13, 0, 12, -6], [-17, 0, -18, 0], [17, 0, 16, -2]]
    }[pose] || null;
    const L = legs || [[-13, 0, -14, 0], [13, 0, 14, 0], [-17, 0, -20, 0], [17, 0, 18, 0]];
    // order: far hind, far fore, (body), near hind, near fore
    const leg = (i, grp, shift) => {
      const [lx, , fx, fy] = L[i];
      const top = rp(lx, 4);
      const foot = [cx + fx, gy - 2 + fy];
      const fore = lx > 0;
      const r = ik(top, foot, 13, 14, fore ? 1 : -1);
      B.grp(grp);
      B.cap(top[0], top[1], r.j[0], r.j[1], fore ? 4 : 5.5, 2.4, hR, { shift });
      B.cap(r.j[0], r.j[1], r.e[0], r.e[1], 2.2, 1.9, hR, { shift });
      B.grp(grp + ':hoof'); B.ell(r.e[0] + 1, r.e[1] + 0.5, 2.6, 2.1, hoof, { shift });
      B.grp(grp + ':fet'); B.ell(r.e[0], r.e[1] - 2, 2.2, 1.6, ramp(lighten(h2i(C.horse), 0.55) ? '#e8e0d0' : '#fff'), { shift });
    };
    // tail
    B.grp('tail');
    const tb = rp(-24, -6);
    const sw = pose === 'attack' ? -6 : pose === 'hurt' ? 4 : 0;
    B.chain([tb, [tb[0] - 5 + sw, tb[1] + 4], [tb[0] - 7 + sw, tb[1] + 14], [tb[0] - 5 + sw * 1.4, tb[1] + 24]], [3, 3.6, 3, 1.4], mane, { });
    leg(2, 'hlegFar', -1); leg(0, 'flegFar', -1);
    // body
    B.grp('hbody');
    const b = rp(0, 0); B.ell(b[0], b[1], 20, 9.5, hR, { rot });
    const ch = rp(13, -1); B.ell(ch[0], ch[1], 9.5, 10, hR, { rot });
    const rm = rp(-15, -2); B.ell(rm[0], rm[1], 10, 10, hR, { rot });
    // neck & head
    B.grp('hneck');
    const n0 = rp(15, -5), n1 = rp(24, -20);
    B.cap(n0[0], n0[1], n1[0], n1[1], 7.5, 5, hR);
    B.grp('hhead');
    const h0 = rp(24, -22), h1 = rp(33, -13);
    B.cap(h0[0], h0[1], h1[0], h1[1], 4.8, 3.4, hR);
    B.ell(h1[0] + 0.5, h1[1] + 0.5, 3.4, 3.0, ramp(G.shade(C.horse, 0.85)));
    B.grp('hear'); const e0 = rp(22, -26); B.poly([[e0[0] - 2, e0[1] + 3], [e0[0] - 1, e0[1] - 4], [e0[0] + 2, e0[1] + 2]], hR);
    // mane
    B.grp('mane');
    B.chain([rp(21, -27), rp(18, -20), rp(14, -13), rp(11, -9)], [2.4, 3, 3, 1.6], mane);
    B.poly([rp(23, -26), rp(27, -25), rp(26, -22)], mane);
    // caparison & saddle
    B.grp('cloth');
    B.poly([rp(-12, -9), rp(10, -9), rp(12, 2), rp(9, 9), rp(-8, 9), rp(-12, 2)], cloth2, { folds: [0.6, 0.35], vg: 0.4 });
    B.grp('cloth:trim'); B.poly([rp(-12, 5), rp(11.5, 5), rp(9, 9), rp(-8, 9)], clothR, { vg: 0 });
    B.grp('saddle'); B.poly([rp(-9, -10), rp(7, -10), rp(6, -6), rp(-8, -6)], ramp('#6a3c20'));
    // bridle
    B.grp('bridle', 'n');
    const br0 = rp(26, -20), br1 = rp(31, -13); B.line(br0[0], br0[1], br1[0], br1[1], 0x4a2818);
    B.line(br1[0], br1[1], rp(10, -12)[0], rp(10, -12)[1], 0x4a2818);
    leg(3, 'hlegNear', 0); leg(1, 'flegNear', 0);
    // eye/nostril details after lines
    return { seat: rp(-1, -12), eye: rp(26, -19), nose: rp(34, -12), rot };
  }

  // ------------------------------------------------------------------
  // Non-humanoid battle bodies
  // ------------------------------------------------------------------
  function battleBeast(B, spec, pose) {
    const C = pal(spec), body = C.body, k = spec.scale || 1;
    const main = ramp(spec.outfit || (body === 'rat' ? '#8a7a70' : body === 'bat' ? '#5a3a6a' : body === 'wolf' ? '#7a7888' : body === 'slime' ? '#40c060' : '#6a60a0'), body === 'slime' ? 'hair' : 'cloth');
    const belly = ramp(spec.trim || (body === 'rat' ? '#d8b8a8' : body === 'wolf' ? '#c8c4c8' : '#c8a0c0'));
    const eye = h2i(spec.eyes || (body === 'slime' ? '#101830' : '#ff3020'));
    let tip = [70, 60], details = [];
    const P = { attack: pose === 'attack', ready: pose === 'ready', hurt: pose === 'hurt', cast: pose === 'cast' };
    if (body === 'rat') {
      const z = 1.22 * k;
      const dx = P.attack ? 10 : P.hurt ? -7 : P.ready ? -5 : 0, tilt = P.attack ? 0.12 : P.hurt ? -0.3 : P.ready ? -0.26 : P.cast ? -0.12 : 0;
      const cx = 45 + dx, cy = 89 - 17 * z - (P.ready || P.hurt ? 2 : 0);
      const Q = (x, y) => [cx + (x * Math.cos(tilt) - y * Math.sin(tilt)) * z, cy + (x * Math.sin(tilt) + y * Math.cos(tilt)) * z];
      const tailR = ramp('#d09a90');
      B.grp('tail'); const t0 = Q(-18, 4);
      B.chain([t0, [t0[0] - 10 * z, t0[1] + 7 * z], [t0[0] - 19 * z, t0[1] + 4 * z], [t0[0] - 23 * z, t0[1] - 5 * z + (P.attack ? -4 : 0)]], [3 * z, 2.2 * z, 1.4 * z, 0.7], tailR);
      const leg = (top, paw, g, sh, big) => { B.grp(g); const mid = [(top[0] + paw[0]) / 2 + (big ? -2 : 1), (top[1] + paw[1]) / 2]; B.cap(top[0], top[1], mid[0], mid[1], (big ? 6 : 3.6) * z, 2.6 * z, main, { shift: sh }); B.cap(mid[0], mid[1], paw[0], paw[1] - 1, 2.4 * z, 1.8 * z, main, { shift: sh }); B.grp(g + ':p'); B.ell(paw[0] + 1.5 * z, paw[1] - 0.5, 3 * z, 1.7 * z, tailR, { shift: sh }); };
      const gY = 89;
      const pf = P.attack ? [[-8, 0], [18, 8]] : P.ready ? [[-7, 0], [14, -2]] : [[-4, 0], [14, 0]];
      leg(Q(-10, 6), [cx + (pf[0][0] - 6) * z, gY], 'lb', -1, true); leg(Q(12, 7), [cx + (pf[1][0] + 3) * z, gY - (P.attack ? 6 : 0)], 'lf2', -1, false);
      B.grp('body'); const bc = Q(0, 0); B.ell(bc[0], bc[1], 21 * z, 12.5 * z, main, { rot: tilt });
      B.grp('body:belly'); const bl = Q(3, 6); B.ell(bl[0], bl[1], 14 * z, 5.5 * z, belly, { rot: tilt, test: (x, y) => y > bc[1] + 2 * z });
      B.only = ['body']; B.grp('body:fur'); const bk = Q(-3, -8); B.ell(bk[0], bk[1], 15 * z, 4 * z, main, { rot: tilt, shift: 1, test: (x, y) => ((Math.floor(x) + Math.floor(y) * 2) % 5) !== 0 }); B.only = null;
      const hc = Q(19, -5 + (P.attack ? 3 : 0)), hx = hc[0], hy = hc[1];
      B.grp('head'); B.ell(hx, hy, 9 * z, 7.5 * z, main); B.cap(hx + 3 * z, hy + 1 * z, hx + 14 * z, hy + (P.attack ? 1 : 3.5) * z, 5.2 * z, 2.2 * z, main);
      if (P.attack) { B.grp('jaw'); B.cap(hx + 3 * z, hy + 4 * z, hx + 11 * z, hy + 8.5 * z, 2.8 * z, 1.4 * z, main, { shift: -1 }); }
      const earR = ramp('#d8a0a0');
      B.grp('ear'); B.ell(hx - 4 * z, hy - 7 * z, 4.2 * z, 4.8 * z, earR, { rot: -0.4 }); B.grp('ear2'); B.ell(hx + 1 * z, hy - 8 * z, 3.6 * z, 4.3 * z, earR, { rot: 0.1 });
      B.only = ['ear', 'ear2']; B.grp('ear:in'); B.ell(hx - 3.6 * z, hy - 6.6 * z, 2.2 * z, 2.8 * z, ramp('#b06878'), { rot: -0.4 }); B.ell(hx + 1.3 * z, hy - 7.5 * z, 1.8 * z, 2.4 * z, ramp('#b06878'), { rot: 0.1 }); B.only = null;
      leg(Q(-6, 8), [cx + pf[0][0] * z, gY], 'lb2', 0, true); leg(Q(15, 7), [cx + (pf[1][0] + 7) * z, gY - (P.attack ? 5 : 0)], 'lf', 0, false);
      B.lines();
      B.grp('det', 'n');
      const ex = hx + 3 * z, ey = hy - 2 * z;
      B.put(ex - 1, ey - 1, 0x200810); B.put(ex, ey - 1, 0x200810); B.put(ex + 1, ey - 1, 0x200810);
      B.put(ex - 1, ey, mul(eye, 0.6)); B.put(ex, ey, eye); B.put(ex + 1, ey, eye); B.put(ex, ey + 1, mul(eye, 0.6)); B.put(ex, ey, 0xffffff);
      const nx = hx + 15 * z, ny = hy + (P.attack ? 1 : 3.5) * z;
      B.put(nx, ny - 1, 0x301018); B.put(nx - 1, ny - 1, 0x301018);
      for (let w = -1; w <= 1; w++) B.line(nx - 3, ny, nx + 5, ny - 2 + w * 2.5, 0x2a2020);
      if (P.attack) { B.rect(hx + 11 * z, hy + 3 * z, 1, 3, 0xfff8e8); B.rect(hx + 10 * z, hy + 6 * z, 1, 2, 0xfff8e8); B.rect(hx + 6 * z, hy + 4.5 * z, 4 * z, 1.5, 0x501020); }
      else { B.rect(hx + 12 * z, hy + 5.2 * z, 1, 2, 0xfff8e0); B.rect(hx + 13 * z, hy + 5.2 * z, 1, 2, 0xfff8e0); }
      tip = [nx, ny + 2];
    } else if (body === 'bat') {
      const flap = P.ready ? -1 : P.attack ? 0.3 : P.hurt ? 0.6 : P.cast ? -0.8 : -0.4;
      const cx = 48 + (P.attack ? 12 : P.hurt ? -6 : 0), cy = 52 + (P.attack ? 10 : P.ready ? -6 : 0);
      const wing = (side, grp, sh) => {
        B.grp(grp);
        const sgn = side;
        const sx = cx + sgn * 3, sy = cy - 2;
        const a = flap * 55;
        const pts = [];
        const f1 = [sx + sgn * 14, sy + a * 0.35 - 6], f2 = [sx + sgn * 26, sy + a * 0.7 - 4], f3 = [sx + sgn * 34, sy + a - 0];
        const bot = [[sx + sgn * 28, sy + a * 0.8 + 12], [sx + sgn * 20, sy + a * 0.5 + 8], [sx + sgn * 12, sy + a * 0.3 + 12], [sx + sgn * 5, sy + 10]];
        pts.push([sx, sy - 3], f1, f2, f3, ...bot);
        B.poly(pts, ramp(G.shade(spec.outfit || '#5a3a6a', 0.85)), { shift: sh, nk: 0.4 });
        B.grp(grp + ':bone'); B.chain([[sx, sy - 2], f1, f2, f3], [1.6, 1.2, 1, 0.6], main, { shift: sh });
        B.line(f1[0], f1[1], bot[2][0], bot[2][1], main[1]); B.line(f2[0], f2[1], bot[1][0], bot[1][1], main[1]); B.line(f3[0], f3[1], bot[0][0], bot[0][1], main[1]);
      };
      wing(-1, 'wingB', -1);
      B.grp('body'); B.ell(cx, cy + 3, 8.5 * k, 10 * k, main);
      B.grp('belly'); B.ell(cx + 2, cy + 6, 5, 6, belly, { shift: -1 });
      B.grp('head'); B.ell(cx + 3, cy - 8, 7.5, 6.5, main);
      B.grp('ear'); B.poly([[cx - 3, cy - 11], [cx - 4, cy - 22], [cx + 2, cy - 13]], main); B.grp('ear2'); B.poly([[cx + 4, cy - 13], [cx + 8, cy - 23], [cx + 10, cy - 11]], main);
      B.grp('feet'); B.cap(cx - 3, cy + 12, cx - 4, cy + 17, 1.3, 1, main); B.cap(cx + 3, cy + 12, cx + 4, cy + 17, 1.3, 1, main);
      wing(1, 'wingF', 0);
      B.lines();
      B.grp('det', 'n');
      B.rect(cx + 3, cy - 9, 2, 2, eye); B.rect(cx + 7, cy - 9, 2, 2, eye); B.put(cx + 3, cy - 9, 0xffffff); B.put(cx + 7, cy - 9, 0xffffff);
      B.put(cx + 5, cy - 5, 0x301020); B.put(cx + 6, cy - 5, 0x301020);
      B.put(cx + 4, cy - 4, 0xffffff); B.put(cx + 7, cy - 4, 0xffffff);
      if (P.attack || P.ready) { B.rect(cx + 4, cy - 4, 4, 2, 0x601028); B.put(cx + 4, cy - 4, 0xffffff); B.put(cx + 7, cy - 4, 0xffffff); }
      tip = [cx + 6, cy - 4];
    } else if (body === 'wolf') {
      const z = 1.05 * k;
      const dx = P.attack ? 12 : P.hurt ? -6 : P.ready ? -3 : 0, crouch = P.ready ? 5 : P.attack ? -3 : 0;
      const cx = 41 + dx, cy = 63 + crouch, gY = 89;
      const tilt = P.attack ? -0.1 : P.hurt ? -0.18 : P.ready ? 0.1 : 0;
      const Q = (x, y) => [cx + (x * Math.cos(tilt) - y * Math.sin(tilt)) * z, cy + (x * Math.sin(tilt) + y * Math.cos(tilt)) * z];
      const light = ramp(mixHex(spec.outfit || '#7a7888', spec.trim || '#c8c4c8', 0.55)), dark = ramp(G.shade(spec.outfit || '#7a7888', 0.7));
      const hind = (x0, px, g, sh) => {
        const hip = Q(x0, 1), paw = [cx + px * z, gY - 1], hock = [paw[0] - 3 * z, gY - 9 * z - (P.attack ? -2 : 0)];
        const r = ik(hip, hock, 12 * z, 10 * z, -1);
        B.grp(g); B.cap(hip[0], hip[1], r.j[0], r.j[1], 6.5 * z, 3.4 * z, main, { shift: sh }); B.cap(r.j[0], r.j[1], hock[0], hock[1], 3.2 * z, 2.1 * z, main, { shift: sh });
        B.cap(hock[0], hock[1], paw[0], paw[1] - 1, 2.1 * z, 1.9 * z, main, { shift: sh }); B.ell(paw[0] + 1.5 * z, paw[1], 3.2 * z, 1.9 * z, main, { shift: sh });
      };
      const fore = (x0, px, py, g, sh) => {
        const sh0 = Q(x0, 2), paw = [cx + px * z, py];
        const r = ik(sh0, paw, 11 * z, 12 * z, 1);
        B.grp(g); B.cap(sh0[0], sh0[1], r.j[0], r.j[1], 5 * z, 3 * z, main, { shift: sh }); B.cap(r.j[0], r.j[1], paw[0], paw[1] - 1, 2.6 * z, 2 * z, main, { shift: sh }); B.ell(paw[0] + 1.5 * z, paw[1], 3.2 * z, 1.9 * z, main, { shift: sh });
      };
      const L = P.attack ? { hb: -27, hn: -22, fb: 26, fn: 31, fy: gY - 10 } : P.ready ? { hb: -17, hn: -12, fb: 17, fn: 22, fy: gY - 1 } : P.hurt ? { hb: -13, hn: -8, fb: 10, fn: 15, fy: gY - 1 } : { hb: -16, hn: -10, fb: 13, fn: 19, fy: gY - 1 };
      // tail
      B.grp('tail'); const t0 = Q(-17, -4);
      const tp3 = P.attack ? [[t0[0] - 10 * z, t0[1] - 5 * z], [t0[0] - 19 * z, t0[1] - 6 * z], [t0[0] - 25 * z, t0[1] - 4 * z]] : P.hurt ? [[t0[0] - 7 * z, t0[1] + 6 * z], [t0[0] - 9 * z, t0[1] + 14 * z], [t0[0] - 8 * z, t0[1] + 20 * z]] : [[t0[0] - 9 * z, t0[1] + 1 * z], [t0[0] - 15 * z, t0[1] + 9 * z], [t0[0] - 16 * z, t0[1] + 17 * z]];
      B.chain([t0].concat(tp3), [3 * z, 4.6 * z, 4 * z, 1.6 * z], main);
      B.only = ['tail']; B.grp('tail:tip'); B.ell(tp3[2][0], tp3[2][1], 3.5 * z, 3.5 * z, light); B.only = null;
      hind(-12, L.hb, 'hlb', -1); fore(11, L.fb, L.fy, 'flb', -1);
      // body
      B.grp('body'); const b0 = Q(-2, 0), ch = Q(11, 1); B.ell(b0[0], b0[1], 17 * z, 8.5 * z, main, { rot: tilt }); B.ell(ch[0], ch[1], 9 * z, 10 * z, main, { rot: tilt });
      B.only = ['body']; B.grp('body:saddle'); const sd = Q(-4, -6); B.ell(sd[0], sd[1], 14 * z, 4.5 * z, dark, { rot: tilt }); B.only = null;
      // head
      const hx = cx + 25 * z, hy = cy + (P.ready ? -7 : P.attack ? -10 : P.hurt ? -17 : -12) * z;
      B.grp('body:neck'); B.cap(ch[0] + 1, ch[1] - 4 * z, hx - 3 * z, hy + 2 * z, 7.5 * z, 5.2 * z, main);
      B.grp('body:ruff');
      const rf = [ch[0] + 7 * z, ch[1] - 2 * z];
      B.poly([[rf[0] - 8 * z, rf[1] - 8 * z], [rf[0] + 2 * z, rf[1] - 7 * z], [rf[0] + 4 * z, rf[1] + 1 * z], [rf[0] + 2 * z, rf[1] + 6 * z], [rf[0] + 0.5 * z, rf[1] + 3 * z], [rf[0] - 1.5 * z, rf[1] + 9 * z], [rf[0] - 3 * z, rf[1] + 4 * z], [rf[0] - 5 * z, rf[1] + 8 * z], [rf[0] - 6 * z, rf[1] + 1 * z]], light, { nk: 0.6, vg: 0.6 });
      B.grp('head'); B.ell(hx, hy, 7.5 * z, 6.5 * z, main);
      const up = P.attack ? -1.5 : 0;
      B.cap(hx + 2 * z, hy + 1.5 * z, hx + 14 * z, hy + (3.5 + up) * z, 4 * z, 2.2 * z, main);
      B.only = ['head']; B.grp('head:m'); B.cap(hx + 3 * z, hy + 4 * z, hx + 12 * z, hy + (5 + up) * z, 2.4 * z, 1.4 * z, light); B.only = null;
      if (P.attack || P.ready) { B.grp('jaw'); B.cap(hx + 3 * z, hy + 5 * z, hx + 11 * z, hy + (P.attack ? 10 : 7.5) * z, 2.4 * z, 1.4 * z, main, { shift: -1 }); }
      const ef = P.hurt ? 5 : 0;
      B.grp('ear'); B.poly([[hx - 5 * z, hy - 2 * z], [hx - 4 * z - ef, hy - 13 * z + ef], [hx + 0.5 * z, hy - 4 * z]], main, { shift: -1 });
      B.grp('ear2'); B.poly([[hx - 1.5 * z, hy - 4 * z], [hx + 1.5 * z - ef, hy - 13.5 * z + ef], [hx + 4.5 * z, hy - 3 * z]], main);
      hind(-8, L.hn, 'hln', 0); fore(15, L.fn, L.fy, 'fln', 0);
      B.lines();
      B.grp('det', 'n');
      const ex = Math.round(hx + 3 * z), ey = Math.round(hy - 1 * z);
      B.put(ex - 1, ey - 1, 0x100808); B.put(ex, ey - 1, 0x100808); B.put(ex + 1, ey - 1, 0x100808); B.put(ex + 2, ey - 2, 0x100808);
      if (P.hurt) { B.put(ex, ey, 0x100808); B.put(ex + 1, ey, 0x100808); } else { B.put(ex, ey, eye); B.put(ex + 1, ey, lighten(eye, 0.6)); }
      const nx = hx + 15 * z, ny = hy + (3 + up) * z;
      B.rect(nx - 1, ny - 1, 2, 2, 0x101018);
      if (P.attack || P.ready) { B.rect(hx + 5 * z, hy + 6 * z, 6 * z, P.attack ? 2 : 1, 0x601020); B.put(hx + 11 * z, hy + 5 * z, 0xffffff); B.put(hx + 7 * z, hy + 5 * z, 0xffffff); B.put(hx + 10 * z, hy + (P.attack ? 8 : 7) * z, 0xffffff); }
      else B.line(hx + 7 * z, hy + 5.5 * z, hx + 13 * z, hy + 5 * z, 0x301818);
      tip = [nx, ny + 3];
    } else if (body === 'slime') {
      const sq = P.ready ? 0.75 : P.attack ? 1.2 : P.hurt ? 0.85 : P.cast ? 1.1 : 1;
      const w = 20 * k / Math.sqrt(sq), h = 16 * k * sq, cx = 46 + (P.attack ? 12 : P.hurt ? -5 : 0), by = 89;
      const lean = P.attack ? 0.35 : P.hurt ? -0.25 : 0;
      B.grp('body');
      const top = by - h * 2;
      B.poly([[cx - w, by], [cx - w * 0.95, by - h * 0.6], [cx - w * 0.6 + lean * 8, by - h * 1.5], [cx + lean * 14, top], [cx + w * 0.6 + lean * 12, by - h * 1.4], [cx + w * 0.98, by - h * 0.55], [cx + w, by]], main, { nk: 1.0, vg: 1.4 });
      B.ell(cx + lean * 6, by - h * 1.0, w * 0.95, h * 0.95, main, { test: (x, y) => y < by });
      B.grp('drip'); B.ell(cx - w * 0.7, by - 1, 3, 2, main); B.ell(cx + w * 0.8, by - 1, 4, 2, main);
      B.lines();
      B.grp('shine', 'n');
      B.ell(cx - w * 0.35 + lean * 8, by - h * 1.45, 3, 2.2, 0xffffff, { rot: -0.6 }); B.put(cx - w * 0.55 + lean * 6, by - h * 1.0, 0xffffff);
      const ey = by - h * 0.95, ex = cx + w * 0.25 + lean * 10;
      const ec = eye;
      if (P.hurt) { B.line(ex - 4, ey - 2, ex - 1, ey + 1, ec); B.line(ex - 4, ey + 1, ex - 1, ey - 2, ec); B.line(ex + 3, ey - 2, ex + 6, ey + 1, ec); B.line(ex + 3, ey + 1, ex + 6, ey - 2, ec); }
      else { B.ell(ex - 2.5, ey, 1.8, 2.6, ec); B.ell(ex + 4.5, ey, 1.8, 2.6, ec); B.put(ex - 3, ey - 1.5, 0xffffff); B.put(ex + 4, ey - 1.5, 0xffffff); }
      if (P.attack || P.ready) { B.ell(ex + 1, ey + 6, 3, 2, 0x103018); } else { B.line(ex - 1, ey + 5, ex + 3, ey + 5, main[0]); }
      tip = [cx + w, by - h];
    } else if (body === 'wraith') {
      const cx = 44 + (P.attack ? 10 : P.hurt ? -6 : 0), cy = 44 + (P.cast ? -4 : 0);
      const robe = ramp(spec.outfit || '#4a3a6a'), trim = ramp(spec.trim || '#8870c0');
      B.grp('robe');
      const hem = 84, sway = P.attack ? -8 : P.hurt ? 6 : 0;
      const pts = [[cx - 7, cy - 6], [cx + 9, cy - 4], [cx + 16, cy + 18]];
      for (let i = 0; i <= 6; i++) { const x = cx + 16 - i * 6 + sway * (i / 6); pts.push([x, hem + (i % 2 ? -8 : 0) - i * 0.5]); }
      pts.push([cx - 16 + sway, cy + 16]);
      B.poly(pts, robe, { folds: [0.6, 0.45], vg: 0.8 });
      B.grp('armB'); const handB = P.cast ? [cx - 6, cy - 20] : P.attack ? [cx + 16, cy + 4] : P.ready ? [cx - 10, cy - 8] : [cx + 10, cy + 14];
      B.cap(cx - 3, cy, handB[0], handB[1], 3.5, 2.5, robe, { shift: -1 });
      B.grp('hood'); B.ell(cx + 1, cy - 12, 10, 11, robe); B.poly([[cx - 8, cy - 18], [cx - 16, cy - 8], [cx - 6, cy - 4]], robe);
      B.grp('hood:void', 'n'); B.ell(cx + 5, cy - 10, 5.5, 7, 0x0a0614, { test: (x) => x > cx + 0.5 });
      B.grp('armF'); const hand = P.cast ? [cx + 12, cy - 22] : P.attack ? [cx + 30, cy - 4] : P.ready ? [cx - 6, cy - 14] : [cx + 16, cy + 6];
      B.cap(cx + 3, cy - 2, hand[0], hand[1], 4, 3, robe);
      B.grp('armF:t'); B.cap(hand[0] - (hand[0] - cx) * 0.2, hand[1] - (hand[1] - cy) * 0.2, hand[0], hand[1], 3.4, 3.2, trim);
      B.grp('claw'); for (let i = -1; i <= 1; i++) B.cap(hand[0], hand[1], hand[0] + 5, hand[1] + i * 3, 1.1, 0.5, ramp('#d0d8e0'));
      B.lines();
      B.grp('det', 'n');
      B.rect(cx + 4, cy - 12, 2, 1, eye); B.rect(cx + 8, cy - 12, 2, 1, eye); B.put(cx + 4, cy - 12, 0xffffff); B.put(cx + 8, cy - 12, 0xffffff);
      tip = hand;
      details.push(() => { // ghostly tatters glow
        for (let i = 0; i < 18; i++) { const x = cx - 14 + i * 1.7 + sway * 0.5, y = hem + 2 + (i % 3); B.glow(x, y, h2i(spec.trim || '#8870c0'), 90); }
        if (P.cast) { const g = h2i(spec.glow || '#b060ff'); for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) { const d = Math.hypot(x, y) / 8; if (d < 1) B.glow(hand[0] + x, hand[1] - 4 + y, d < 0.3 ? 0xffffff : g, (1 - d) * 230); } }
      });
    }
    return { tip, details };
  }

  // ------------------------------------------------------------------
  // Public battle API
  // ------------------------------------------------------------------
  const tipStore = {};
  G.battleSprite = function (spec, pose, facing) {
    pose = pose || 'idle'; facing = facing || 'right';
    const key = 'bs|' + specKey(spec) + '|' + pose + '|' + facing;
    return G.cached(key, 96, 96, (ctx, cv) => {
      const B = new Buf(96, 96, facing === 'left' ? 1 : -1, 0.12);
      const body = spec.body || 'human';
      let tip;
      if (HUMANOID[body]) {
        let info;
        if (spec.mount === 'horse') {
          const hs = battleHorse(B, spec, pose);
          info = battleHumanoid(B, spec, pose, { seat: hs.seat, k: 0.86 });
          B.lines();
          drawFaceBattle(B, spec, info.C, info.H, info.P, pose, info.k);
          B.grp('hdet', 'n'); B.put(hs.eye[0], hs.eye[1], 0x100808); B.put(hs.eye[0] + 1, hs.eye[1], 0x100808); B.put(hs.eye[0], hs.eye[1] - 1, 0xffffff);
          B.put(hs.nose[0] - 1, hs.nose[1], 0x201010);
          B.outline(); battleFX(B, spec, pose, info);
        } else {
          info = battleHumanoid(B, spec, pose);
          B.lines();
          drawFaceBattle(B, spec, info.C, info.H, info.P, pose, info.k);
          B.outline(); battleFX(B, spec, pose, info);
        }
        tip = info.tip;
      } else {
        const r = battleBeast(B, spec, pose);
        B.outline(); r.details.forEach(f => f());
        tip = r.tip;
      }
      tipStore[key] = facing === 'left' ? { x: 95 - Math.round(tip[0]), y: Math.round(tip[1]) } : { x: Math.round(tip[0]), y: Math.round(tip[1]) };
      B.toCanvas(facing === 'left', cv);
    });
  };
  G.weaponTip = function (spec, pose, facing) {
    pose = pose || 'idle'; facing = facing || 'right';
    const key = 'bs|' + specKey(spec) + '|' + pose + '|' + facing;
    if (!tipStore[key]) G.battleSprite(spec, pose, facing);
    return Object.assign({}, tipStore[key]);
  };

  // ==================================================================
  // MAP SPRITES (24x24 chibi)
  // ==================================================================
  const MB = {
    human: { sh: 0, bw: 3.6, hr: 5.4 }, elf: { sh: 0, bw: 3.3, hr: 5.3 }, dwarf: { sh: 1, bw: 4.4, hr: 5.4 },
    halfling: { sh: 2, bw: 3.3, hr: 5.1 }, goblin: { sh: 2, bw: 3.3, hr: 5.4 }, orc: { sh: 0, bw: 4.6, hr: 5.4 },
    skeleton: { sh: 0, bw: 3.0, hr: 5.1 }, birdfolk: { sh: 0, bw: 3.4, hr: 5.3 }
  };
  function mapWeapon(B, spec, dir, hx, hy, frame, side, steep) {
    const w = spec.weapon; if (!w || w === 'fists') return;
    const st = ramp(DEF.steel, 'metal'), wd = ramp(DEF.wood), gd = ramp(DEF.gold, 'metal');
    B.grp('weapon');
    const up = dir === 'up';
    if (w === 'sword' || w === 'dagger') {
      const L = w === 'sword' ? 7 : 4;
      if (dir === 'right') { B.line(hx + 1, hy - 1, hx + 1 + L * 0.7, hy - 1 - L * 0.7, st[3]); B.put(hx + 1, hy - 1, gd[2]); B.put(hx, hy, gd[1]); }
      else { B.line(hx, hy - 1, hx, hy - L, up ? st[1] : st[3]); B.put(hx, hy - L - 1, st[4]); B.put(hx - 1, hy - 1, gd[2]); B.put(hx + 1, hy - 1, gd[2]); }
    } else if (w === 'mace') { B.line(hx, hy, hx, hy - 4, wd[2]); B.ell(hx + 0.5, hy - 5, 1.6, 1.6, st); }
    else if (w === 'axe') {
      if (dir === 'right') { B.line(hx, hy + 1, hx + 4, hy - 6, wd[2]); B.poly([[hx + 3, hy - 7], [hx + 7, hy - 8], [hx + 7, hy - 3]], st, { flat: 3 }); }
      else { B.line(hx, hy + 1, hx, hy - 8, wd[2]); B.poly([[hx + side, hy - 8], [hx + side * 4, hy - 9], [hx + side * 4, hy - 4], [hx + side, hy - 5]], st, { flat: up ? 1 : 3 }); }
    } else if (w === 'lance' || w === 'spear') {
      const c = w === 'lance' ? ramp(spec.trim || DEF.trim) : wd;
      if (dir === 'right' && steep) { B.line(hx - 1, hy + 3, hx + 4, hy - 9, c[2]); B.line(hx + 4, hy - 9, hx + 5, hy - 12, st[4]); B.put(hx + 5, hy - 10, st[2]); }
      else if (dir === 'right') { B.line(hx - 2, hy + 2, hx + 7, hy - 8, c[2]); B.line(hx + 7, hy - 8, hx + 9, hy - 10, st[4]); B.line(hx + 7, hy - 9, hx + 8, hy - 10, st[3]); }
      else { B.line(hx, hy + 2, hx, hy - 11, c[2]); B.line(hx, hy - 12, hx, hy - 14, st[4]); if (w === 'spear') { B.put(hx - 1, hy - 12, st[2]); B.put(hx + 1, hy - 12, st[2]); } }
    } else if (w === 'bow') {
      const bw = ramp('#9a6434');
      if (dir === 'right') { B.line(hx + 2, hy - 6, hx + 3, hy - 3, bw[2]); B.line(hx + 3, hy - 3, hx + 3, hy + 1, bw[2]); B.line(hx + 3, hy + 1, hx + 2, hy + 4, bw[2]); B.grp('str', 'n'); B.line(hx + 1, hy - 5, hx + 1, hy + 3, 0xe0d8c8); }
      else { B.line(hx - 1, hy - 5, hx - 1, hy + 3, bw[2]); B.put(hx, hy - 6, bw[2]); B.put(hx, hy + 4, bw[2]); }
    } else if (w === 'staff' || w === 'rod') {
      const L = w === 'staff' ? 12 : 7;
      B.line(hx, hy + (w === 'staff' ? 4 : 1), hx, hy - L + 3, w === 'rod' ? gd[2] : wd[2]);
      B.grp('gem'); B.ell(hx + 0.5, hy - L + 1.5, 1.6, 1.6, ramp(spec.gem || spec.trim || '#e04040', 'metal'));
    } else if (w === 'claws') { B.grp('claws', 'n'); B.put(hx + 1, hy + 1, st[3]); B.put(hx - 1, hy + 1, st[3]); B.put(hx, hy + 2, st[3]); }
  }

  function mapHead(B, spec, C, dir, cx, hy, hr, frame) {
    const body = C.body, skinR = ramp(C.skin, 'skin'), hairR = ramp(C.hair, 'hair'), hs = spec.hairStyle || 'short', head = spec.head;
    const hooded = head === 'hood', fullHelm = head === 'horned';
    const side = dir === 'right', back = dir === 'up';
    const hx = side ? cx + 0.3 : cx;
    // long hair behind
    if (!hooded && !fullHelm && body !== 'skeleton' && body !== 'birdfolk') {
      B.grp('hair:back');
      if (hs === 'long') { if (side) B.poly([[hx - 4, hy], [hx + 0.5, hy], [hx - 1, hy + 7], [hx - 5, hy + 6]], hairR); else B.poly([[hx - 5.2, hy], [hx + 5.2, hy], [hx + 5, hy + 7], [hx - 5, hy + 7]], hairR, { shift: back ? 0 : -1 }); }
      if (hs === 'ponytail' || hs === 'braid') { if (side) B.chain([[hx - 4, hy - 2], [hx - 6.5, hy + 1], [hx - 6, hy + 5]], [1.6, 1.6, 1], hairR); else if (back) B.chain([[hx, hy], [hx, hy + 6]], [1.6, 1.1], hairR); }
    }
    B.grp('head');
    const sk = body === 'skeleton' ? ramp(DEF.bone) : skinR;
    B.ell(hx, hy, hr, hr * 0.93, sk);
    if (side && body !== 'skeleton') B.put(hx + hr - 0.2, hy + 1, sk[2]);
    // ears
    if (!hooded && !fullHelm) {
      B.grp('ear');
      if (body === 'elf' || body === 'goblin') {
        const L = body === 'goblin' ? 4 : 3;
        if (side) B.poly([[hx - 1, hy - 1], [hx - 1, hy + 2], [hx - 1 - L, hy - 2]], sk);
        else { B.poly([[hx - hr + 1, hy - 1], [hx - hr + 1, hy + 2], [hx - hr - L + 1, hy - 2]], sk); B.poly([[hx + hr - 1, hy - 1], [hx + hr - 1, hy + 2], [hx + hr + L - 1, hy - 2]], sk); }
      }
    }
    // hair
    if (body === 'birdfolk') {
      B.grp('hair');
      if (side) { B.ell(hx - 0.5, hy - 1, hr + 0.3, hr * 0.8, hairR, { test: (x, y) => !(x > hx + 0.5 && y > hy - 1.5) }); B.poly([[hx - 2, hy - 4], [hx - 8, hy - 3], [hx - 4, hy]], hairR); B.poly([[hx - 3, hy - 1], [hx - 8, hy + 1], [hx - 4, hy + 2]], hairR); }
      else if (back) { B.ell(hx, hy - 0.3, hr + 0.3, hr, hairR); }
      else { B.ell(hx, hy - 1, hr + 0.3, hr * 0.8, hairR, { test: (x, y) => y < hy - 1.5 || Math.abs(x - hx) > hr - 1.5 }); B.poly([[hx - 2, hy - 4], [hx, hy - 8], [hx + 2, hy - 4]], hairR); }
      B.grp('beak');
      if (side) B.poly([[hx + 3, hy], [hx + 7.5, hy + 1.5], [hx + 3, hy + 3]], ramp('#e0a830'), { flat: 2 });
      else if (!back) B.poly([[hx - 1.5, hy + 1.5], [hx + 1.5, hy + 1.5], [hx, hy + 4]], ramp('#e0a830'), { flat: 2 });
    } else if (body !== 'skeleton' && hs !== 'bald' && !hooded && !fullHelm) {
      B.grp('hair');
      const curly = hs === 'curly';
      if (back) B.ell(hx, hy - 0.3, hr + 0.4 + (curly ? 0.5 : 0), hr + (curly ? 0.4 : 0), hairR);
      else if (side) B.ell(hx - 0.4, hy - 0.8, hr + 0.4 + (curly ? 0.5 : 0), hr * 0.92, hairR, { test: (x, y) => { const dx = x - hx, dy = y - hy; return dy < -1.6 - (Math.floor(x) % 2) * 0.8 || (dx < -0.6 && dy < 2.5 && !(dx > -2.2 && dy > -0.5 && dy < 2)); } });
      else B.ell(hx, hy - 0.9, hr + 0.4 + (curly ? 0.6 : 0), hr * 0.9 + (curly ? 0.3 : 0), hairR, { test: (x, y) => { const dx = x - hx, dy = y - hy; return dy < -1.8 + (Math.floor(x + 0.5) % 3 === 0 ? 0.9 : 0) || (Math.abs(dx) > hr - 1.2 && dy < 2.8); } });
      if (hs === 'spiky') { if (side) { B.poly([[hx - 2, hy - 4], [hx - 7, hy - 6], [hx - 4, hy - 1]], hairR); B.poly([[hx, hy - 4], [hx - 2, hy - 8.5], [hx + 3, hy - 4]], hairR); B.poly([[hx + 2, hy - 4], [hx + 6, hy - 5.5], [hx + 4, hy - 2]], hairR); } else { B.poly([[hx - 4, hy - 3], [hx - 6.5, hy - 7], [hx - 1, hy - 4]], hairR); B.poly([[hx - 1.5, hy - 4], [hx, hy - 8.5], [hx + 1.5, hy - 4]], hairR); B.poly([[hx + 1, hy - 4], [hx + 6.5, hy - 7], [hx + 4, hy - 3]], hairR); } }
    }
    // beard
    if (C.beard && !fullHelm && !back) {
      B.grp('beard');
      const bR = ramp(C.beard, 'hair'), long = body === 'dwarf' ? 3 : 1.5;
      if (side) B.poly([[hx - 1, hy + 1], [hx + hr, hy + 1], [hx + hr - 0.5, hy + 3 + long * 0.6], [hx + 1, hy + 4 + long]], bR);
      else B.poly([[hx - hr + 1, hy + 1], [hx + hr - 1, hy + 1], [hx + hr - 2, hy + 3 + long * 0.5], [hx, hy + 4 + long], [hx - hr + 2, hy + 3 + long * 0.5]], bR);
    }
    // headgear
    const hc = C.headColor;
    if (head === 'helmet' || head === 'horned') {
      const mR = ramp(hc, 'metal');
      B.grp('hat');
      B.ell(hx - (side ? 0.4 : 0), hy - 1, hr + 0.6, hr * 0.95, mR, { test: (x, y) => { const dy = y - hy, dx = x - hx; if (fullHelm) return back || dy < 3.5; if (back) return dy < 3; if (side) return dy < -1 || (dx < -1 && dy < 3); return dy < -1 || (Math.abs(dx) > hr - 1.3 && dy < 2.5); } });
      if (fullHelm && !back) { B.grp('visor', 'n'); if (side) { B.line(hx + 1, hy, hx + hr, hy, 0x100810); } else { B.line(hx - 3, hy, hx + 3, hy, 0x100810); B.line(hx, hy, hx, hy + 2, 0x100810); } }
      if (fullHelm) { B.grp('horn'); const bn = ramp('#eadcc0'); if (side) { B.chain([[hx - 1, hy - 4], [hx - 2, hy - 8], [hx + 1, hy - 10]], [1.3, 1, 0.5], bn); } else { B.chain([[hx - 3, hy - 3], [hx - 6, hy - 6], [hx - 6, hy - 10]], [1.3, 1, 0.5], bn); B.chain([[hx + 3, hy - 3], [hx + 6, hy - 6], [hx + 6, hy - 10]], [1.3, 1, 0.5], bn); } }
      else { B.grp('crest'); if (side) B.chain([[hx, hy - 5.5], [hx - 3, hy - 6], [hx - 5, hy - 4]], [1, 1.3, 0.8], ramp(C.trim)); else B.line(hx, hy - 6, hx, hy - 3, ramp(C.trim)[2]); }
    } else if (hooded) {
      const cR = ramp(hc);
      B.grp('hat');
      B.ell(hx - (side ? 0.6 : 0), hy - 0.5, hr + 0.8, hr + 0.4, cR, { test: (x, y) => { const dx = x - hx, dy = y - hy; if (back) return true; if (side) return !(dx > -0.5 && dy > -2.3 && dy < 3.5); return !(Math.abs(dx) < hr - 1.4 && dy > -2.5 && dy < 3.5); } });
      if (!back && !side) B.poly([[hx - 1, hy - 6.3], [hx + 1, hy - 6.3], [hx, hy - 7.8]], cR);
    } else if (head === 'wizardhat' || head === 'hat') {
      const cR = ramp(hc);
      B.grp('hat');
      if (head === 'wizardhat') {
        if (side) B.poly([[hx - 4.5, hy - 3], [hx + 4, hy - 3], [hx - 1, hy - 8], [hx - 6, hy - 12], [hx - 3, hy - 7]], cR);
        else B.poly([[hx - 4.5, hy - 3], [hx + 4.5, hy - 3], [hx + 1, hy - 8], [hx - 3, hy - 12], [hx - 1.5, hy - 7.5]], cR);
        B.grp('hat:brim'); B.ell(hx, hy - 3, hr + 2.5, 1.4, cR, { shift: -1 });
        B.grp('hat:band', 's'); B.line(hx - 3.5, hy - 4, hx + 3.5, hy - 4, ramp(C.trim, 'metal')[3]);
      } else {
        B.ell(hx, hy - 4, hr * 0.8, 2.8, cR, { test: (x, y) => y < hy - 3 });
        B.grp('hat:brim'); B.ell(hx, hy - 3, hr + 2, 1.3, cR, { shift: -1 });
      }
    } else if (head === 'bandana') {
      B.grp('hat'); const cR = ramp(hc);
      B.ell(hx, hy - 1, hr + 0.3, hr, cR, { test: (x, y) => y > hy - 4.2 && y < hy - 2.2 });
      if (side) B.chain([[hx - hr, hy - 3], [hx - hr - 2, hy - 1 + frame]], [1, 0.6], cR);
      else if (back) { B.chain([[hx, hy - 3], [hx - 1, hy + 1 + frame]], [0.9, 0.6], cR); B.chain([[hx, hy - 3], [hx + 2, hy + 1]], [0.9, 0.6], cR); }
    } else if (head === 'circlet') {
      B.grp('hat', 's'); const gR = ramp(hc, 'metal');
      B.ell(hx, hy - 1, hr + 0.3, hr, gR, { test: (x, y) => y > hy - 3.9 && y < hy - 2.9, flat: 3 });
      if (!back) { B.grp('gem', 's'); B.put(side ? hx + 3 : hx, hy - 4, 0x60e0ff); }
    }
    return { hx, hooded, fullHelm };
  }

  function mapFace(B, spec, C, dir, H, hy, hr) {
    if (dir === 'up' || H.fullHelm) return;
    const body = C.body, dark = 0x1a1020, eye = h2i(C.eyes);
    B.only = ['head', 'beard', 'face']; B.grp('face', 'n');
    const y = Math.round(hy + 0.3);
    if (body === 'skeleton') {
      if (dir === 'right') { B.put(H.hx + 2, y, dark); B.put(H.hx + 2, y - 1, eye); }
      else { B.put(H.hx - 2.5, y, dark); B.put(H.hx + 1.5, y, dark); B.put(H.hx - 2.5, y - 1, eye); B.put(H.hx + 1.5, y - 1, eye); B.put(H.hx - 0.5, y + 3, dark); B.put(H.hx + 0.5, y + 3, dark); }
    } else if (dir === 'right') {
      B.put(H.hx + 2.5, y - 1, dark); B.put(H.hx + 2.5, y, eye);
      if (body === 'orc') B.put(H.hx + 4, y + 2, 0xfff8e0);
    } else {
      const ex1 = Math.round(H.hx - 2.6), ex2 = Math.round(H.hx + 1.6);
      B.put(ex1, y - 1, dark); B.put(ex1, y, eye); B.put(ex2, y - 1, dark); B.put(ex2, y, eye);
      if (body === 'orc') { B.put(ex1 + 1, y + 3, 0xfff8e0); B.put(ex2 - 1, y + 3, 0xfff8e0); }
      if (body === 'goblin') { B.put(H.hx - 0.5, y + 1, ramp(C.skin, 'skin')[0]); }
    }
    B.only = null;
  }

  function mapHumanoid(B, spec, dir, frame) {
    const C = pal(spec), body = C.body, mb = MB[body] || MB.human;
    const side = dir === 'right', back = dir === 'up';
    const hover = spec.wings ? 2 + frame : 0;
    const sh = mb.sh - hover, cx = 12, bw = mb.bw;
    const hr = mb.hr, hy = 8 + sh + (body === 'dwarf' ? 0.5 : 0);
    const top = 12.5 + sh, hemY = 18 + mb.sh * 0.35 - hover;
    const bones = body === 'skeleton';
    const skinR = bones ? ramp(DEF.bone) : ramp(C.skin, 'skin'), outR = ramp(C.outfit), trimR = ramp(C.trim), pantsR = ramp(C.pants), bootR = ramp(C.boots);
    const metR = C.armor ? ramp(C.armor, 'metal') : null;
    const torsoR = metR || (bones ? skinR : outR);
    const stepA = frame === 0 ? 1 : -1;
    // wings
    if (spec.wings || body === 'birdfolk') {
      B.grp('wing'); const wR = ramp(spec.wingColor || C.hair, 'hair');
      const fl = spec.wings ? (frame ? 2 : -2) : 0;
      if (side) B.poly([[cx - 1, top], [cx - 9, top - 5 + fl], [cx - 8, top + 3 + fl * 0.5], [cx - 2, top + 5]], wR, { shift: -1 });
      else { B.poly([[cx - 2, top], [cx - 8.5, top - 4 + fl], [cx - 8, top + 1 + fl * 0.5], [cx - 5.5, top + 6], [cx - 3, top + 5]], wR, { shift: back ? 0 : -1 }); B.poly([[cx + 2, top], [cx + 8.5, top - 4 + fl], [cx + 8, top + 1 + fl * 0.5], [cx + 5.5, top + 6], [cx + 3, top + 5]], wR, { shift: back ? 0 : -1 }); }
    }
    // cape (behind when facing down/right; over when up)
    const drawCape = () => {
      B.grp('cape'); const cR = ramp(C.cape);
      if (side) B.poly([[cx - 1, top], [cx - 4.5 - (frame ? 1 : 0), hemY + 3], [cx + 0.5, hemY + 3]], cR);
      else if (back) B.poly([[cx - bw - 0.5, top], [cx + bw + 0.5, top], [cx + bw + 1.5 + frame * 0.5, hemY + 3], [cx - bw - 1.5 - (1 - frame) * 0.5, hemY + 3]], cR, { folds: [1.5, 0.4] });
      else B.poly([[cx - bw - 0.5, top], [cx + bw + 0.5, top], [cx + bw + 1.5, hemY + 2], [cx - bw - 1.5, hemY + 2]], cR, { shift: -1 });
    };
    if (C.cape && !back) drawCape();
    // legs
    const legs = () => {
      B.grp('legs');
      const lr = body === 'dwarf' || body === 'orc' ? 1.5 : bones ? 0.8 : 1.2;
      const legC = bones ? skinR : pantsR, bC = bones ? skinR : (metR || bootR);
      const legTop = hemY - 1;
      if (side) {
        if (!hover) {
          const fA = frame === 0 ? [cx + 2.5, 21] : [cx + 0.5, 21], fB = frame === 0 ? [cx - 2, 21] : [cx + 0.2, 20.5];
          B.grp('legB'); B.cap(cx - 0.2, legTop, fB[0], fB[1] - 1, lr, lr, legC, { shift: -1 }); B.grp('legB:b'); B.ell(fB[0] + 0.8, fB[1] - 0.3, 1.8, 1.1, bC, { shift: -1 });
          B.grp('legF'); B.cap(cx + 0.3, legTop, fA[0], fA[1] - 1, lr, lr, legC); B.grp('legF:b'); B.ell(fA[0] + 0.8, fA[1] - 0.3, 1.8, 1.1, bC);
        } else { B.cap(cx, legTop, cx + 0.5, legTop + 3, lr, lr * 0.8, legC); B.ell(cx + 1, legTop + 3.5, 1.4, 1, bC); }
      } else {
        const lx1 = cx - (bw > 4 ? 2 : 1.6), lx2 = cx + (bw > 4 ? 2 : 1.6);
        const y1 = hover ? legTop + 2.5 : 21 - (frame === 0 ? 0 : 1), y2 = hover ? legTop + 2.5 : 21 - (frame === 0 ? 1 : 0);
        B.grp('legB'); B.cap(lx1, legTop, lx1 - 0.2, y1 - 1, lr, lr, legC); B.grp('legB:b'); B.ell(lx1 - 0.2, y1 - 0.5, 1.5, 1.1, bC);
        B.grp('legF'); B.cap(lx2, legTop, lx2 + 0.2, y2 - 1, lr, lr, legC); B.grp('legF:b'); B.ell(lx2 + 0.2, y2 - 0.5, 1.5, 1.1, bC);
      }
    };
    legs();
    // arms (far/back arm for side view)
    const armSwing = stepA * 1.0;
    const arm = (sx, sy, hx2, hy2, grp) => {
      B.grp(grp); const r = bones ? 0.7 : body === 'orc' || body === 'dwarf' ? 1.4 : 1.1;
      B.cap(sx, sy, hx2, hy2, r, r * 0.9, spec.robe ? outR : bones ? skinR : (metR || outR));
      B.grp(grp + ':h'); B.ell(hx2, hy2 + 0.3, 1.2, 1.2, (spec.weapon === 'fists') ? trimR : skinR);
    };
    let handN, handF;
    if (side) { handF = [cx - 1.5 - armSwing, top + 4.5]; arm(cx - 0.5, top + 1, handF[0], handF[1], 'armF'); }
    // body
    if (spec.robe) {
      B.grp('torso');
      if (side) B.poly([[cx - 2.7, top], [cx + 2.8, top], [cx + 3.6 + (frame ? 0.5 : 0), 21.2], [cx - 3.6, 21.2]], outR, { folds: [1.4, 0.3] });
      else B.poly([[cx - bw + 0.2, top], [cx + bw - 0.2, top], [cx + bw + 0.8, 21.2], [cx - bw - 0.8, 21.2]], outR, { folds: [1.6, 0.25] });
      B.grp('trim', 's');
      if (!back) { if (side) B.line(cx + 1.5, top + 1, cx + 2.8, 20.5, trimR[2]); else B.line(cx, top + 1, cx, 20.5, trimR[2]); }
      B.line(side ? cx - 3 : cx - bw - 0.5, 20.5, side ? cx + 3.6 : cx + bw + 0.5, 20.5, trimR[1]);
    } else {
      B.grp('torso');
      if (bones && !C.armor) {
        if (side) { B.rect(cx - 1, top, 2, hemY - top, skinR[2]); B.rect(cx - 1, top + 1, 4, 1, skinR[3]); B.rect(cx - 1, top + 3, 4, 1, skinR[3]); }
        else { B.rect(cx - 0.5, top, 1, hemY - top, skinR[1]); for (let i = 0; i < 3; i++) B.rect(cx - 2.5, top + 0.5 + i * 1.5, 5, 1, skinR[i === 0 ? 3 : 2]); }
        B.ell(cx, hemY - 0.5, 2.5, 1.2, skinR);
      } else if (side) B.poly([[cx - 2.4, top], [cx + 2.5, top], [cx + 3, hemY], [cx - 2.8, hemY]], torsoR, { vg: 0.6 });
      else B.poly([[cx - bw, top], [cx + bw, top], [cx + bw + 0.6, hemY], [cx - bw - 0.6, hemY]], torsoR, { vg: 0.6 });
      if (!bones || C.armor) {
        B.grp('belt', 's');
        const by = Math.round(hemY - 2);
        if (side) B.line(cx - 2.8, by, cx + 2.8, by, 0x6a4028); else B.line(cx - bw - 0.4, by, cx + bw + 0.3, by, 0x6a4028);
        if (!back) B.put(side ? cx + 2 : cx, by, h2i(DEF.gold));
        if (metR) { B.grp('skirt'); if (side) B.rect(cx - 2.6, by + 1, 5.6, 1, outR[2]); else B.rect(cx - bw - 0.5, by + 1, bw * 2 + 1, 1, outR[2]); }
        else if (!back) { B.grp('collar', 's'); if (side) { B.put(cx + 1, top, trimR[2]); B.put(cx + 2, top + 1, trimR[2]); } else { B.put(cx - 1, top, trimR[3]); B.put(cx, top + 1, trimR[2]); B.put(cx + 1, top, trimR[3]); } }
      }
    }
    // shield on far side (front view: viewer's right)
    const shieldDraw = () => {
      B.grp('shield'); const sR = ramp(spec.shieldColor || C.trim), rim = ramp(C.armor || DEF.steel, 'metal');
      if (side) { B.ell(cx - 3, top + 3.5, 2, 3.2, rim); B.grp('shield:f'); B.ell(cx - 3.3, top + 3.5, 1.2, 2.3, sR); }
      else if (back) { B.ell(cx - bw - 1.2, top + 3.5, 2.4, 3.2, rim, { shift: -1 }); }
      else { B.ell(cx + bw + 1.3, top + 3.5, 2.4, 3.2, rim); B.grp('shield:f'); B.ell(cx + bw + 1.3, top + 3.5, 1.5, 2.3, sR); }
    };
    if (spec.shield && side) shieldDraw();
    // head
    const H = mapHead(B, spec, C, dir, cx, hy, hr, frame);
    if (C.cape && back) drawCape();
    // arms and weapon
    if (side) {
      handN = [cx + 1.5 + armSwing, top + 4.5];
      mapWeapon(B, spec, dir, handN[0], handN[1], frame, 1);
      arm(cx + 0.5, top + 1, handN[0], handN[1], 'armN');
    } else {
      const ax = bw + 0.8;
      const hL = [cx - ax - 0.3, top + 4 + (frame === 0 ? -0.5 : 0.5)], hR = [cx + ax + 0.3, top + 4 + (frame === 0 ? 0.5 : -0.5)];
      // weapon hand: front view -> viewer's left (unit's right hand); back view -> viewer's right
      const wh = back ? hR : hL, oh = back ? hL : hR;
      if (back) mapWeapon(B, spec, dir, wh[0], wh[1], frame, 1);
      arm(cx - bw + 0.5, top + 0.8, hL[0], hL[1], 'armL'); arm(cx + bw - 0.5, top + 0.8, hR[0], hR[1], 'armR');
      if (!back) mapWeapon(B, spec, dir, wh[0], wh[1], frame, -1);
      if (spec.shield) shieldDraw();
      void oh;
    }
    if (C.armor && !back) { B.grp('paul'); if (side) B.ell(cx + 0.3, top + 0.8, 1.8, 1.4, metR); else { B.ell(cx - bw + 0.3, top + 0.8, 1.7, 1.4, metR); B.ell(cx + bw - 0.3, top + 0.8, 1.7, 1.4, metR); } }
    B.lines();
    mapFace(B, spec, C, dir, H, hy, hr);
  }

  function mapHorse(B, spec, dir, frame) {
    const C = pal(spec), hR = ramp(C.horse), mane = ramp(spec.mane || G.shade(C.horse, 0.45), 'hair'), clothR = ramp(C.outfit), trimR = ramp(C.trim);
    const side = dir === 'right', back = dir === 'up', b = frame;
    const rider = Object.assign({}, spec, { mount: null });
    const rC = pal(rider), rOut = C.armor ? ramp(C.armor, 'metal') : ramp(C.outfit), rBoot = C.armor ? ramp(C.armor, 'metal') : ramp(rC.boots);
    const hoof = 0x3a2828, blaze = lighten(h2i(C.horse), 0.6);
    if (side) {
      const lg = frame === 0 ? [[5.5, 4], [7, 8.5], [14, 12.5], [15.5, 17.5]] : [[5.5, 7], [7, 5.5], [14, 15.5], [15.5, 14]];
      B.grp('tail'); B.chain([[4, 13.5 + b], [2.2, 16], [2.5, 20.5]], [1.3, 1.5, 0.7], mane);
      const leg = (i, sh) => { const l = lg[i]; B.grp('hl' + i); B.cap(l[0], 16 + b, l[1], 21, 1.4, 1, hR, { shift: sh }); B.put(l[1], 21.5, hoof); B.put(l[1] + 1, 21.5, hoof); };
      leg(0, -1); leg(2, -1);
      B.grp('hbody'); B.ell(10, 15.5 + b, 6.6, 3.4, hR); B.ell(14.3, 15 + b, 2.8, 3.2, hR);
      B.grp('hneck'); B.cap(15, 14 + b, 17.8, 10 + b, 2.5, 1.9, hR);
      B.grp('hhead'); B.cap(18.2, 9.4 + b, 21.4, 12.2 + b, 2, 1.3, hR);
      B.grp('hear'); B.poly([[17, 8.8 + b], [17.4, 6.3 + b], [18.8, 8.5 + b]], hR);
      B.grp('mane'); B.chain([[17, 8.4 + b], [16, 10.6 + b], [14.8, 12.6 + b]], [0.9, 1, 0.6], mane);
      B.grp('cloth'); B.poly([[6, 12.3 + b], [12.8, 12.3 + b], [13.3, 17.2 + b], [5.4, 17.2 + b]], clothR, { vg: 0.5 });
      B.grp('cloth:t', 's'); B.line(5.5, 17 + b, 13.2, 17 + b, trimR[2]);
      leg(1, 0); leg(3, 0);
      // rider
      const rx = 9, hip = 12.6 + b;
      B.grp('rtorso'); B.poly([[rx - 2.1, hip - 5], [rx + 2.1, hip - 5], [rx + 2.4, hip], [rx - 2.4, hip]], rOut, { vg: 0.5 });
      B.grp('rleg'); B.cap(rx, hip, rx + 1.8, hip + 3.2, 1.2, 1, ramp(rC.pants)); B.grp('rleg:b'); B.ell(rx + 2.1, hip + 3.6, 1.4, 1, rBoot);
      const H = mapHead(B, rider, rC, dir, rx + 0.2, hip - 7.5, 3.2, frame);
      mapWeapon(B, rider, dir, rx + 2.3, hip - 2, frame, 1, true);
      B.grp('rarm'); B.cap(rx + 0.3, hip - 4.3, rx + 2.2, hip - 2, 1, 1, rOut); B.grp('rarm:h'); B.ell(rx + 2.3, hip - 1.8, 1, 1, ramp(rC.skin, 'skin'));
      if (C.armor) { B.grp('paul'); B.ell(rx + 0.3, hip - 4.4, 1.6, 1.3, rOut); }
      B.lines();
      mapFace(B, rider, rC, dir, H, hip - 7.5, 3.2);
      B.grp('det', 'n'); B.put(19.2, 9.8 + b, 0x100808);
    } else {
      const lf = frame === 0 ? [21.5, 20.5] : [20.5, 21.5];
      // hind legs (behind), front legs
      [[7.2, lf[1]], [16.8, lf[0]]].forEach(([x, y], i) => { B.grp('hb' + i); B.cap(x, 15, x, y - 1, 1.2, 1, hR, { shift: -1 }); B.put(x, y - 0.5, hoof); });
      B.grp('hbody'); B.ell(12, 15.5 + b * 0.5, 6, 4.2, hR);
      if (back) { B.grp('rump'); B.ell(12, 16 + b * 0.5, 5.2, 3.6, hR, { shift: 0 }); }
      [[9.6, lf[0]], [14.4, lf[1]]].forEach(([x, y], i) => { B.grp('hf' + i); B.cap(x, 16, x, y - 1, 1.3, 1.1, hR); B.put(x, y - 0.5, hoof); B.put(x - 1, y - 0.5, hoof); });
      B.grp('cloth'); B.poly([[5.6, 12.5 + b], [18.4, 12.5 + b], [18.2, 16.8 + b], [5.8, 16.8 + b]], clothR, { vg: 0.4 });
      B.grp('cloth:t', 's'); B.line(5.8, 16.6 + b, 18.2, 16.6 + b, trimR[2]);
      if (back) { B.grp('tail'); B.chain([[12, 15 + b], [12.4, 18.5], [12, 21.5]], [1.5, 1.7, 0.8], mane); }
      // rider
      const hip = 12.6 + b;
      B.grp('rlegs'); B.cap(8.6, hip, 6.8, hip + 3.6, 1.2, 1, ramp(rC.pants)); B.cap(15.4, hip, 17.2, hip + 3.6, 1.2, 1, ramp(rC.pants));
      B.grp('rboot'); B.ell(6.7, hip + 4, 1.2, 1.2, rBoot); B.ell(17.3, hip + 4, 1.2, 1.2, rBoot);
      B.grp('rtorso'); B.poly([[9.3, hip - 5], [14.7, hip - 5], [15.3, hip + 0.5], [8.7, hip + 0.5]], rOut, { vg: 0.5 });
      if (C.cape && back) { B.grp('cape'); B.poly([[9, hip - 5], [15, hip - 5], [16, hip + 2], [8, hip + 2]], ramp(C.cape)); }
      const H = mapHead(B, rider, rC, dir, 12, hip - 7.6, 3.3, frame);
      if (!back) {
        B.grp('hhead'); B.cap(12, 12.2 + b, 12, 19.6 + b, 2.3, 1.7, hR);
        B.grp('hear'); B.poly([[9.4, 12.5 + b], [9.4, 10 + b], [11.2, 12 + b]], hR); B.poly([[14.6, 12.5 + b], [14.6, 10 + b], [12.8, 12 + b]], hR);
        B.grp('hmane'); B.ell(12, 12.2 + b, 1.4, 1, mane);
      }
      const wx = back ? 16.4 : 7.6;
      mapWeapon(B, rider, dir, wx, hip - 1.5, frame, back ? 1 : -1);
      B.grp('rarm'); B.cap(back ? 14.6 : 9.4, hip - 4.4, wx, hip - 1.5, 1, 1, rOut); B.cap(back ? 9.4 : 14.6, hip - 4.4, back ? 7.8 : 16.2, hip - 1.2, 1, 1, rOut);
      if (spec.shield) { B.grp('shield'); B.ell(back ? 7.4 : 16.8, hip - 1.4, 2.1, 2.8, ramp(C.armor || DEF.steel, 'metal'), { shift: back ? -1 : 0 }); if (!back) { B.grp('shield:f'); B.ell(16.8, hip - 1.4, 1.2, 2, ramp(spec.shieldColor || C.trim)); } }
      B.lines();
      mapFace(B, rider, rC, dir, H, hip - 7.6, 3.3);
      if (!back) { B.grp('det', 'n'); B.put(10.6, 15 + b, 0x100808); B.put(13.4, 15 + b, 0x100808); B.put(12, 14 + b, blaze); B.put(12, 15 + b, blaze); B.put(12, 16 + b, blaze); B.put(11, 19 + b, 0x301818); B.put(13, 19 + b, 0x301818); }
    }
  }

  function mapBeast(B, spec, dir, frame) {
    const C = pal(spec), body = C.body;
    const main = ramp(spec.outfit || (body === 'rat' ? '#8a7a70' : body === 'bat' ? '#5a3a6a' : body === 'wolf' ? '#7a7888' : body === 'slime' ? '#40c060' : '#4a3a6a'), body === 'slime' ? 'hair' : 'cloth');
    const belly = ramp(spec.trim || (body === 'rat' ? '#d8b8a8' : body === 'wolf' ? '#c8c4c8' : '#c8a0c0'));
    const eye = h2i(spec.eyes || (body === 'slime' ? '#101830' : '#ff3020'));
    const side = dir === 'right', back = dir === 'up';
    const pink = ramp('#d8a0a0');
    if (body === 'rat') {
      if (side) {
        B.grp('tail'); B.chain([[5, 18], [2.5, 16 - frame], [2, 12]], [1, 0.8, 0.5], ramp('#d0a098'));
        B.grp('legB'); B.cap(8, 18, 7 + frame, 21, 1.3, 1, main, { shift: -1 }); B.cap(15, 18, 16 - frame, 21, 1.1, 0.9, main, { shift: -1 });
        B.grp('body'); B.ell(11, 16 + frame * 0.5, 6.5, 4.4, main);
        B.grp('head'); B.ell(17, 14 + frame * 0.5, 3.6, 3.2, main); B.cap(18, 14.5 + frame * 0.5, 21.5, 16 + frame * 0.5, 2.2, 1, main);
        B.grp('ear'); B.ell(15.5, 10.8 + frame * 0.5, 1.8, 2, pink);
        B.grp('legF'); B.cap(9.5, 19, 10 - frame, 21, 1.3, 1, main); B.cap(16, 18, 17 + frame, 21, 1.1, 0.9, main);
        B.lines(); B.grp('d', 'n'); B.put(18, 13 + frame * 0.5, eye); B.put(22, 16 + frame * 0.5, 0x301018);
      } else {
        B.grp('tail'); if (back) B.chain([[12, 20], [14, 22], [17, 21.5]], [1, 0.8, 0.5], ramp('#d0a098'));
        B.grp('body'); B.ell(12, 16.5, 6, 4.8, main);
        B.grp('feet'); B.ell(8.5, 21 - frame, 1.5, 1, main); B.ell(15.5, 20 + frame, 1.5, 1, main);
        if (!back) {
          B.grp('belly'); B.ell(12, 18, 3.5, 3, belly);
          B.grp('head'); B.ell(12, 12.5, 4.2, 3.6, main); B.ell(12, 15, 2, 1.8, main);
          B.grp('ear'); B.ell(8, 9.5, 2, 2.2, pink); B.grp('ear2'); B.ell(16, 9.5, 2, 2.2, pink);
          B.lines(); B.grp('d', 'n'); B.put(10, 12, eye); B.put(14, 12, eye); B.put(12, 15, 0x301018); B.put(11, 16, 0xfff8e0); B.put(12, 16, 0xfff8e0);
        } else { B.grp('ear'); B.ell(8.3, 10.5, 2, 2.2, pink, { shift: -1 }); B.grp('ear2'); B.ell(15.7, 10.5, 2, 2.2, pink, { shift: -1 }); B.grp('head'); B.ell(12, 12.6, 3.8, 3.3, main, { shift: -1 }); B.lines(); }
      }
    } else if (body === 'bat') {
      const fl = frame ? 3 : -2, y0 = 11 + frame;
      B.grp('wing'); const wR = ramp(G.shade(spec.outfit || '#5a3a6a', 0.85));
      const wingPts = s => [[12 + s * 2, y0 - 1], [12 + s * 7, y0 - 4 + fl * 0.5], [12 + s * 11, y0 - 3 + fl], [12 + s * 11.5, y0 + 2 + fl], [12 + s * 9, y0 + 1 + fl * 0.6], [12 + s * 7, y0 + 4 + fl * 0.3], [12 + s * 4, y0 + 2], [12 + s * 2, y0 + 3]];
      if (side) { B.poly(wingPts(-1).map(p => [p[0] * 0.7 + 3, p[1]]), wR, { shift: -1 }); }
      else { B.poly(wingPts(-1), wR, { shift: back ? 0 : -1 }); B.poly(wingPts(1), wR, { shift: back ? 0 : -1 }); }
      B.grp('body'); B.ell(12, y0 + 1, 3, 3.6, main);
      B.grp('ears'); if (side) B.poly([[11, y0 - 2], [11.5, y0 - 6], [13, y0 - 2.5]], main); else { B.poly([[9.5, y0 - 2], [9, y0 - 6], [11.5, y0 - 3]], main); B.poly([[14.5, y0 - 2], [15, y0 - 6], [12.5, y0 - 3]], main); }
      if (side) { B.grp('wingN'); B.poly(wingPts(1).map(p => [p[0] * 0.55 + 6, p[1] + 1]), wR); }
      B.lines(); B.grp('d', 'n');
      if (!back) { if (side) { B.put(14, y0, eye); B.put(15, y0 + 2, 0xffffff); } else { B.put(10.5, y0, eye); B.put(13.5, y0, eye); B.put(11, y0 + 2, 0xffffff); B.put(13, y0 + 2, 0xffffff); } }
    } else if (body === 'wolf') {
      if (side) {
        B.grp('tail'); B.chain([[5, 13], [2.5, 14 - frame], [2, 17 - frame]], [1.4, 1.6, 0.6], main);
        const lg = frame === 0 ? [[7, 5], [9, 11], [15, 14], [17, 20]] : [[7, 9], [9, 7], [15, 18], [17, 16]];
        lg.forEach((l, i) => { B.grp('l' + i); B.cap(l[0], 15, l[1], 21, 1.3, 1, main, { shift: i % 2 ? 0 : -1 }); });
        B.grp('body'); B.ell(11.5, 14, 7, 3.6, main);
        B.grp('ruff'); B.ell(16, 13.5, 3, 3.5, belly);
        B.grp('head'); B.ell(18, 10.5, 3.2, 3, main); B.cap(19, 11, 22.5, 12, 1.8, 1.1, main);
        B.grp('ear'); B.poly([[16, 8.5], [16.5, 5], [18.5, 8]], main);
        B.lines(); B.grp('d', 'n'); B.put(19, 10, eye); B.put(22, 11.5, 0x101018);
      } else {
        B.grp('body'); B.ell(12, 16, 5.5, 4.5, main);
        B.grp('legs'); B.cap(9, 17, 9, 21 - frame, 1.3, 1, main); B.cap(15, 17, 15, 20 + frame, 1.3, 1, main);
        if (back) { B.grp('tail'); B.chain([[12, 18], [12.5, 21], [14, 22]], [1.5, 1.5, 0.6], main); B.grp('head'); B.ell(12, 10.5, 3.8, 3.4, main); B.grp('ear'); B.poly([[8.5, 9], [9, 5], [11, 8]], main); B.poly([[15.5, 9], [15, 5], [13, 8]], main); B.lines(); }
        else {
          B.grp('ruff'); B.ell(12, 16, 3.5, 3.5, belly);
          B.grp('head'); B.ell(12, 10.5, 4, 3.6, main); B.ell(12, 13, 2, 1.8, belly);
          B.grp('ear'); B.poly([[8.5, 9], [8.5, 4.5], [11, 7.5]], main); B.poly([[15.5, 9], [15.5, 4.5], [13, 7.5]], main);
          B.lines(); B.grp('d', 'n'); B.put(10, 10, eye); B.put(14, 10, eye); B.put(11, 12, 0x101018); B.put(12, 12, 0x101018);
        }
      }
    } else if (body === 'slime') {
      const sq = frame ? 0.85 : 1.05, w = 7 / Math.sqrt(sq), h = 6.5 * sq;
      B.grp('body'); B.ell(12, 21 - h, w, h, main, { test: (x, y) => y < 21.2 });
      B.poly([[12 - w, 21.2], [12 - w * 0.6, 21 - h * 0.9], [12, 21 - h * 2.1], [12 + w * 0.6, 21 - h * 0.9], [12 + w, 21.2]], main, { nk: 1, vg: 1.2 });
      B.lines(); B.grp('d', 'n');
      B.put(12 - w * 0.45, 21 - h * 1.35, 0xffffff); B.put(12 - w * 0.45 + 1, 21 - h * 1.35, 0xffffff);
      if (!back) {
        const ey = Math.round(21 - h * 0.8);
        if (side) { B.rect(14, ey - 1, 1, 2, eye); B.rect(17, ey - 1, 1, 2, eye); }
        else { B.rect(9.5, ey - 1, 1, 2, eye); B.rect(13.5, ey - 1, 1, 2, eye); }
      }
    } else if (body === 'wraith') {
      const fy = frame ? 1 : 0, robe = main, trim = ramp(spec.trim || '#8870c0');
      B.grp('robe');
      const pts = [[12 - 4, 9 + fy], [12 + 4, 9 + fy]];
      for (let i = 0; i <= 4; i++) pts.push([12 + 5.5 - i * 2.75, 20 + fy - (i % 2 ? 2 : 0) + (frame && i % 2 === 0 ? -1 : 0)]);
      B.poly(pts, robe, { folds: [1.3, 0.3] });
      B.grp('hood'); B.ell(12 + (side ? -0.5 : 0), 7.5 + fy, 4.8, 4.6, robe);
      if (!side) { B.grp('armL'); B.cap(8, 11 + fy, 5.5, 14 + fy - frame, 1.3, 1, robe); B.grp('armR'); B.cap(16, 11 + fy, 18.5, 14 + fy - (1 - frame), 1.3, 1, robe); }
      else { B.grp('armR'); B.cap(12, 11 + fy, 16, 13 + fy, 1.3, 1, robe); }
      if (!back) { B.grp('void', 'n'); if (side) B.ell(14.5, 8 + fy, 2, 3, 0x0a0614); else B.ell(12, 8.5 + fy, 3, 2.8, 0x0a0614); }
      B.lines(); B.grp('d', 'n');
      if (!back) { if (side) B.put(15, 8 + fy, eye); else { B.put(11, 8 + fy, eye); B.put(13, 8 + fy, eye); } }
      void trim;
    }
  }

  G.unitSprite = function (spec, dir, frame) {
    dir = dir || 'down'; frame = frame ? 1 : 0;
    const key = 'us|' + specKey(spec) + '|' + dir + '|' + frame;
    return G.cached(key, 24, 24, (ctx, cv) => {
      const flip = dir === 'left';
      const d = flip ? 'right' : dir;
      const B = new Buf(24, 24, flip ? 1 : -1, 0);
      B.th = [0.95, 0.5, 0.05, -0.35];
      const body = spec.body || 'human';
      if (HUMANOID[body]) { if (spec.mount === 'horse') mapHorse(B, spec, d, frame); else mapHumanoid(B, spec, d, frame); }
      else mapBeast(B, spec, d, frame);
      B.outline();
      B.toCanvas(flip, cv);
    });
  };

  // ==================================================================
  // PORTRAITS (52x52 bust, near-frontal anime style)
  // ==================================================================
  function portraitLayer(ps, eyesClosed, mouthOpen) {
    const B = new Buf(52, 52, -1, 0.1);
    B.th = [0.9, 0.5, 0.08, -0.3];
    const body = ps.body || 'human';
    const C = pal(Object.assign({ outfit: ps.outfit, trim: ps.trim }, ps));
    const skinR = ramp(C.skin, body === 'skeleton' ? 'cloth' : 'skin'), hairR = ramp(C.hair, 'hair'), outR = ramp(C.outfit), trimR = ramp(C.trim);
    const age = ps.age || 'adult', face = ps.face || 'soft', hs = ps.hairStyle || 'short', head = ps.head;
    const hooded = head === 'hood', fullHelm = head === 'horned';
    const cx = 26, cy = 23 + (body === 'dwarf' ? 1 : 0);
    const fw = (body === 'dwarf' || body === 'orc' ? 12.5 : face === 'round' || body === 'halfling' ? 12 : face === 'sharp' || body === 'elf' ? 10.8 : 11.4) * 1.13;
    const fh = 14.6;
    const chinY = cy + (face === 'sharp' ? 16.5 : face === 'round' ? 14 : 15.5) + (age === 'old' ? 0.5 : 0);
    const jawY = cy + 7, jawW = face === 'round' ? fw * 0.95 : face === 'sharp' ? fw * 0.7 : fw * 0.82;
    // shoulders / outfit
    const metR = C.armor ? ramp(C.armor, 'metal') : null;
    const capeR = ps.cape ? ramp(ps.cape) : null;
    if (capeR) { B.grp('cape'); B.poly([[1, 52], [4, 45], [cx, 42], [48, 45], [51, 52]], capeR, { folds: [0.5, 0.3] }); }
    B.grp('body');
    const shW = body === 'dwarf' || body === 'orc' ? 22 : body === 'halfling' || body === 'goblin' ? 16 : 19;
    if (body === 'skeleton') {
      B.ell(cx, 55, shW, 13, metR || ramp('#5a5060'));
    } else B.poly([[cx - shW - 3, 53], [cx - shW, 47.5], [cx - 8, 43], [cx + 8, 43], [cx + shW, 47.5], [cx + shW + 3, 53]], metR || outR, { nk: 0.9, vg: 0.6 });
    if (ps.robe || (!metR && body !== 'skeleton')) {
      B.grp('body:collar');
      B.poly([[cx - 7, 43], [cx - 1, 50], [cx + 1, 50], [cx + 7, 43], [cx + 9.5, 44.5], [cx + 1, 53], [cx - 1, 53], [cx - 9.5, 44.5]], trimR, { vg: 0.3 });
    }
    if (metR) {
      B.grp('paul'); B.ell(cx - shW + 2, 49, 7.5, 5.5, metR); B.grp('paul2'); B.ell(cx + shW - 2, 49, 7.5, 5.5, metR);
      B.grp('gorget'); B.poly([[cx - 8, 42.5], [cx + 8, 42.5], [cx + 10, 47.5], [cx - 10, 47.5]], metR, { vg: 0.8 });
      B.grp('tabard'); B.poly([[cx - 5, 47.5], [cx + 5, 47.5], [cx + 4, 53], [cx - 4, 53]], outR);
    }
    // back hair
    if (!hooded && !fullHelm && body !== 'skeleton' && body !== 'birdfolk') {
      B.grp('hair:back');
      if (hs === 'long') B.poly([[cx - fw - 2, cy - 4], [cx + fw + 2, cy - 4], [cx + fw + 4, cy + 18], [cx + fw - 1, cy + 22], [cx - fw + 1, cy + 22], [cx - fw - 4, cy + 18]], hairR, { folds: [0.9, 0.35] });
      if (hs === 'ponytail') B.chain([[cx + fw - 2, cy - 8], [cx + fw + 5, cy - 4], [cx + fw + 6, cy + 6], [cx + fw + 4, cy + 14]], [3, 3.5, 2.8, 1.2], hairR);
      if (hs === 'braid') for (let i = 0; i < 5; i++) B.ell(cx + fw + 1 + i * 0.3, cy + 2 + i * 4, 2.8 - i * 0.2, 2.3, hairR);
      if (hs === 'curly') B.ell(cx, cy - 2, fw + 5, fh + 2, hairR, { test: (x, y, dx, dy) => { const a = Math.atan2(dy, dx); return Math.hypot(dx, dy) < 0.9 + 0.1 * Math.cos(a * 11) && y < cy + 10; } });
    }
    if (hooded) { B.grp('hood:back'); B.ell(cx, cy, fw + 5, fh + 4, ramp(C.headColor), { shift: -1 }); B.poly([[cx - fw - 5, cy], [cx + fw + 5, cy], [cx + shW - 2, 46], [cx - shW + 2, 46]], ramp(C.headColor), { shift: -1 }); }
    // neck
    B.grp('skin:neck');
    if (body === 'skeleton') B.cap(cx, cy + 10, cx, 42, 2.5, 2.5, skinR);
    else B.poly([[cx - 4.8, cy + 8], [cx + 4.8, cy + 8], [cx + 5.3, 45], [cx - 5.3, 45]], skinR, { shift: -1, nk: 0.8 });
    // ears
    B.grp('ear');
    if (!hooded && !fullHelm && body !== 'skeleton') {
      if (body === 'elf') { B.poly([[cx - fw + 1, cy - 1], [cx - fw - 8, cy - 9], [cx - fw + 1, cy + 5]], skinR); B.poly([[cx + fw - 1, cy - 1], [cx + fw + 8, cy - 9], [cx + fw - 1, cy + 5]], skinR); }
      else if (body === 'goblin') { B.poly([[cx - fw + 1, cy - 2], [cx - fw - 11, cy - 5], [cx - fw + 1, cy + 5]], skinR); B.poly([[cx + fw - 1, cy - 2], [cx + fw + 11, cy - 5], [cx + fw - 1, cy + 5]], skinR); }
      else if (body === 'orc') { B.poly([[cx - fw + 1, cy - 1], [cx - fw - 5, cy - 4], [cx - fw + 1, cy + 5]], skinR); B.poly([[cx + fw - 1, cy - 1], [cx + fw + 5, cy - 4], [cx + fw - 1, cy + 5]], skinR); }
      else if (body !== 'birdfolk') { B.ell(cx - fw, cy + 2, 2.2, 3.2, skinR); B.ell(cx + fw, cy + 2, 2.2, 3.2, skinR); }
    }
    // face
    B.grp('skin');
    if (body === 'skeleton') {
      B.ell(cx, cy - 1, fw + 0.5, fh, skinR);
      B.poly([[cx - fw * 0.7, cy + 4], [cx + fw * 0.7, cy + 4], [cx + fw * 0.5, cy + 12], [cx - fw * 0.5, cy + 12]], skinR, { shift: -1 });
    } else {
      B.ell(cx, cy - 1, fw, fh, skinR, { test: (x, y) => y < jawY + 1 });
      B.poly([[cx - fw, jawY - 3], [cx + fw, jawY - 3], [cx + jawW, jawY + 3], [cx + 2.5, chinY], [cx - 2.5, chinY], [cx - jawW, jawY + 3]], skinR, { nk: 0.9, vg: 0.5 });
    }
    if (body === 'birdfolk') {
      B.grp('beak'); const hr2 = ramp('#e0a830', 'metal');
      B.poly([[cx - 4, cy + 3], [cx + 4, cy + 3], [cx + 1.5, cy + 11], [cx, cy + 12], [cx - 1.5, cy + 11]], hr2, { vg: 0.6 });
    }
    // beard
    if (C.beard && !fullHelm && body !== 'skeleton') {
      B.grp('beard'); const bR = ramp(C.beard, 'hair'); const L = body === 'dwarf' ? 15 : age === 'old' ? 11 : 6;
      B.poly([[cx - fw, cy + 1], [cx - fw + 2, cy + 8], [cx - 5, cy + 7], [cx, cy + 8.5], [cx + 5, cy + 7], [cx + fw - 2, cy + 8], [cx + fw, cy + 1], [cx + fw + 1, cy + 10], [cx + 5, chinY + L * 0.6], [cx, chinY + L], [cx - 5, chinY + L * 0.6], [cx - fw - 1, cy + 10]], bR, { folds: [0.9, 0.3] });
      B.grp('beard:m'); B.poly([[cx - 6, cy + 7.5], [cx - 1, cy + 6], [cx + 1, cy + 6], [cx + 6, cy + 7.5], [cx + 7, cy + 10], [cx + 1, cy + 8.5], [cx - 1, cy + 8.5], [cx - 7, cy + 10]], bR);
    }
    // front hair
    const fringeY = cy - fh * 0.45;
    if (body === 'birdfolk') {
      B.grp('hair');
      B.ell(cx, cy - 4, fw + 2, fh * 0.85, hairR, { test: (x, y) => y < fringeY + 1 + Math.abs(x - cx) * 0.25 || Math.abs(x - cx) > fw - 2.5 });
      for (let i = -2; i <= 2; i++) B.poly([[cx + i * 5 - 3, cy - 12], [cx + i * 7, cy - 24 + Math.abs(i) * 3], [cx + i * 5 + 3, cy - 12]], hairR);
      B.poly([[cx - fw - 1, cy - 2], [cx - fw - 8, cy + 4], [cx - fw + 1, cy + 6]], hairR); B.poly([[cx + fw + 1, cy - 2], [cx + fw + 8, cy + 4], [cx + fw - 1, cy + 6]], hairR);
    } else if (body !== 'skeleton' && hs !== 'bald' && !hooded && !fullHelm) {
      B.grp('hair');
      const rx = fw + (hs === 'curly' ? 3 : 1.6), ry = fh + (hs === 'curly' ? 1.5 : 0.6);
      B.ell(cx, cy - 2.5, rx, ry, hairR, {
        test: (x, y, dx, dy) => {
          const ax = Math.abs(x - cx);
          const bang = fringeY + ((Math.floor(x) * 7) % 5 < 2 ? 3 : 0) + (ax < 3 ? 1.5 : 0) + (hs === 'spiky' ? ((Math.floor(x / 2) % 2) ? 2 : -1) : 0);
          if (y < bang) return true;
          if (ax > fw - 2.2 && y < cy + (hs === 'long' ? 16 : 5)) return true;
          if (hs === 'curly') { const a = Math.atan2(dy, dx); return Math.hypot(dx, dy) > 0.8 && Math.hypot(dx, dy) < 0.9 + 0.1 * Math.cos(a * 11) && y < cy + 4; }
          return false;
        }
      });
      if (hs === 'long') { B.poly([[cx - fw - 1.5, cy - 3], [cx - fw + 3, cy - 3], [cx - fw + 2, cy + 16], [cx - fw - 3, cy + 17]], hairR, { folds: [1, 0.3] }); B.poly([[cx + fw + 1.5, cy - 3], [cx + fw - 3, cy - 3], [cx + fw - 2, cy + 16], [cx + fw + 3, cy + 17]], hairR, { folds: [1, 0.3] }); }
      if (hs === 'spiky') for (let i = -3; i <= 3; i++) { const bx = cx + i * 4.2; B.poly([[bx - 3.5, cy - 10], [bx + i * 1.8, cy - 21 + Math.abs(i) * 1.8], [bx + 3.5, cy - 10]], hairR); }
      if (hs === 'ponytail' || hs === 'braid') { B.grp('tie'); B.ell(cx + fw + 1, cy - 7, 2, 2, trimR); }
    } else if (hs === 'bald' && age === 'old' && !head) {
      B.grp('hair'); B.ell(cx - fw + 1, cy - 2, 3, 4, hairR); B.ell(cx + fw - 1, cy - 2, 3, 4, hairR);
    }
    if (body !== 'skeleton' && !hooded && !fullHelm && hs !== 'bald' && head !== 'helmet') {
      B.only = ['hair']; B.grp('hair:sheen');
      const hl = hairR[4], hm = hairR[3];
      B.ell(cx - 1, cy - 3.5, fw + 1, fh, hm, { test: (x, y, dx, dy) => { const r = Math.hypot(dx, dy); return r > 0.62 && r < 0.74 && dy < -0.35 && dx < 0.55 && ((Math.floor(x) + Math.floor(y)) % 3 !== 0); } });
      B.ell(cx - 1, cy - 3.5, fw + 1, fh, hl, { test: (x, y, dx, dy) => { const r = Math.hypot(dx, dy); return r > 0.65 && r < 0.71 && dy < -0.5 && dx < 0.1 && dx > -0.6; } });
      B.only = null;
    }
    // headgear
    const hc = C.headColor;
    if (head === 'helmet' || fullHelm) {
      const mR = ramp(hc, 'metal');
      B.grp('hat');
      B.ell(cx, cy - 3, fw + 2.5, fh + 0.5, mR, { test: (x, y) => fullHelm ? y < chinY + 1 : (y < fringeY + 1 || (Math.abs(x - cx) > fw - 2 && y < cy + 7)) });
      if (fullHelm) {
        B.grp('hat:visor', 'n'); B.rect(cx - fw + 2, cy - 1, (fw - 2) * 2, 3, 0x100818); B.rect(cx - 1, cy + 2, 2, 8, 0x100818);
        B.grp('horn'); const bn = ramp('#eadcc0');
        B.chain([[cx - fw, cy - 8], [cx - fw - 7, cy - 13], [cx - fw - 8, cy - 21], [cx - fw - 4, cy - 26]], [3.2, 2.6, 1.8, 0.6], bn);
        B.chain([[cx + fw, cy - 8], [cx + fw + 7, cy - 13], [cx + fw + 8, cy - 21], [cx + fw + 4, cy - 26]], [3.2, 2.6, 1.8, 0.6], bn);
      } else {
        B.grp('hat:rim'); B.rect(cx - fw - 2, fringeY - 1, fw * 2 + 4, 2, mR[1]);
        B.grp('hat:nasal'); B.rect(cx - 1, fringeY, 2, 7, mR[3]);
        B.grp('crest'); B.poly([[cx - 2, cy - fh - 2], [cx + 2, cy - fh - 2], [cx + 1, cy - fh + 6], [cx - 1, cy - fh + 6]], ramp(C.trim));
      }
    } else if (hooded) {
      const cR = ramp(hc);
      B.grp('hat');
      B.ell(cx, cy - 2, fw + 4, fh + 3, cR, { test: (x, y) => !(Math.abs(x - cx) < fw - 1 - Math.max(0, fringeY - y) * 0.3 && y > fringeY - 1 && y < chinY + 3) });
      B.poly([[cx - fw - 3, cy + 6], [cx - fw + 1, cy + 6], [cx - 3, 42], [cx - 12, 46]], cR); B.poly([[cx + fw + 3, cy + 6], [cx + fw - 1, cy + 6], [cx + 3, 42], [cx + 12, 46]], cR);
    } else if (head === 'wizardhat') {
      const cR = ramp(hc);
      B.grp('hat'); B.poly([[cx - fw - 1, fringeY + 1], [cx + fw + 1, fringeY + 1], [cx + 5, cy - 18], [cx + 12, cy - 26], [cx + 3, cy - 22], [cx - 6, cy - 16]], cR, { vg: 0.8 });
      B.grp('hat:band'); B.poly([[cx - fw - 1, fringeY + 1], [cx + fw + 1, fringeY + 1], [cx + fw - 1, fringeY - 2], [cx - fw + 1, fringeY - 2]], ramp(C.trim, 'metal'));
      B.grp('hat:brim'); B.ell(cx, fringeY + 1.5, fw + 9, 3, cR, { shift: -1 });
    } else if (head === 'hat') {
      const cR = ramp(hc);
      B.grp('hat'); B.ell(cx, fringeY - 3, fw * 0.85, 6, cR, { test: (x, y) => y < fringeY });
      B.grp('hat:band'); B.rect(cx - fw * 0.85, fringeY - 2, fw * 1.7, 2, trimR[2]);
      B.grp('hat:brim'); B.ell(cx, fringeY + 0.5, fw + 8, 2.5, cR, { shift: -1 });
    } else if (head === 'bandana') {
      B.grp('hat'); B.ell(cx, cy - 2.5, fw + 1.8, fh + 0.6, ramp(hc), { test: (x, y) => y > fringeY - 5 && y < fringeY });
      B.poly([[cx + fw, fringeY - 4], [cx + fw + 7, fringeY + 3], [cx + fw + 4, fringeY + 5], [cx + fw, fringeY]], ramp(hc));
    } else if (head === 'circlet') {
      B.grp('hat'); B.ell(cx, cy - 2.5, fw + 1.8, fh + 0.6, ramp(hc, 'metal'), { test: (x, y) => y > fringeY - 3 && y < fringeY - 1 });
      B.grp('gem'); B.ell(cx, fringeY - 2, 1.8, 2, ramp(ps.gem || '#40c0e0', 'metal'));
    }
    B.lines();
    // ---- face details
    B.only = ['skin', 'beard', 'fd']; B.grp('fd', 'n');
    const ink = 0x1a0c1c, eyeC = h2i(C.eyes), eyeD = mul(eyeC, 0.5), eyeL = lighten(eyeC, 0.45);
    const ey = Math.round(cy + 1.5), sep = body === 'dwarf' || body === 'orc' ? 7 : 6.5;
    const ew = 5, eh = age === 'young' ? 5 : age === 'old' ? 2 : 4;
    const browC = mul(h2i(body === 'birdfolk' ? C.hair : C.beard || C.hair), 0.55);
    if (body === 'skeleton') {
      [-1, 1].forEach(s2 => { const x0 = Math.round(cx + s2 * sep - 3); B.rect(x0, ey - 3, 6, 6, 0x0c0610); B.put(x0 + 3, ey - 1, eyeC); B.put(x0 + 2, ey - 1, lighten(eyeC, 0.4)); B.put(x0 + 3, ey, mul(eyeC, 0.6)); });
      B.rect(cx - 1, ey + 5, 2, 3, 0x0c0610);
      for (let i = -3; i <= 3; i++) { B.put(cx + i * 1.6, cy + 12, 0x0c0610); }
    } else if (!fullHelm) {
      [-1, 1].forEach(s2 => {
        const ex = Math.round(cx + s2 * sep - ew / 2), top = ey - Math.ceil(eh / 2);
        if (eyesClosed) {
          for (let i = -1; i <= ew; i++) B.put(ex + i, ey + ((i === -1 || i === ew) ? 0 : 1), ink);
          B.put(s2 < 0 ? ex - 2 : ex + ew + 1, ey - 1, ink);
        } else {
          for (let j = 0; j < eh; j++) for (let i = -1; i <= ew; i++) B.put(ex + i, top + j, 0xf8f4f0);
          const ix = ex + 1, iw = 3;
          for (let j = 0; j < eh; j++) for (let i = 0; i < iw; i++) B.put(ix + i, top + j, j === 0 ? mul(eyeC, 0.35) : j === 1 && eh > 2 ? eyeD : j === eh - 1 ? eyeL : eyeC);
          if (eh >= 3) { B.put(ix + 1, top + 1, 0x100810); if (eh >= 4) B.put(ix + 1, top + 2, mul(eyeC, 0.3)); }
          if (body === 'goblin' || body === 'orc') { for (let j = 0; j < eh; j++) B.put(ix + 1, top + j, 0x100808); }
          B.put(ix + (s2 < 0 ? 0 : 2), top + (eh > 2 ? 1 : 0), 0xffffff);
          if (eh >= 4) B.put(ix + (s2 < 0 ? 2 : 0), top + eh - 2, lighten(eyeC, 0.75));
          for (let i = -1; i <= ew; i++) B.put(ex + i, top - 1, ink);
          if (age !== 'old') for (let i = 0; i < ew - 1; i++) B.put(ex + i + (s2 < 0 ? 0 : 1), top - 2, ink);
          B.put(s2 < 0 ? ex - 2 : ex + ew + 1, top, ink);
          if (age === 'young' || ps.lashes) B.put(s2 < 0 ? ex - 2 : ex + ew + 1, top - 1, ink);
          for (let i = 0; i < ew; i++) B.put(ex + i, top + eh, (i === 0 || i === ew - 1) ? skinR[1] : skinR[0]);
        }
        const by = ey - Math.ceil(eh / 2) - 4 - (age === 'young' ? 1 : 0);
        const fierce = body === 'orc' || body === 'goblin' || ps.fierce;
        for (let i = -1; i <= ew; i++) { const t = s2 < 0 ? i : ew - 1 - i; B.put(ex + i, by + (fierce ? (t > 1 ? 1 : 0) : (t < 0 ? 1 : 0)), browC); }
        if (body === 'dwarf' || age === 'old' || fierce) for (let i = 0; i < ew; i++) B.put(ex + i, by - 1 + (fierce && (s2 < 0 ? i > 2 : i < 2) ? 1 : 0), browC);
        if (age === 'old') { B.put(ex + (s2 < 0 ? -1 : ew), ey + 2, skinR[0]); B.put(ex + (s2 < 0 ? 0 : ew - 1), ey + 3, skinR[0]); }
      });
      // nose
      if (body !== 'birdfolk') {
        if (body === 'orc') { B.rect(cx - 2, ey + 4, 4, 2, skinR[0]); B.put(cx - 1, ey + 5, ink); B.put(cx + 1, ey + 5, ink); }
        else if (body === 'goblin') { B.rect(cx, ey + 1, 2, 5, skinR[3]); B.put(cx + 1, ey + 5, skinR[0]); B.put(cx + 2, ey + 5, skinR[0]); }
        else { B.put(cx + 1, ey + 5, skinR[0]); B.put(cx, ey + 6, skinR[1]); B.put(cx + 1, ey + 4, skinR[1]); }
      }
      // mouth
      const my = Math.round(Math.min(chinY - 4, cy + 11));
      if (body === 'birdfolk') { B.only = ['beak']; B.line(cx - 2, cy + 7, cx + 2, cy + 7, mul(0xe0a830, 0.45)); if (mouthOpen) { B.put(cx - 1, cy + 8, 0x401018); B.put(cx, cy + 8, 0x401018); } }
      else if (mouthOpen) { B.rect(cx - 2, my - 1, 4, 3, 0x501020); B.rect(cx - 1, my + 1, 2, 1, 0xc04050); B.rect(cx - 2, my - 1, 4, 1, 0x301018); }
      else { B.rect(cx - 2, my, 4, 1, mul(skinR[0], 0.85)); if (face === 'soft' && age !== 'old') B.put(cx + 2, my - 1, mul(skinR[0], 0.85)); }
      if (body === 'orc') { B.only = null; B.grp('tusk'); B.rect(cx - 4, my - 3, 2, 3, 0xfff4d8); B.rect(cx + 2, my - 3, 2, 3, 0xfff4d8); B.put(cx - 4, my, 0xc8b898); B.put(cx + 3, my, 0xc8b898); }
      if (body === 'goblin' && !mouthOpen) { B.put(cx - 2, my + 1, 0xffffff); B.put(cx + 1, my + 1, 0xffffff); }
      // blush / cheek shade
      B.only = ['skin', 'fd'];
      if (age === 'young' && body !== 'goblin' && body !== 'orc') { B.put(cx - sep - 2, ey + 3, lighten(0xe06070, 0.3)); B.put(cx - sep - 1, ey + 3, lighten(0xe06070, 0.3)); B.put(cx + sep + 1, ey + 3, lighten(0xe06070, 0.3)); B.put(cx + sep, ey + 3, lighten(0xe06070, 0.3)); }
      if (ps.scar) { B.grp('scar', 'n'); B.line(cx + sep + 2, ey - 4, cx + sep - 1, ey + 5, mix(skinR[0], 0xa04050, 0.5)); for (let i = 0; i < 3; i++) B.put(cx + sep + 1 - i, ey - 2 + i * 3, lighten(skinR[2], 0.4)); }
      if (age === 'old') { B.put(cx - 5, cy + 8, skinR[0]); B.put(cx + 5, cy + 8, skinR[0]); B.put(cx - 4, cy + 9, skinR[0]); B.put(cx + 4, cy + 9, skinR[0]); }
    }
    if (fullHelm) { B.only = null; B.grp('glow', 'n'); B.put(cx - 5, cy, eyeC); B.put(cx - 4, cy, 0xffffff); B.put(cx + 4, cy, eyeC); B.put(cx + 3, cy, 0xffffff); }
    B.only = null;
    B.outline();
    // frame vignette (dark 1px border)
    return B;
  }
  G.drawPortrait = function (ctx, ps, x, y, t) {
    t = t || 0;
    const k = specKey(ps).replace(/"talking":(true|false),?/, '');
    const ph = hash(k) % 97;
    const blink = ((t + ph * 3) % 220) < 6;
    const talk = !!ps.talking && (Math.floor(t / 5) + (Math.floor(t / 23) % 2)) % 3 !== 0;
    const key = 'pt|' + k + '|' + (blink ? 1 : 0) + (talk ? 1 : 0);
    const cv = G.cached(key, 52, 52, (c2) => {
      const bg1 = h2i(ps.bg || '#2c3a78'), bg2 = mul(bg1, 0.4), img = c2.createImageData(52, 52), d = img.data;
      for (let yy = 0; yy < 52; yy++) for (let xx = 0; xx < 52; xx++) {
        const tt = Math.max(0, Math.min(1, yy / 51 + BAYER[((yy & 1) << 1) | (xx & 1)] * 0.1)), v = mix(bg1, bg2, tt), o = (yy * 52 + xx) * 4;
        d[o] = R_(v); d[o + 1] = G_(v); d[o + 2] = B_(v); d[o + 3] = 255;
      }
      c2.putImageData(img, 0, 0);
      c2.drawImage(portraitLayer(ps, blink, talk).toCanvas(false), 0, 0);
    });
    ctx.drawImage(cv, Math.round(x), Math.round(y));
  };

  // expose a few internals for other modules / tests
  G.spriteUtil = { ramp, Buf, h2i };
})();
