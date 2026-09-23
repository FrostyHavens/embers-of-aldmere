// ===== Tiles: terrain table, procedural neighbour-aware map tiles, battle backdrops =====
// All art here is original and generated in code (no external assets).
(function () {
  'use strict';
  const TS = G.TILE || 24;
  const TAU = Math.PI * 2;
  const INF = Infinity;

  // =====================================================================
  //  Colour + pixel-buffer helpers
  // =====================================================================
  const cl = v => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
  function rgbU(r, g, b) { return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0; }
  function U(h) {
    let n = parseInt(h.slice(1), 16);
    if (h.length === 4) return rgbU(((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17);
    return rgbU((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  function scale(c, f) { return rgbU(cl((c & 255) * f), cl(((c >>> 8) & 255) * f), cl(((c >>> 16) & 255) * f)); }
  function mix(a, b, t) {
    const r = (a & 255) + ((b & 255) - (a & 255)) * t, g = ((a >>> 8) & 255) + (((b >>> 8) & 255) - ((a >>> 8) & 255)) * t,
      bl = ((a >>> 16) & 255) + (((b >>> 16) & 255) - ((a >>> 16) & 255)) * t;
    return rgbU(cl(r), cl(g), cl(bl));
  }
  function lighten(c, t) { return mix(c, 0xffffffff, t); }

  class Buf {
    constructor(w, h) { this.w = w; this.h = h; this.img = new ImageData(w, h); this.p = new Uint32Array(this.img.data.buffer); }
    set(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.p[y * this.w + x] = c; }
    get(x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.p[y * this.w + x]; }
    fill(c) { this.p.fill(c); }
    rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); }
    hl(x0, x1, y, c) { for (let i = x0; i <= x1; i++) this.set(i, y, c); }
    vl(x, y0, y1, c) { for (let j = y0; j <= y1; j++) this.set(x, j, c); }
    dk(x, y, f) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x, c = this.p[i]; if (c >>> 24) this.p[i] = scale(c, f); }
    tint(x, y, col, t) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x, c = this.p[i]; this.p[i] = (c >>> 24) ? mix(c, col, t) : col; }
    canvas() { const c = G.makeCanvas(this.w, this.h); c.getContext('2d').putImageData(this.img, 0, 0); return c; }
  }

  // deterministic hashes
  function hsh(a, b, c) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(((b | 0) + 0x632be5ab) | 0, 0xc2b2ae35) ^ Math.imul(((c | 0) + 0x1b873593) | 0, 0x27d4eb2f);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function stamp(b, x0, y0, rows, pal, flip) {
    for (let y = 0; y < rows.length; y++) {
      const r = rows[y], w = r.length;
      for (let x = 0; x < w; x++) {
        const ch = r[flip ? w - 1 - x : x];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch]; if (c !== undefined) b.set(x0 + x, y0 + y, c);
      }
    }
  }

  // =====================================================================
  //  Palette (original, Genesis-flavoured)
  // =====================================================================
  const HEX = {
    // meadow greens
    G0: '#173a12', G1: '#23601c', G2: '#377f26', G3: '#4f9c30', G4: '#6cb83c', G5: '#98d45a', G6: '#c4ec84',
    // dense-wood greens (cooler, darker)
    J0: '#081e0e', J1: '#113416', J2: '#1c4e1e', J3: '#2b6a26', J4: '#40882e', J5: '#62a63c', J6: '#8cc452',
    // pine
    E0: '#0a2418', E1: '#143c28', E2: '#1f5634', E3: '#2e7440', E4: '#4a9450',
    // dirt
    D0: '#442812', D1: '#6c4520', D2: '#94662e', D3: '#b8884a', D4: '#d2a868', D5: '#e8c890',
    // sand
    S0: '#9c7844', S1: '#c09c5c', S2: '#d8bc7c', S3: '#e8d49c', S4: '#f6eac4',
    // cool stone
    K0: '#1a1a26', K1: '#43435a', K2: '#686878', K3: '#8e8e9a', K4: '#b4b2b4', K5: '#d8d6d0',
    // warm stone
    B0: '#3c3024', B1: '#62523e', B2: '#8a7656', B3: '#ad9a78', B4: '#cdbf9a', B5: '#e6dcbe',
    // water
    W0: '#0a1a4c', W1: '#16348c', W2: '#2250b4', W3: '#3a72d2', W4: '#68a2ea', W5: '#b4dcfa', W6: '#f0fcff',
    // wood
    T0: '#2a1606', T1: '#4c2a10', T2: '#74421e', T3: '#9c5e2a', T4: '#c0823a', T5: '#dca65c',
    // clay roof
    R0: '#3e0c0e', R1: '#761c16', R2: '#a4301e', R3: '#cc4c28', R4: '#ea7c44',
    // slate roof
    Q0: '#121a2e', Q1: '#22365c', Q2: '#325088', Q3: '#4a70ac', Q4: '#7a9ed2',
    // plaster
    P0: '#8a7a62', P1: '#b6a686', P2: '#d6caaa', P3: '#eee6ce',
    // gold / wheat
    Y0: '#6c4808', Y1: '#a47414', Y2: '#d4a42c', Y3: '#f6d85c', Y4: '#fff2a8',
    H0: '#7a5416', H1: '#a47c1e', H2: '#c89e2e', H3: '#e2be46', H4: '#f6e08a',
    // mountain rock
    M0: '#281c14', M1: '#463224', M2: '#684c32', M3: '#8a6a46', M4: '#ac8a5e', M5: '#d0b486',
    // carpet / cloth
    C0: '#3c0814', C1: '#66101e', C2: '#9c1c2c', C3: '#c8343c', C4: '#e86458',
    // flowers & misc
    F1: '#fafaf2', F2: '#f8d040', F3: '#e84860', F4: '#f094c8', F5: '#8c78f0',
    V1: '#2c5a30', V2: '#3e7a3c', // shutters
    X0: '#000000', OL: '#100c18', FIRE1: '#fff0a0', FIRE2: '#f8b030', FIRE3: '#e05818', FIRE4: '#a02010',
  };
  const P = {}; for (const k in HEX) P[k] = U(HEX[k]);
  const GRN = [P.G0, P.G1, P.G2, P.G3, P.G4, P.G5, P.G6];
  const JGR = [P.J0, P.J1, P.J2, P.J3, P.J4, P.J5, P.J6];

  // =====================================================================
  //  Terrain table (gameplay)
  // =====================================================================
  function tt(name, le, foot, mounted, flying, hover, bg, flags) {
    flags = flags || {};
    return { name, le, cost: { foot, mounted, flying, hover }, block: !!flags.block, wall: !!flags.wall, bg };
  }
  const WALL = (name, bg) => tt(name, 0, INF, INF, INF, INF, bg, { block: true, wall: true });
  const OBSTACLE = (name, bg) => tt(name, 0, INF, INF, 1, INF, bg, { block: true });
  G.TERRAIN = {
    '.': tt('Grassland', 15, 1, 1, 1, 1, 'grass'),
    'o': tt('Grassland', 15, 1, 1, 1, 1, 'grass'),
    'y': tt('Field', 15, 1.5, 2, 1, 1, 'grass'),
    ',': tt('Path', 0, 1, 1, 1, 1, 'road'),
    '=': tt('Street', 0, 1, 1, 1, 1, 'town'),
    'p': tt('Plaza', 0, 1, 1, 1, 1, 'town'),
    'f': tt('Forest', 30, 2, 3, 1, 1, 'forest'),
    'T': tt('Deep Woods', 30, INF, INF, 1, INF, 'forest', { block: true }),
    'h': tt('Hills', 30, 2, 3, 1, 2, 'hills'),
    'M': tt('Mountain', 30, INF, INF, 1, INF, 'hills', { block: true }),
    's': tt('Sand', 15, 2, 3, 1, 1, 'desert'),
    '~': tt('Shallows', 0, 3, 3, 1, 1, 'river'),
    'w': tt('Water', 0, INF, INF, 1, 1, 'river', { block: true }),
    'b': tt('Bridge', 0, 1, 1, 1, 1, 'bridge'),
    'B': tt('Bridge', 0, 1, 1, 1, 1, 'bridge'),
    'r': OBSTACLE('Boulder', 'grass'),
    'x': tt('Flagstones', 0, 1, 1, 1, 1, 'fort'),
    'X': WALL('Ruined Wall', 'fort'),
    'F': OBSTACLE('Fence', 'grass'),
    'R': WALL('Roof', 'town'), 'Q': WALL('Roof', 'town'), '+': WALL('Spire', 'town'),
    'W': WALL('House', 'town'), 'N': WALL('House', 'town'),
    'D': tt('Door', 0, INF, INF, INF, INF, 'town', { block: true }),
    'S': WALL('Stone Wall', 'town'), 'G': WALL('Stone Wall', 'town'),
    'K': tt('Great Door', 0, INF, INF, INF, INF, 'town', { block: true }),
    'l': OBSTACLE('Well', 'town'), 'k': OBSTACLE('Barrels', 'town'), 'g': OBSTACLE('Grave', 'grass'),
    'P': OBSTACLE('Shrub', 'grass'), 'L': OBSTACLE('Lamp Post', 'town'), 'Y': OBSTACLE('Stall', 'town'),
    'Z': OBSTACLE('Statue', 'town'),
    'i': tt('Floor', 0, 1, 1, 1, 1, 'indoor'),
    'I': WALL('Wall', 'indoor'),
    'q': tt('Carpet', 0, 1, 1, 1, 1, 'indoor'),
    't': OBSTACLE('Table', 'indoor'), 'e': OBSTACLE('Counter', 'indoor'), 'a': OBSTACLE('Altar', 'indoor'),
    'u': OBSTACLE('Pew', 'indoor'), 'j': OBSTACLE('Bed', 'indoor'),
    'v': WALL('Hearth', 'indoor'), 'n': WALL('Bookshelf', 'indoor'),
    'c': tt('Stone Floor', 0, 1, 1, 1, 1, 'indoor'),
    ' ': WALL('Void', 'grass'),
  };

  // =====================================================================
  //  Neighbour classification
  // =====================================================================
  // n[] order: N NE E SE S SW W NW
  const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1];
  const BASEMAP = { '.': '.', 'o': '.', 'y': '.', 'f': '.', 'h': '.', ',': ',', '=': '=', 'p': 'p', 's': 's', 'x': 'x', 'i': 'i', 'c': 'c' };
  const OBJ = new Set('rFlkgPLYZteauj'.split(''));
  const INDOOR_OBJ = new Set('teauj'.split(''));
  const BASE_PREF = ['=', 'p', 'x', 'c', 'i', ',', 's', '.'];
  const WATERISH = c => c === 'w' || c === '~' || c === 'b' || c === 'B';
  const ROOF = c => c === 'R' || c === 'Q' || c === '+';
  const BWALL = c => c === 'W' || c === 'N' || c === 'D' || c === 'S' || c === 'G' || c === 'K';
  const IWALL = c => c === 'I' || c === 'n' || c === 'v';
  const TALL = new Set('WNDSGKRQ+XIvnT'.split(''));
  const GRASSY = c => c === '.' || c === 'T' || c === 'M';

  function inferBase(map, x, y, code) {
    const cnt = {};
    for (let k = 0; k < 8; k += 2) { const b = BASEMAP[map.get(x + DX[k], y + DY[k])]; if (b) cnt[b] = (cnt[b] || 0) + 1; }
    let best = null, bn = 0;
    for (const b of BASE_PREF) if ((cnt[b] || 0) > bn) { bn = cnt[b]; best = b; }
    if (best) return best;
    return INDOOR_OBJ.has(code) ? 'i' : '.';
  }
  function groundOf(map, x, y) {
    const c = map.get(x, y);
    const b = BASEMAP[c]; if (b) return b;
    if (OBJ.has(c)) return inferBase(map, x, y, c);
    return c;
  }

  // distance (px) from pixel centre to the nearest "open" neighbour region; m = 8-bit mask
  let lastDir = -1;
  function edgeDist(x, y, m, R) {
    const px = x + 0.5, py = y + 0.5; let d = 99, k = -1, t;
    if (m & 1 && py < d) { d = py; k = 0; }
    if (m & 4 && (t = TS - px) < d) { d = t; k = 2; }
    if (m & 16 && (t = TS - py) < d) { d = t; k = 4; }
    if (m & 64 && px < d) { d = px; k = 6; }
    if (m & 2 && (t = Math.hypot(TS - px, py)) < d) { d = t; k = 1; }
    if (m & 8 && (t = Math.hypot(TS - px, TS - py)) < d) { d = t; k = 3; }
    if (m & 32 && (t = Math.hypot(px, TS - py)) < d) { d = t; k = 5; }
    if (m & 128 && (t = Math.hypot(px, py)) < d) { d = t; k = 7; }
    if (R) {
      const Q = TS - R;
      if ((m & 65) === 65 && px < R && py < R && (t = R - Math.hypot(R - px, R - py)) < d) { d = t; k = py < px ? 0 : 6; }
      if ((m & 5) === 5 && px > Q && py < R && (t = R - Math.hypot(px - Q, R - py)) < d) { d = t; k = py < TS - px ? 0 : 2; }
      if ((m & 20) === 20 && px > Q && py > Q && (t = R - Math.hypot(px - Q, py - Q)) < d) { d = t; k = py > px ? 4 : 2; }
      if ((m & 80) === 80 && px < R && py > Q && (t = R - Math.hypot(R - px, py - Q)) < d) { d = t; k = TS - py < px ? 4 : 6; }
    }
    lastDir = k; return d;
  }
  function maskOf(arr, pred) { let m = 0; for (let k = 0; k < 8; k++) if (pred(arr[k])) m |= 1 << k; return m; }

  // =====================================================================
  //  Ground layers
  // =====================================================================
  function grassTex(b, v) {
    b.fill(P.G3);
    const s = v * 31 + 7;
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const r = hsh(x, y, s);
      if (r < 0.035) b.set(x, y, P.G2);
      else if (r < 0.06) b.set(x, y, P.G4);
    }
    const nt = 2 + (v % 3);
    for (let i = 0; i < nt; i++) {
      const x = 1 + Math.floor(hsh(i, v, 3) * 18), y = 1 + Math.floor(hsh(v, i, 5) * 19);
      if (hsh(i, v, 11) < 0.5) {
        // short blade tuft
        b.set(x + 1, y, P.G5); b.set(x + 3, y, P.G5);
        b.set(x, y + 1, P.G4); b.set(x + 1, y + 1, P.G4); b.set(x + 3, y + 1, P.G4); b.set(x + 4, y + 1, P.G4);
        b.set(x + 1, y + 2, P.G2); b.set(x + 2, y + 2, P.G2); b.set(x + 3, y + 2, P.G2);
      } else {
        // dark "w" stroke
        b.set(x, y, P.G2); b.set(x + 2, y, P.G2); b.set(x + 4, y, P.G2);
        b.set(x + 1, y + 1, P.G2); b.set(x + 3, y + 1, P.G2);
        b.set(x + 1, y, P.G4); b.set(x + 3, y, P.G4);
      }
    }
  }
  function flowerTex(b, v, af) {
    grassTex(b, v);
    const cols = [P.F1, P.F2, P.F3, P.F4, P.F1, P.F5];
    const nf = 4 + (v % 3);
    for (let i = 0; i < nf; i++) {
      let x = 2 + Math.floor(hsh(i, v, 21) * 19), y = 2 + Math.floor(hsh(v, i, 23) * 18);
      if (((af + i) & 1) && (i % 3 === 0)) x += 1;
      const c = cols[Math.floor(hsh(i, v, 25) * cols.length)];
      b.set(x, y + 2, P.G1); b.set(x + 1, y + 2, P.G2);
      b.set(x, y - 1, c); b.set(x - 1, y, c); b.set(x + 1, y, c); b.set(x, y + 1, c);
      b.set(x, y, c === P.F2 ? P.Y1 : P.F2);
      b.set(x + 1, y + 1, P.G2);
    }
  }
  function dirtTex(b, v) {
    b.fill(P.D3);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const r = hsh(x, y, v + 101);
      if (r < 0.07) b.set(x, y, P.D2); else if (r < 0.11) b.set(x, y, P.D4);
    }
    for (let i = 0; i < 4; i++) {
      const x = 2 + Math.floor(hsh(i, v, 41) * 19), y = 2 + Math.floor(hsh(v, i, 43) * 19);
      b.set(x, y, P.D5); b.set(x + 1, y, P.D4); b.set(x, y + 1, P.D1); b.set(x + 1, y + 1, P.D2);
    }
    // faint wheel ruts pattern
    for (let x = 0; x < TS; x++) { if (hsh(x, 1, v) < 0.5) b.set(x, 8, P.D2); if (hsh(x, 2, v) < 0.5) b.set(x, 16, P.D2); }
  }
  function sandTex(b, v) {
    b.fill(P.S2);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const w = Math.round(Math.sin((x / 12) * TAU) * 1.2);
      const ry = (y + w + 48) % 6;
      if (ry === 0) b.set(x, y, P.S3);
      else if (ry === 1 && ((x + y) & 1)) b.set(x, y, P.S1);
      const r = hsh(x, y, v + 131);
      if (r < 0.03) b.set(x, y, P.S1); else if (r < 0.05) b.set(x, y, P.S4);
    }
    if (v % 3 === 0) { const x = 5 + v, y = 14; b.set(x, y, P.B3); b.set(x + 1, y, P.B4); b.set(x, y + 1, P.B1); b.set(x + 1, y + 1, P.B2); }
  }
  function cobbleTex(b, v) {
    for (let y = 0; y < TS; y++) {
      const row = (y / 6) | 0, ly = y % 6, off = (row & 1) ? 4 : 0;
      for (let x = 0; x < TS; x++) {
        const xx = (x + off) % TS, col = (xx / 8) | 0, lx = xx % 8;
        const rv = hsh(col, row, v + 7);
        let base = rv < 0.33 ? P.K3 : rv < 0.66 ? mix(P.K3, P.B3, 0.5) : P.B3;
        let c = base;
        if (ly === 5 || lx === 7) c = P.K1;
        else if ((ly === 0 && (lx === 0 || lx === 6)) || (ly === 4 && (lx === 0 || lx === 6))) c = P.K2;
        else if (ly === 0 || lx === 0) c = lighten(base, 0.28);
        else if (ly === 4 || lx === 6) c = scale(base, 0.78);
        b.set(x, y, c);
      }
    }
  }
  function plazaTex(b, v) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const sx = (x / 12) | 0, sy = (y / 12) | 0, lx = x % 12, ly = y % 12;
      const base = ((sx + sy) & 1) ? P.B4 : mix(P.B4, P.B3, 0.45);
      let c = base;
      if (lx === 11 || ly === 11) c = P.B1;
      else if (lx === 0 || ly === 0) c = lighten(base, 0.3);
      else if (lx === 10 || ly === 10) c = scale(base, 0.82);
      else { const r = hsh(x, y, v + 61); if (r < 0.06) c = scale(base, 0.9); else if (r < 0.09) c = lighten(base, 0.2); }
      b.set(x, y, c);
    }
  }
  const FLAG_ROWS = [[0, 10], [0, 14], [0, 8, 16], [0, 12, 18], [0, 6, 15]];
  function flagTex(b, v, mossy) {
    for (let r = 0; r < 3; r++) {
      const y0 = r * 8, cuts = FLAG_ROWS[Math.floor(hsh(r, v, 5) * FLAG_ROWS.length)];
      for (let s = 0; s < cuts.length; s++) {
        const x0 = cuts[s], x1 = (s + 1 < cuts.length ? cuts[s + 1] : TS) - 1;
        const rv = hsh(s, r, v + 17);
        const base = rv < 0.4 ? P.B3 : rv < 0.75 ? mix(P.B3, P.K3, 0.5) : mix(P.B3, P.B2, 0.5);
        for (let y = y0; y < y0 + 8; y++) for (let x = x0; x <= x1; x++) {
          let c = base;
          if (y === y0 + 7 || x === x1) c = P.B1;
          else if (y === y0 || x === x0) c = lighten(base, 0.18);
          else if (y === y0 + 6 || x === x1 - 1) c = scale(base, 0.84);
          else if (hsh(x, y, v + 3) < 0.04) c = scale(base, 0.9);
          b.set(x, y, c);
        }
        if (rv > 0.85) { // crack
          let cx = x0 + 2, cy = y0 + 2; for (let i = 0; i < 4; i++) { b.set(cx, cy, P.B1); cx++; cy += (i & 1); }
        }
      }
    }
    if (mossy) for (let i = 0; i < 3; i++) {
      if (hsh(i, v, 78) < 0.4) continue;
      const x = 1 + Math.floor(hsh(i, v, 77) * 21), y = [7, 15, 23][i % 3];
      b.set(x, y, P.G2); b.set(x + 1, y, P.G3); b.set(x + 1, y - 1, P.G4); b.set(x + 2, y, P.G2);
    }
  }
  function plankTex(b, v) {
    for (let y = 0; y < TS; y++) {
      const row = (y / 6) | 0, ly = y % 6, seam = (row * 9 + v * 5 + 3) % TS;
      for (let x = 0; x < TS; x++) {
        const tone = hsh(row, x > seam ? 1 : 0, v) < 0.5 ? P.T3 : mix(P.T3, P.T4, 0.35);
        let c = tone;
        if (ly === 5) c = P.T1;
        else if (x === seam) c = P.T1;
        else if (ly === 0) c = lighten(tone, 0.18);
        else if (ly === 4) c = scale(tone, 0.85);
        else if (hsh(x >> 2, y, v + 9) < 0.18) c = scale(tone, 0.88);
        b.set(x, y, c);
      }
    }
  }
  function stoneFloorTex(b, v) {
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const sx = (x / 12) | 0, sy = (y / 12) | 0, lx = x % 12, ly = y % 12;
      const base = ((sx + sy) & 1) ? P.B3 : P.B2;
      let c = base;
      if (lx === 11 || ly === 11) c = P.B0;
      else if (lx === 0 || ly === 0) c = lighten(base, 0.2);
      else if (lx === 10 || ly === 10) c = scale(base, 0.82);
      else if (hsh(x, y, v) < 0.05) c = scale(base, 0.9);
      b.set(x, y, c);
    }
  }
  function carpetTex(b, n) {
    const isC = c => c === 'q';
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      let c = P.C2;
      const dx = Math.abs(((x + 6) % 12) - 6), dy = Math.abs(((y + 6) % 12) - 6);
      if (dx + dy === 4) c = P.C3; else if (dx + dy === 1) c = P.Y2; else if ((x + y) % 2 === 0 && dx + dy > 5) c = mix(P.C2, P.C1, 0.3);
      b.set(x, y, c);
    }
    const band = (x, y, i) => { const cs = [P.C0, P.Y2, P.Y3, P.C1]; b.set(x, y, cs[i]); };
    for (let i = 0; i < 4; i++) for (let j = 0; j < TS; j++) {
      if (!isC(n[6])) band(i, j, i);
      if (!isC(n[2])) band(TS - 1 - i, j, i);
      if (!isC(n[0])) band(j, i, i);
      if (!isC(n[4])) band(j, TS - 1 - i, i);
    }
  }
  // grass creeping over hard ground where it borders grassy tiles
  function grassFringe(b, g, v, pred) {
    const m = maskOf(g, pred || GRASSY); if (!m) return;
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const d = edgeDist(x, y, m, 6);
      if (d > 6) continue;
      const jag = hsh(x >> 1, y >> 1, v + 9) * 1.5 + (((x + y) & 1) ? 0.3 : 0);
      const t = 2.0 + jag;
      if (d < t) {
        const r = hsh(x, y, v + 5);
        b.set(x, y, r < 0.12 ? P.G4 : r < 0.2 ? P.G2 : P.G3);
      } else if (d < t + 1.1) b.dk(x, y, 0.74);
    }
  }
  function applyShadow(b, sh) {
    if (!sh) return;
    for (let y = 0; y < 4; y++) for (let x = 0; x < TS; x++) {
      let s = false;
      if (sh & 1) s = y < 2 || (y === 2 && ((x + y) & 1));
      if (!s && (sh & 2)) s = x < 2 || (x === 2 && ((x + y) & 1));
      if (!s && (sh & 4) && !(sh & 3)) s = x + y < 3;
      if (s) b.dk(x, y, 0.7);
    }
    if (sh & 2) for (let y = 4; y < TS; y++) for (let x = 0; x < 3; x++) if (x < 2 || ((x + y) & 1)) b.dk(x, y, 0.7);
  }
  function drawGround(b, code, I) {
    switch (code) {
      case ',': dirtTex(b, I.v); grassFringe(b, I.g, I.v); break;
      case 's': sandTex(b, I.v); grassFringe(b, I.g, I.v); break;
      case '=': cobbleTex(b, I.v); grassFringe(b, I.g, I.v); break;
      case 'p': plazaTex(b, I.v); grassFringe(b, I.g, I.v); break;
      case 'x': flagTex(b, I.v, true); grassFringe(b, I.g, I.v); break;
      case 'i': plankTex(b, I.v); break;
      case 'c': stoneFloorTex(b, I.v); break;
      case 'q': carpetTex(b, I.n); break;
      default: grassTex(b, I.v);
    }
    applyShadow(b, I.sh);
  }
  // soft drop shadow ellipse on ground
  function dropShadow(b, cx, cy, rx, ry, f) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const q = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (q < 0.65 || (q < 1 && ((x + y) & 1))) b.dk(x, y, f || 0.66);
    }
  }

  // =====================================================================
  //  Nature tiles
  // =====================================================================
  function wheatTile(b, I) {
    const sway = I.af & 1;
    for (let y = 0; y < TS; y++) {
      const row = (y / 6) | 0, ly = y % 6;
      for (let x = 0; x < TS; x++) {
        let c;
        const head = (x + row * 2 + sway) % 3 === 0;
        if (ly === 0) c = head ? P.H4 : P.H3;
        else if (ly === 1) c = head ? P.H3 : ((x & 1) ? P.H2 : P.H3);
        else if (ly === 2) c = (x & 1) ? P.H2 : P.H3;
        else if (ly === 3) c = (x & 1) ? P.H1 : P.H2;
        else if (ly === 4) c = (x & 1) ? P.H1 : P.H0;
        else c = ((x + row) & 1) ? P.H0 : P.D1;
        b.set(x, y, c);
      }
    }
    // border: grass creeping in at field edges
    const m = maskOf(I.n, c => c !== 'y');
    if (m) for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const d = edgeDist(x, y, m, 5);
      const jag = hsh(x >> 1, y >> 1, I.v) * 1.2;
      if (d < 1.5 + jag) b.set(x, y, hsh(x, y, 3) < 0.2 ? P.G4 : P.G3);
      else if (d < 2.6 + jag) b.set(x, y, P.D1);
    }
    applyShadow(b, I.sh);
  }

  // round broadleaf tree (inside a tile)
  function broadTree(b, cx, cy, r, v, pal) {
    pal = pal || GRN;
    dropShadow(b, cx + 2, cy + r + 1, r + 0.5, 2.2, 0.6);
    // trunk
    b.rect(cx - 1, cy + r - 2, 2, 4, P.T2); b.vl(cx, cy + r - 2, cy + r + 1, P.T1);
    b.set(cx - 2, cy + r + 1, P.T1); b.set(cx + 1, cy + r + 1, P.T0);
    for (let y = Math.floor(cy - r - 1); y <= cy + r; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy * 1.08);
      const wob = (hsh(x >> 1, y >> 1, v) - 0.5) * 1.4;
      if (d > r + wob * 0.5) continue;
      let l = -(dx * 0.62 + dy * 0.78) / r + (hsh((x + 1) >> 1, y >> 1, v + 3) - 0.5) * 0.45;
      let i = l > 0.55 ? 5 : l > 0.2 ? 4 : l > -0.15 ? 3 : l > -0.5 ? 2 : 1;
      if (d > r - 1.1 && dx + dy > -1) i = 0;
      b.set(x, y, pal[i]);
    }
  }
  function pineTree(b, cx, cy, h) {
    dropShadow(b, cx + 2, cy + h / 2 + 1, 4.5, 2, 0.6);
    b.rect(cx - 1, cy + h / 2 - 2, 2, 3, P.T1);
    const top = cy - h / 2;
    for (let y = Math.floor(top); y < cy + h / 2 - 1; y++) {
      const t = (y - top) / h;
      const tier = (t * 3) % 1;
      const w = 1 + t * 5.5 * (0.55 + tier * 0.6);
      for (let x = Math.floor(cx - w); x <= cx + w; x++) {
        const dx = x + 0.5 - cx;
        let c = dx < -w * 0.3 ? P.E4 : dx < w * 0.3 ? P.E3 : P.E2;
        if (tier > 0.8 || Math.abs(dx) > w - 1) c = dx < 0 ? P.E2 : P.E1;
        if (Math.abs(dx) > w - 0.8 && dx > 0) c = P.E0;
        b.set(x, y, c);
      }
    }
    b.set(cx, Math.floor(top), P.E4);
  }
  const FOREST_LAYOUT = [
    [['b', 7, 7, 6], ['b', 17, 14, 6]],
    [['b', 16, 6, 5.5], ['b', 7, 14, 6.5]],
    [['p', 7, 11, 17], ['b', 17, 12, 6]],
    [['p', 7, 9, 14], ['p', 17, 12, 16]],
  ];
  function forestTile(b, I) {
    grassTex(b, I.v); applyShadow(b, I.sh);
    const lay = FOREST_LAYOUT[I.v % 4], flip = I.v >= 4;
    const items = lay.map(t => [t[0], flip ? TS - t[1] : t[1], t[2], t[3]]).sort((a, c) => a[2] - c[2]);
    for (const t of items) {
      if (t[0] === 'b') broadTree(b, t[1], t[2], t[3], I.v * 3 + t[1]);
      else pineTree(b, t[1], t[2], t[3]);
    }
  }

  // dense tree wall with neighbour-aware canopy clumps
  const CLUMP = [[6, 6], [18, 6], [6, 18], [18, 18]];
  function denseTile(b, I) {
    const n = I.n, isT = c => c === 'T';
    grassTex(b, I.v); applyShadow(b, I.sh);
    const openN = !isT(n[0]), openS = !isT(n[4]), openW = !isT(n[6]), openE = !isT(n[2]);
    const cl = [];
    CLUMP.forEach((p, i) => {
      let x = p[0], y = p[1], r = 8.4;
      const tN = y < 12 && openN, tS = y > 12 && openS, tW = x < 12 && openW, tE = x > 12 && openE;
      if (tN || tW || tE) r = 7;
      if (tN) y = 7.5;
      if (tS) { y = 12.5; r = 7; }
      if (tW) x = 7.5;
      if (tE) x = 16.5;
      x += (hsh(i, I.v, 1) - 0.5) * 1.2;
      cl.push({ x, y, r, i, s: tS });
    });
    for (let k = 0; k < 8; k++) if (isT(n[k])) CLUMP.forEach((p, i) => {
      const x = p[0] + DX[k] * TS, y = p[1] + DY[k] * TS;
      if (Math.abs(x - 12) < 26 && Math.abs(y - 12) < 26) cl.push({ x, y, r: 8.4, i: i + 10 + k * 4 });
    });
    const om = maskOf(n, c => !isT(c));
    // shade + trunks along the southern fringe
    if (openS) {
      for (let y = 12; y < TS; y++) for (let x = 0; x < TS; x++) if (y > 16 || ((x + y) & 1)) b.dk(x, y, y > 20 ? 0.78 : 0.62);
      for (const c of cl) if (c.s) {
        const tx = Math.round(c.x);
        b.rect(tx - 1, 17, 3, 5, P.T2); b.vl(tx + 1, 17, 21, P.T1); b.vl(tx - 1, 17, 20, P.T3);
        b.set(tx - 2, 21, P.T1); b.set(tx + 2, 21, P.T0); b.hl(tx - 1, tx + 3, 22, P.J1);
      }
    }
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const px = x + 0.5, py = y + 0.5;
      let best = null, bs = -1e9, bd = 0;
      for (const c of cl) {
        const d = Math.hypot(px - c.x, (py - c.y) * 1.05);
        if (d <= c.r) { const s = c.y * 10 - d; if (s > bs) { bs = s; best = c; bd = d; } }
      }
      if (best) {
        const dx = px - best.x, dy = py - best.y;
        // sub-clusters of leaves give a bumpy canopy surface
        const sx = Math.floor((x + 40) / 4), sy = Math.floor((y + 40) / 4);
        const lx = ((x + 40) % 4) - 1.5, ly = ((y + 40) % 4) - 1.5;
        let l = -(dx * 0.6 + dy * 0.8) / best.r - (lx + ly) * 0.06 + (hsh(sx, sy, best.i + I.v) - 0.5) * 0.25;
        let i = l > 0.62 ? 5 : l > 0.3 ? 4 : l > -0.02 ? 3 : l > -0.38 ? 2 : 1;
        if (bd > best.r - 1.3 && dx + dy > 1.5) i = Math.min(i, 1);
        if (bd > best.r - 0.7 && dy > 1) i = 0;
        b.set(x, y, JGR[i]);
      } else if (edgeDist(x, y, om, 0) > 4) {
        b.set(x, y, ((x + y) & 1) ? JGR[0] : JGR[1]);
      }
    }
  }

  const HLP = ['#2c3a14', '#485a22', '#667a30', '#86983e', '#a6b454', '#c8d07c'].map(U);
  function hillsTile(b, I) {
    grassTex(b, I.v); applyShadow(b, I.sh);
    const L = [[[12, 11, 11.5, 8]], [[9, 8, 10, 6.5], [15, 15, 11, 7.5]], [[12, 12, 12, 8.5]], [[13, 10, 11, 7.5]]][I.v % 4];
    const flip = I.v >= 4;
    for (let [cx, cy, rx, ry] of L) {
      if (flip) cx = TS - cx;
      dropShadow(b, cx + 3, cy + ry * 0.55, rx + 0.5, ry * 0.55, 0.72);
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, q = nx * nx + ny * ny;
        if (q > 1) continue;
        // flattened top: shift highlight toward upper-left
        const tq = (nx + 0.12) ** 2 + ((ny + 0.3) * 1.25) ** 2;
        let i;
        if (tq < 0.3) i = (nx + ny < -0.35) ? 5 : 4;
        else if (ny < 0.1) i = nx < 0.25 ? 3 : 2;
        else i = nx < -0.35 ? 2 : 1;
        if (hsh(x, y, I.v + 2) < 0.08) i = Math.max(0, i - 1);
        if (q > 0.84 && ny > 0) i = 0;
        b.set(x, y, HLP[i]);
        // earth showing through on the steep face
        if (ny > 0.35 && q < 0.84 && q > 0.45 && hsh(x, y, I.v + 9) < 0.18) b.set(x, y, P.D1);
      }
      // tufts on the crest
      const tx = Math.round(cx - rx * 0.3), ty = Math.round(cy - ry * 0.45);
      b.set(tx, ty, HLP[5]); b.set(tx + 2, ty, HLP[5]); b.set(tx + 1, ty + 1, HLP[2]); b.set(tx - 1, ty + 1, HLP[2]); b.set(tx + 3, ty + 1, HLP[2]);
    }
  }

  // mountain massif: one big peak per tile plus peaks shared at tile corners (staggered lattice)
  function mountainTile(b, I) {
    const n = I.n, isM = c => c === 'M';
    grassTex(b, I.v); applyShadow(b, I.sh);
    const openN = !isM(n[0]), openS = !isM(n[4]), openW = !isM(n[6]), openE = !isM(n[2]);
    const pk = [];
    const X0 = I.tx, Y0 = I.ty;
    const jit = (X, Y, kind) => ({ jx: (hsh(X, Y, 91 + kind) - 0.5) * 3, jy: (hsh(X, Y, 94 + kind) - 0.5) * 3, jr: (hsh(X, Y, 97 + kind) - 0.5) * 3 });
    // own main peak
    {
      const j = jit(X0, Y0, 0);
      let x = 12 + j.jx, y = 9 + j.jy, R = 13 + j.jr, sS = 0.62;
      if (openW && openE) { x = 12; R = 10.5; } else if (openW) { x = 13; R = 11.5; } else if (openE) { x = 11; R = 11.5; }
      if (openN) { y = 11; R = Math.min(R, 11); }
      if (openS) { sS = 1.45; y = Math.min(y, 10); }
      pk.push({ x, y, R, sS, i: 0 });
    }
    // corner peaks (shared with the W/E neighbour; identified by the tile on their east side)
    for (const cx of [0, 24]) {
      if (cx === 0 && openW) continue; if (cx === 24 && openE) continue;
      const j = jit(X0 + (cx ? 1 : 0), Y0, 1);
      let x = cx + j.jx * 0.6, y = 21 + j.jy, R = 13 + j.jr, sS = 0.62;
      if (openS) { y = 15; R = 10; sS = 1.5; }
      pk.push({ x, y, R, sS, i: cx ? 2 : 1 });
    }
    for (let k = 0; k < 8; k++) if (isM(n[k])) {
      const X = X0 + DX[k], Y = Y0 + DY[k], ox = DX[k] * TS, oy = DY[k] * TS;
      const j = jit(X, Y, 0);
      pk.push({ x: 12 + j.jx + ox, y: 9 + j.jy + oy, R: 13 + j.jr, sS: 0.62, i: 3 + k * 3 });
      for (const cx of [0, 24]) { const jj = jit(X + (cx ? 1 : 0), Y, 1); pk.push({ x: cx + jj.jx * 0.6 + ox, y: 21 + jj.jy + oy, R: 13 + jj.jr, sS: 0.62, i: 4 + k * 3 + (cx ? 1 : 0) }); }
    }
    const om = maskOf(n, c => !isM(c));
    const MR = [P.M0, P.M1, P.M2, P.M3, P.M4, P.M5];
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const px = x + 0.5, py = y + 0.5;
      let best = null, bs = -1e9, bh = 0, near = false;
      for (const c of pk) {
        const dx = px - c.x, dy = py - c.y;
        const h = c.R - (Math.abs(dx) + (dy < 0 ? -dy * 1.15 : dy * c.sS));
        if (h > 0) { const s = c.y * 10 + h * 0.01; if (s > bs) { bs = s; best = c; bh = h; } }
        else if (h > -2.2 && dy > -1) near = true;
      }
      if (best) {
        const dx = px - best.x, dy = py - best.y;
        const w = Math.max(1, best.R - (dy < 0 ? -dy * 1.15 : dy * best.sS));
        const t = Math.abs(dx) / w;
        let i = dx < 0 ? (t < 0.28 ? 5 : t < 0.62 ? 4 : 3) : (t < 0.3 ? 1 : 2);
        if (dy > best.R * 0.45 && dx < 0 && i > 3) i--;
        const r = hsh(x, y, I.v + best.i);
        const gl = ((dx < 0 ? x * 2 + y : y - x * 2) + 96 + best.i * 5) % 7;
        if (gl === 0 && r < 0.8) i = Math.max(1, i - 1);
        else if (gl === 1 && dx < 0 && r < 0.4) i = Math.min(5, i + 1);
        else if (r < 0.04) i = Math.max(1, i - 1);
        if (bh < 1.3 && dy > 0) i = 0;
        b.set(x, y, MR[i]);
      } else if (edgeDist(x, y, om, 0) > 5) {
        b.set(x, y, ((x + y) & 1) ? P.M1 : P.M0);
      } else if (near) b.dk(x, y, 0.7);
    }
  }

  function boulderTile(b, I) {
    drawGround(b, I.base, I);
    dropShadow(b, 14, 18, 9, 3.5, 0.6);
    const cx = 12, cy = 12.5;
    for (let y = 3; y < 21; y++) for (let x = 2; x < 22; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const ang = Math.atan2(dy, dx);
      const rr = 8.6 + Math.sin(ang * 3 + I.v) * 0.9 + Math.sin(ang * 5 + 1) * 0.5;
      const d = Math.hypot(dx, dy * 1.12);
      if (d > rr) continue;
      let l = -(dx * 0.6 + dy * 0.8) / rr + (hsh(x >> 1, y >> 1, I.v) - 0.5) * 0.3;
      let c = l > 0.5 ? P.K5 : l > 0.15 ? P.K4 : l > -0.25 ? P.K3 : l > -0.6 ? P.K2 : P.K1;
      if (d > rr - 1 && dx + dy > 0) c = P.K0;
      b.set(x, y, c);
    }
    b.set(10, 9, P.K2); b.set(11, 10, P.K2); b.set(12, 10, P.K2); b.set(13, 11, P.K1);
    b.set(7, 15, P.G2); b.set(8, 15, P.G3); b.set(8, 16, P.G2);
  }

  // =====================================================================
  //  Water, ford, bridges
  // =====================================================================
  function landPal(gc) {
    if (gc === 's') return [P.S2, P.S3, P.S0, P.S1];
    if (gc === ',') return [P.D3, P.D4, P.D1, P.D0];
    if (gc === '=' || gc === 'p' || gc === 'x' || gc === 'X' || gc === 'S' || gc === 'G' || gc === 'c') return [P.K3, P.K4, P.K1, P.K0];
    return [P.G3, P.G4, P.D1, P.D0];
  }
  function waterTile(b, I, shallow) {
    const { n, g, v, af } = I;
    const sw = [0, 1, 2, 1][af & 3];
    const FB = mix(P.W3, P.S2, 0.22), FL = mix(P.W4, P.S3, 0.2), FD = mix(P.W3, P.W2, 0.5);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const a = Math.sin(TAU * (x * 2 + y) / TS + af * TAU / 4), c2 = Math.sin(TAU * (y * 3 - x) / TS);
      const s = a + c2;
      let c;
      if (shallow) {
        c = s > 1.55 ? FL : s < -1.2 ? FD : FB;
        const r = hsh(x >> 1, y >> 1, v + 3);
        if (r < 0.12) c = mix(c, P.S1, 0.35);           // sandy bottom showing through
        else if (r > 0.94) c = mix(c, P.K3, 0.4);       // pebbles
      } else c = s > 1.5 ? P.W3 : s < -1.25 ? P.W1 : P.W2;
      b.set(x, y, c);
    }
    // ripple dashes
    for (let i = 0; i < 3; i++) {
      const x = 2 + Math.floor(hsh(i, v, 51) * 16) + sw, y = 3 + Math.floor(hsh(v, i, 53) * 18);
      if (shallow) { b.set(x, y, P.W5); b.set(x + 1, y, P.W6); b.set(x + 2, y, P.W5); b.set(x + 3, y, FL); b.set(x, y + 1, FD); b.set(x + 1, y + 1, FD); continue; }
      b.set(x, y, P.W4); b.set(x + 1, y, P.W5); b.set(x + 2, y, P.W4);
      b.set(x - 1, y + 1, P.W1); b.set(x + 3, y + 1, P.W1);
    }
    if (shallow) {
      // stepping stones with a little wake
      for (let k = 0; k < 2; k++) {
        const sx = 3 + Math.floor(hsh(k, v, 61) * 15), sy = 4 + k * 10 + Math.floor(hsh(v, k, 63) * 5);
        b.rect(sx, sy, 4, 2, P.K3); b.hl(sx + 1, sx + 2, sy - 1, P.K4); b.set(sx, sy, P.K4); b.hl(sx, sx + 3, sy + 2, P.K1);
        b.set(sx - 1, sy + 1, P.W6); b.set(sx - 2, sy + 2, P.W5); b.set(sx + 4, sy + 2, ((af & 1) ? P.W5 : P.W6)); b.set(sx + 5, sy + 2, P.W5);
      }
      // blend to deep neighbours
      const dm = maskOf(n, c => c === 'w' || c === 'b' || c === 'B');
      if (dm) for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const d = edgeDist(x, y, dm, 0);
        if (d < 2 || (d < 4 && ((x + y) & 1)) || (d < 6 && ((x & 1) && (y & 1)))) b.set(x, y, mix(b.get(x, y), P.W2, 0.75));
      }
    }
    // shoreline
    const m = maskOf(n, c => !WATERISH(c) && c !== ' ');
    if (m) for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      let d = edgeDist(x, y, m, 9);
      if (d > 10) continue;
      const k = lastDir;
      // gentle, tile-periodic wobble along the bank (continuous across neighbouring tiles)
      const along = (k === 0 || k === 4) ? x : (k === 2 || k === 6) ? y : x + y;
      d += Math.sin(TAU * along / TS) * 0.7 + Math.sin(TAU * along * 2 / TS + 1.3) * 0.35;
      const lp = landPal(g[k]);
      const north = k === 0 || k === 1 || k === 7;
      const bank = north ? 2 : 1;
      const t0 = 2.4 + hsh(x >> 1, y >> 1, v + 17) * 0.6;
      if (d < t0) b.set(x, y, hsh(x, y, v) < 0.15 ? lp[1] : lp[0]);
      else if (d < t0 + bank) b.set(x, y, (north && d < t0 + 1) ? lp[2] : lp[3]);
      else if (d < t0 + bank + 1) b.set(x, y, ((x * 3 + y + af) % 5) ? P.W6 : P.W5);
      else if (d < t0 + bank + 3.5 && ((x + y) & 1)) b.set(x, y, shallow ? P.W4 : P.W3);
    }
  }
  function bridgeEW(b, I) {
    waterTile(b, I, false);
    const n = I.n, landW = !WATERISH(n[6]) && n[6] !== 'b', landE = !WATERISH(n[2]) && n[2] !== 'b';
    for (let x = 0; x < TS; x++) { b.dk(x, 20, 0.55); b.dk(x, 21, 0.62); if (x & 1) b.dk(x, 22, 0.75); }
    for (let y = 5; y < 19; y++) for (let x = 0; x < TS; x++) {
      const lx = x % 4, pl = (x / 4) | 0;
      let c = hsh(pl, 0, I.v) < 0.5 ? P.T3 : mix(P.T3, P.T4, 0.3);
      if (lx === 3) c = P.T1; else if (lx === 0) c = lighten(c, 0.18);
      if (y === 18) c = P.T1;
      if (hsh(x, y, I.v) < 0.04 && lx !== 3) c = P.T2;
      b.set(x, y, c);
    }
    // nails
    for (let x = 1; x < TS; x += 4) { b.set(x, 7, P.T1); b.set(x, 16, P.T1); }
    const rail = (y0) => {
      b.hl(0, TS - 1, y0, P.T5); b.hl(0, TS - 1, y0 + 1, P.T3); b.hl(0, TS - 1, y0 + 2, P.T1);
    };
    rail(2); rail(17);
    b.hl(0, TS - 1, 20, P.T0);
    const post = (x) => {
      b.rect(x, 1, 3, 5, P.T2); b.hl(x, x + 2, 1, P.T4); b.vl(x + 2, 2, 5, P.T1);
      b.rect(x, 16, 3, 6, P.T2); b.hl(x, x + 2, 16, P.T4); b.vl(x + 2, 17, 21, P.T1); b.hl(x, x + 2, 21, P.T0);
    };
    post(10);
    if (landW) post(0);
    if (landE) post(TS - 3);
  }
  function bridgeNS(b, I) {
    waterTile(b, I, false);
    const n = I.n, landN = !WATERISH(n[0]) && n[0] !== 'B', landS = !WATERISH(n[4]) && n[4] !== 'B';
    for (let y = 0; y < TS; y++) { b.dk(21, y, 0.55); b.dk(22, y, 0.65); if (y & 1) b.dk(23, y, 0.78); }
    for (let y = 0; y < TS; y++) for (let x = 5; x < 19; x++) {
      const ly = y % 4, pl = (y / 4) | 0;
      let c = hsh(pl, 1, I.v) < 0.5 ? P.T3 : mix(P.T3, P.T4, 0.3);
      if (ly === 3) c = P.T1; else if (ly === 0) c = lighten(c, 0.18);
      if (hsh(x, y, I.v) < 0.04 && ly !== 3) c = P.T2;
      b.set(x, y, c);
    }
    for (let y = 1; y < TS; y += 4) { b.set(7, y, P.T1); b.set(16, y, P.T1); }
    const rail = (x0) => { b.vl(x0, 0, TS - 1, P.T4); b.vl(x0 + 1, 0, TS - 1, P.T3); b.vl(x0 + 2, 0, TS - 1, P.T1); };
    rail(3); rail(18);
    b.vl(21, 0, TS - 1, P.T0);
    const post = (y) => {
      for (const x of [3, 18]) { b.rect(x, y, 3, 4, P.T2); b.hl(x, x + 2, y, P.T5); b.set(x, y + 1, P.T4); b.hl(x, x + 2, y + 3, P.T0); b.vl(x + 2, y + 1, y + 2, P.T1); }
    };
    post(10);
    if (landN) post(0);
    if (landS) post(TS - 4);
  }

  // =====================================================================
  //  Buildings
  // =====================================================================
  const RPAL = [P.R0, P.R1, P.R2, P.R3, P.R4];
  const QPAL = [P.Q0, P.Q1, P.Q2, P.Q3, P.Q4];
  function roofTile(b, I, slate) {
    const n = I.n, v = I.v, pal = slate ? QPAL : RPAL;
    const top = !ROOF(n[0]), bot = !ROOF(n[4]), lft = !ROOF(n[6]), rgt = !ROOF(n[2]);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      let c;
      if (slate) {
        const row = (y / 4) | 0, ly = y % 4, xx = x + (row & 1) * 3, lx = xx % 6, col = (xx / 6) | 0;
        const rv = hsh(col, row, v + 3);
        const base = rv < 0.2 ? mix(pal[2], pal[3], 0.4) : rv > 0.85 ? mix(pal[2], pal[1], 0.4) : pal[2];
        c = base;
        if (ly === 0) c = pal[3];
        if (ly === 3) c = pal[0];
        else if (lx === 5) c = pal[1];
        if (ly === 0 && lx === 0) c = pal[4];
      } else {
        const row = (y / 6) | 0, ly = y % 6, xx = x + (row & 1) * 3, lx = xx % 6, col = (xx / 6) | 0;
        const rv = hsh(col, row, v + 5);
        const base = rv < 0.2 ? mix(pal[2], pal[3], 0.35) : rv > 0.85 ? mix(pal[2], pal[1], 0.35) : pal[2];
        const edge = lx === 0 || lx === 5;
        if (ly === 0) c = pal[1];
        else if (ly === 1) c = edge ? pal[2] : pal[4];
        else if (ly === 2) c = edge ? base : pal[3];
        else if (ly === 3) c = base;
        else if (ly === 4) c = edge ? pal[1] : base;
        else c = edge ? pal[0] : pal[1];
        if (lx === 0 && ly >= 1 && ly <= 3) c = mix(c, pal[1], 0.5);
      }
      b.set(x, y, c);
    }
    // slope shading: slightly darker toward the eave
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if (y > 14 && ((x + y) & 1) && y % 6 !== 1) b.dk(x, y, 0.93);
    if (top) {
      b.hl(0, TS - 1, 0, pal[0]); b.hl(0, TS - 1, 1, pal[4]); b.hl(0, TS - 1, 2, pal[3]); b.hl(0, TS - 1, 3, pal[1]); b.hl(0, TS - 1, 4, pal[0]);
      for (let x = 5; x < TS; x += 6) { b.set(x, 1, pal[2]); b.set(x, 2, pal[1]); }
    }
    if (bot) {
      b.hl(0, TS - 1, TS - 4, scale(pal[1], 0.9)); b.hl(0, TS - 1, TS - 3, pal[0]);
      b.hl(0, TS - 1, TS - 2, P.T2); b.hl(0, TS - 1, TS - 1, P.T0);
      for (let x = 2; x < TS; x += 6) b.set(x, TS - 2, P.T1);
    }
    if (lft) { for (let y = 0; y < TS; y++) { b.set(0, y, pal[0]); b.set(1, y, P.T3); b.set(2, y, P.T1); b.dk(3, y, 0.8); } }
    if (rgt) { for (let y = 0; y < TS; y++) { b.set(TS - 1, y, pal[0]); b.set(TS - 2, y, P.T1); b.set(TS - 3, y, P.T2); b.dk(TS - 4, y, 0.85); } }
    if (top && lft) { b.set(0, 0, P.X0); b.set(1, 0, pal[0]); }
    if (top && rgt) b.set(TS - 1, 0, P.X0);
    // chimney
    if (top && !lft && !rgt && !slate && (v % 3 === 1)) {
      const cx = 13;
      b.rect(cx, 0, 6, 9, P.K3); b.vl(cx, 0, 8, P.K4); b.vl(cx + 5, 0, 8, P.K1); b.vl(cx + 4, 1, 8, P.K2);
      for (let y = 3; y < 9; y += 3) b.hl(cx + 1, cx + 3, y, P.K2);
      b.rect(cx - 1, 0, 8, 2, P.K4); b.hl(cx - 1, cx + 6, 1, P.K2); b.rect(cx + 1, 0, 4, 1, P.K0);
      b.hl(cx, cx + 5, 9, pal[0]);
    }
  }
  function spireTile(b, I) {
    roofTile(b, I, true);
    // small bell-cote with a golden finial
    const cx = 11;
    b.rect(cx - 3, 6, 8, 12, P.K3); b.vl(cx - 3, 6, 17, P.K4); b.vl(cx + 4, 6, 17, P.K1);
    b.rect(cx - 1, 9, 4, 6, P.K0); b.rect(cx, 10, 2, 3, P.Y2); b.set(cx, 10, P.Y3);
    b.hl(cx - 3, cx + 4, 18, P.Q0);
    for (let y = 0; y < 6; y++) { const w = y; b.hl(cx + 0 - w, cx + 1 + w, y + 1, y < 3 ? P.Q3 : P.Q2); b.set(cx + 1 + w, y + 1, P.Q1); }
    b.hl(cx - 5, cx + 6, 6, P.Q0);
    b.set(cx, 0, P.Y3); b.set(cx + 1, 0, P.Y2);
  }
  function wallCommon(b, I) {
    const n = I.n;
    const roofAbove = ROOF(n[0]);
    if (roofAbove) for (let y = 0; y < 4; y++) for (let x = 0; x < TS; x++) if (y < 2 || ((x + y) & 1) || y === 2) b.dk(x, y, y < 2 ? 0.55 : 0.72);
  }
  function timberTile(b, I, kind) {
    const n = I.n, v = I.v;
    const wallBelow = BWALL(n[4]);
    const L = !BWALL(n[6]), Rt = !BWALL(n[2]);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const r = hsh(x, y, v + 11);
      b.set(x, y, r < 0.07 ? P.P2 : r > 0.97 ? P.P1 : P.P3);
    }
    // beams
    b.hl(0, TS - 1, 0, P.T0); b.hl(0, TS - 1, 1, P.T2); b.hl(0, TS - 1, 2, P.T1);
    if (!wallBelow) {
      b.hl(0, TS - 1, 16, P.T2); b.hl(0, TS - 1, 17, P.T1);
      for (let y = 18; y < TS; y++) for (let x = 0; x < TS; x++) {
        const row = y < 21 ? 0 : 1, lx = (x + row * 4) % 8;
        let c = P.K3;
        if (y === 20 || y === 23 || lx === 7) c = P.K1; else if (y === 18 || y === 21) c = P.K4; else if (lx === 6) c = P.K2;
        b.set(x, y, c);
      }
    }
    const post = (x) => { b.vl(x, 0, 17, P.T2); b.vl(x + 1, 0, 17, P.T1); };
    if (L) { b.vl(0, 0, TS - 1, P.OL); post(1); }
    if (Rt) { post(TS - 3); b.vl(TS - 1, 0, TS - 1, P.OL); }
    if (kind === 'W') {
      // braces and middle post
      if (v % 2 === 0) {
        post(11);
        for (let i = 0; i < 9; i++) { b.set(3 + i, 15 - Math.round(i * 1.4), P.T1); b.set(4 + i, 15 - Math.round(i * 1.4), P.T2); }
        for (let i = 0; i < 9; i++) { b.set(20 - i, 15 - Math.round(i * 1.4), P.T1); b.set(19 - i, 15 - Math.round(i * 1.4), P.T2); }
      } else {
        b.hl(0, TS - 1, 8, P.T2); b.hl(0, TS - 1, 9, P.T1);
        post(7); post(15);
      }
    } else if (kind === 'N') {
      // shutters + window + flower box
      const sh = v % 2 ? P.V2 : P.T3, shd = v % 2 ? P.V1 : P.T2;
      for (const sx of [3, 17]) {
        b.rect(sx, 4, 4, 10, sh); b.vl(sx + 3, 4, 13, shd);
        for (let y = 5; y < 14; y += 2) b.hl(sx, sx + 2, y, shd);
      }
      b.rect(7, 3, 10, 12, P.T1);
      b.rect(8, 4, 8, 10, P.W1);
      for (let y = 4; y < 14; y++) for (let x = 8; x < 16; x++) {
        const t = (x - 8) - (y - 4);
        if (t > 1 && t < 4) b.set(x, y, P.W3); else if (t === 4) b.set(x, y, P.W2);
        if (y > 9 && x > 11) b.set(x, y, P.W0);
      }
      b.vl(11, 4, 13, P.T2); b.vl(12, 4, 13, P.T1); b.hl(8, 15, 8, P.T2); b.hl(8, 15, 9, P.T1);
      b.hl(6, 17, 14, P.T4); b.hl(6, 17, 15, P.T1);
      if (v % 3 !== 2) {
        for (let x = 7; x < 17; x++) { b.set(x, 13, (x & 1) ? P.G3 : P.G2); if (x % 3 === 0) b.set(x, 12, [P.F3, P.F2, P.F4][x % 3 === 0 ? (x / 3) % 3 : 0]); }
      }
    } else if (kind === 'D') {
      // door with arch top and step
      for (let y = 4; y < 22; y++) for (let x = 6; x < 18; x++) {
        let c = ((x - 6) % 3 === 2) ? P.T1 : ((x - 6) % 3 === 0) ? P.T4 : P.T3;
        if (y === 4 && (x < 8 || x > 15)) continue;
        if (y === 5 && (x < 7 || x > 16)) continue;
        b.set(x, y, c);
      }
      b.hl(8, 15, 3, P.T0); b.set(7, 4, P.T0); b.set(16, 4, P.T0); b.set(6, 5, P.T0); b.set(17, 5, P.T0);
      b.vl(5, 5, 21, P.T0); b.vl(18, 5, 21, P.T0);
      b.hl(6, 17, 8, P.K1); b.hl(6, 17, 17, P.K1); b.hl(6, 9, 9, P.K2); b.hl(6, 9, 18, P.K2);
      b.set(15, 13, P.Y3); b.set(15, 14, P.Y1);
      b.rect(4, 21, 16, 3, P.K4); b.hl(4, 19, 23, P.K2); b.hl(4, 19, 21, P.K5);
      b.vl(4, 5, 20, P.T2); b.vl(19, 5, 20, P.T2);
    }
    wallCommon(b, I);
  }
  function stoneWallTile(b, I, kind) {
    const n = I.n, v = I.v;
    const wallBelow = BWALL(n[4]);
    const L = !BWALL(n[6]), Rt = !BWALL(n[2]);
    for (let y = 0; y < TS; y++) {
      const row = (y / 6) | 0, ly = y % 6;
      for (let x = 0; x < TS; x++) {
        const xx = x + (row & 1) * 6, lx = xx % 12, col = (xx / 12) | 0;
        const rv = hsh(col, row, v + 23);
        const base = rv < 0.3 ? P.K3 : rv < 0.6 ? mix(P.K3, P.B3, 0.4) : mix(P.K3, P.K4, 0.35);
        let c = base;
        if (ly === 5 || lx === 11) c = P.K1;
        else if (ly === 0 || lx === 0) c = lighten(base, 0.25);
        else if (ly === 4 || lx === 10) c = scale(base, 0.8);
        else if (hsh(x, y, v) < 0.05) c = scale(base, 0.9);
        b.set(x, y, c);
      }
    }
    if (!wallBelow) { for (let x = 0; x < TS; x++) { b.set(x, 20, P.K4); b.set(x, 21, P.K2); b.set(x, 22, P.K2); b.set(x, 23, P.K1); } }
    if (L) { b.vl(0, 0, TS - 1, P.OL); b.vl(1, 0, TS - 1, P.K4); }
    if (Rt) { b.vl(TS - 1, 0, TS - 1, P.OL); b.vl(TS - 2, 0, TS - 1, P.K2); }
    if (kind === 'G') {
      // arched stained-glass window
      const x0 = 7, x1 = 16, y0 = 2, y1 = 18;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const cx = (x0 + x1) / 2 + 0.5, dy = y - (y0 + 4), dx = x + 0.5 - cx;
        if (dy < 0 && Math.hypot(dx, dy * 1.1) > 5.2) continue;
        const inner = !(dy < 0 ? Math.hypot(dx, dy * 1.1) > 3.6 : Math.abs(dx) > 3.4) && y < y1 - 1;
        if (!inner) { b.set(x, y, dx < 0 ? P.K5 : P.K2); continue; }
        const cells = [P.W3, P.C3, P.Y3, P.W2, P.G4];
        let c = cells[(((x >> 1) + (y >> 1) * 2) % cells.length + cells.length) % cells.length];
        if ((x + y) % 4 === 0 || x === Math.floor(cx)) c = P.K0;
        b.set(x, y, c);
      }
      b.hl(x0 - 1, x1 + 1, y1 + 1, P.K5); b.hl(x0 - 1, x1 + 1, y1 + 2, P.K1);
    } else if (kind === 'K') {
      // great arched double door
      const x0 = 3, x1 = 20, cx = 12;
      for (let y = 1; y < TS; y++) for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y - 9;
        const ro = dy < 0 ? Math.hypot(dx, dy) : Math.abs(dx);
        if (ro > 9) continue;
        let c;
        if (ro > 7) { // voussoirs
          const seg = Math.floor((Math.atan2(dy, dx) + Math.PI) * 4);
          c = dy < 0 ? ((seg & 1) ? P.K4 : P.K5) : (dx < 0 ? P.K4 : P.K2);
          if (ro > 8.4) c = P.K1;
        } else {
          c = ((x - 5) % 3 === 2) ? P.T1 : ((x - 5) % 3 === 0) ? P.T4 : P.T3;
          if (x === 11 || x === 12) c = P.T0;
          if (y === 10 || y === 18) c = P.K1; else if (y === 11 || y === 19) c = P.K2;
          if (dy < 0 && ro > 6.2) c = P.T0;
        }
        b.set(x, y, c);
      }
      b.set(9, 14, P.Y3); b.set(9, 15, P.Y1); b.set(14, 14, P.Y3); b.set(14, 15, P.Y1);
      b.hl(2, 21, 23, P.K2); b.hl(3, 20, 22, P.K4);
    }
    wallCommon(b, I);
  }

  // ruined / fortress wall: light top faces, darker front face where the wall ends to the south
  function ruinTile(b, I) {
    const n = I.n, v = I.v, isX = c => c === 'X';
    drawGround(b, I.base, I);
    const front = !isX(n[4]);
    const topH = front ? 9 : TS;
    const L = !isX(n[6]), Rt = !isX(n[2]), Tp = !isX(n[0]);
    const broken = Tp && v % 3 === 0;
    const jagAt = x => 2 + Math.round(Math.sin(x * 0.7 + v) * 1.5 + hsh(x, 0, v) * 2);
    const moss = (x, y) => hsh(x >> 2, y >> 2, v + 40) < 0.2 && hsh(x, y, v + 41) < 0.55;
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      if (broken && y < jagAt(x)) continue;
      let c;
      if (y < topH) {
        // top of the wall: rough capstones seen from above (warm, light)
        const row = (y / 6) | 0, ly = y % 6, xx = x + (row & 1) * 5, lx = xx % 10, col = (xx / 10) | 0;
        const rv = hsh(col, row, v + 31);
        const base = rv < 0.45 ? P.B4 : rv < 0.8 ? mix(P.B4, P.K4, 0.5) : P.B5;
        c = base;
        if (ly === 5 || lx === 9) c = P.B2; else if (ly === 0 || lx === 0) c = lighten(base, 0.25);
        else if (hsh(x, y, v + 2) < 0.07) c = P.B3;
        if (moss(x, y)) c = hsh(x, y, 3) < 0.5 ? P.G3 : P.G2;
      } else {
        // front face: darker coursed masonry
        const yy = y - topH, row = (yy / 4) | 0, ly = yy % 4, xx = x + (row & 1) * 4, lx = xx % 8;
        const rv = hsh((xx / 8) | 0, row, v + 37);
        const base = rv < 0.5 ? P.K2 : mix(P.K2, P.B2, 0.55);
        c = base;
        if (ly === 3 || lx === 7) c = P.K1; else if (ly === 0) c = lighten(base, 0.15);
        if (yy === 0) c = P.K0;
        if (yy === 1) c = P.K3;
        if (y >= TS - 2) c = y === TS - 1 ? P.K0 : P.K1;
        if (moss(x, y) && yy < 6) c = P.G1;
      }
      b.set(x, y, c);
    }
    if (broken) for (let x = 0; x < TS; x++) { const j = jagAt(x); b.set(x, j, P.B5); b.set(x, j - 1, P.K1); }
    else if (Tp) { b.hl(0, TS - 1, 0, P.K1); b.hl(0, TS - 1, 1, P.B5); }
    if (L) for (let y = 0; y < TS; y++) { if (broken && y < jagAt(0)) continue; b.set(0, y, P.K0); if (y < topH) b.set(1, y, P.B5); }
    if (Rt) for (let y = 0; y < TS; y++) { if (broken && y < jagAt(TS - 1) - 1) continue; b.set(TS - 1, y, P.K0); if (y < topH) b.set(TS - 2, y, P.B2); else b.dk(TS - 2, y, 0.8); }
  }
  // =====================================================================
  //  Props
  // =====================================================================
  function fenceTile(b, I) {
    drawGround(b, I.base, I);
    const n = I.n, isF = c => c === 'F';
    const cn = isF(n[0]), cs = isF(n[4]), cw = isF(n[6]), ce = isF(n[2]);
    const horiz = cw || ce || !(cn || cs);
    if (horiz) {
      const x0 = cw ? 0 : 10, x1 = ce ? TS - 1 : 14;
      for (let x = x0; x <= x1; x++) {
        for (const ry of [8, 14]) { b.set(x, ry, P.T4); b.set(x, ry + 1, P.T3); b.set(x, ry + 2, P.T1); }
        b.dk(x + 1, 18, 0.7); b.dk(x + 1, 19, 0.8);
      }
    }
    if (cn || cs) {
      const y0 = cn ? 0 : 8, y1 = cs ? TS - 1 : 16;
      for (let y = y0; y <= y1; y++) { b.set(10, y, P.T4); b.set(11, y, P.T3); b.set(12, y, P.T2); b.set(13, y, P.T1); b.dk(14, y, 0.72); b.dk(15, y, 0.85); }
    }
    // post
    dropShadow(b, 14, 20, 3, 1.5, 0.65);
    b.rect(10, 5, 4, 15, P.T2); b.vl(10, 5, 19, P.T4); b.vl(13, 5, 19, P.T1);
    b.hl(10, 13, 4, P.T5); b.hl(10, 13, 19, P.T0);
  }
  function wellTile(b, I) {
    drawGround(b, I.base, I);
    dropShadow(b, 14, 19, 10, 3.5, 0.6);
    const cx = 12, cy = 11;
    for (let y = 2; y < 23; y++) for (let x = 1; x < 23; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const top = (dx / 10) ** 2 + (dy / 6.5) ** 2;
      const side = (dx / 10) ** 2 + ((dy - 5) / 6.5) ** 2;
      if (top <= 1) {
        const inner = (dx / 6.5) ** 2 + ((dy + 0.5) / 3.8) ** 2;
        if (inner <= 1) b.set(x, y, dy < -1 ? P.W0 : (inner < 0.35 && dx < 0 ? P.W3 : P.W1));
        else {
          const seg = Math.floor((Math.atan2(dy, dx) + Math.PI) * 2.2);
          let c = (seg & 1) ? P.K4 : P.K3; if (dy < -2) c = lighten(c, 0.2);
          if (inner < 1.25) c = P.K1;
          b.set(x, y, c);
        }
      } else if (side <= 1 && dy > 0) {
        const lx = Math.floor(x / 4 + (y > 17 ? 0.5 : 0));
        let c = (lx & 1) ? P.K2 : P.K3;
        if (y === 17) c = P.K1;
        if (side > 0.8) c = P.K1;
        b.set(x, y, c);
      }
    }
    // wooden frame + bucket
    for (const px of [2, 20]) { b.rect(px, 0, 2, 12, P.T2); b.vl(px, 0, 11, P.T4); b.vl(px + 1, 0, 11, P.T1); }
    b.hl(2, 21, 1, P.T4); b.hl(2, 21, 2, P.T2); b.hl(2, 21, 3, P.T0);
    b.vl(12, 4, 7, P.P1);
    b.rect(10, 8, 5, 3, P.T3); b.hl(10, 14, 8, P.K3); b.hl(10, 14, 10, P.T1);
  }
  function barrelTile(b, I) {
    drawGround(b, I.base, I);
    const barrel = (x0, y0) => {
      dropShadow(b, x0 + 6, y0 + 13, 5.5, 2, 0.6);
      for (let y = 0; y < 14; y++) for (let x = 0; x < 10; x++) {
        const dx = x - 4.5;
        if (y < 4) { if ((dx / 5) ** 2 + ((y - 2) / 2.2) ** 2 > 1) continue; b.set(x0 + x, y0 + y, y < 1 ? P.T1 : ((dx / 3.6) ** 2 + ((y - 2) / 1.5) ** 2 < 1 ? P.T4 : P.T2)); continue; }
        if (Math.abs(dx) > 4.6 - (y > 11 ? 1 : 0)) continue;
        let c = dx < -2 ? P.T4 : dx < 1 ? P.T3 : dx < 3 ? P.T2 : P.T1;
        if (y === 5 || y === 11) c = dx < 0 ? P.K3 : P.K1;
        if (y === 13) c = P.T0;
        b.set(x0 + x, y0 + y, c);
      }
    };
    const crate = (x0, y0, s) => {
      dropShadow(b, x0 + s / 2 + 2, y0 + s, s / 2 + 1, 2, 0.6);
      b.rect(x0, y0, s, 3, P.T4); b.hl(x0, x0 + s - 1, y0, P.T5);
      b.rect(x0, y0 + 3, s, s - 3, P.T3);
      b.rect(x0, y0 + 3, s, 1, P.T1);
      for (let i = 0; i < s - 3; i++) { b.set(x0 + 1 + Math.round(i * (s - 3) / (s - 3)), y0 + 3 + i, P.T2); b.set(x0 + s - 2 - i, y0 + 3 + i, P.T2); }
      b.vl(x0, y0, y0 + s - 1, P.T1); b.vl(x0 + s - 1, y0, y0 + s - 1, P.T0); b.hl(x0, x0 + s - 1, y0 + s - 1, P.T0);
    };
    if (I.v % 3 === 0) { barrel(1, 4); barrel(12, 8); }
    else if (I.v % 3 === 1) { crate(2, 3, 12); barrel(13, 8); }
    else { crate(3, 1, 10); crate(9, 10, 12); }
  }
  function graveTile(b, I) {
    drawGround(b, I.base, I);
    dropShadow(b, 14, 19, 7, 2.5, 0.6);
    for (let y = 16; y < 21; y++) for (let x = 5; x < 19; x++) { const q = ((x - 11.5) / 7) ** 2 + ((y - 18) / 3) ** 2; if (q < 1) b.set(x, y, q < 0.4 ? P.D2 : P.D1); }
    for (let y = 3; y < 19; y++) for (let x = 7; x < 17; x++) {
      const dx = x + 0.5 - 12, dy = y - 8;
      if (dy < 0 && Math.hypot(dx, dy) > 5) continue;
      let c = dx < -3 ? P.K4 : dx < 3 ? P.K3 : P.K2;
      if ((dy < 0 && Math.hypot(dx, dy) > 4.2) || x === 16) c = dx < 0 ? P.K5 : P.K1;
      if (y === 18) c = P.K1;
      b.set(x, y, c);
    }
    b.vl(12, 6, 13, P.K1); b.hl(10, 14, 8, P.K1);
    if (I.v & 1) { b.set(8, 16, P.G2); b.set(9, 15, P.G3); b.set(15, 16, P.G2); }
  }
  function shrubTile(b, I) {
    drawGround(b, I.base, I);
    const indoor = I.base === 'i' || I.base === 'c';
    if (indoor) {
      dropShadow(b, 14, 21, 6, 2, 0.6);
      for (let y = 14; y < 22; y++) { const w = 5 - (y - 14) * 0.35; for (let x = Math.round(12 - w); x < 12 + w; x++) b.set(x, y, x < 10 ? P.R4 : x < 13 ? P.R3 : P.R2); }
      b.hl(6, 17, 14, P.R4); b.hl(6, 17, 15, P.R1);
      const leaves = [[12, 8, 5], [8, 10, 3.5], [16, 10, 3.5]];
      for (const [cx, cy, r] of leaves) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (d > r) continue;
        const l = -(dx + dy) / r + (hsh(x, y, 5) - 0.5) * 0.5;
        b.set(x, y, l > 0.6 ? P.G5 : l > 0 ? P.G4 : l > -0.6 ? P.G3 : P.G1);
      }
    } else {
      dropShadow(b, 14, 18, 9, 3, 0.6);
      const blobs = [[8, 12, 5.5], [16, 11, 5.5], [12, 8, 6], [12, 14, 6]];
      for (const [cx, cy, r] of blobs) for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (d > r) continue;
        let l = -(dx * 0.6 + dy * 0.8) / r + (hsh(x >> 1, y >> 1, I.v + cx) - 0.5) * 0.45;
        let i = l > 0.5 ? 5 : l > 0.15 ? 4 : l > -0.2 ? 3 : l > -0.55 ? 2 : 1;
        if (d > r - 1 && dx + dy > 0) i = 0;
        b.set(x, y, GRN[i]);
      }
      if (I.v % 2 === 0) for (const [x, y] of [[9, 8], [14, 6], [16, 12], [10, 14]]) { b.set(x, y, P.F3); b.set(x + 1, y, P.F4); }
    }
  }
  function lampTile(b, I) {
    drawGround(b, I.base, I);
    const fl = [0, 1, 0, 2][I.af & 3];
    // glow on the ground
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const d = Math.hypot(x - 11.5, (y - 6) * 1.1);
      const rr = 9 + fl;
      if (d < rr && ((x + y) & 1 || d < rr - 3)) b.tint(x, y, P.Y4, 0.18 * (1 - d / rr));
    }
    dropShadow(b, 15, 21, 4, 1.5, 0.6);
    b.rect(9, 20, 6, 3, P.K2); b.hl(9, 14, 20, P.K3); b.hl(9, 14, 22, P.K0);
    b.rect(11, 9, 2, 11, P.K1); b.vl(11, 9, 19, P.K2);
    b.hl(10, 13, 9, P.K1);
    // lantern
    b.hl(9, 14, 1, P.K0); b.hl(10, 13, 0, P.K1);
    b.rect(9, 2, 6, 6, P.K0);
    const glow = fl === 2 ? P.Y4 : fl === 1 ? P.Y3 : mix(P.Y3, P.Y4, 0.5);
    b.rect(10, 3, 4, 4, glow); b.set(10, 3, P.F1); b.vl(12, 3, 6, P.Y2);
    b.hl(9, 14, 8, P.K1);
  }
  function stallTile(b, I) {
    drawGround(b, I.base, I);
    const n = I.n, jw = n[6] === 'Y', je = n[2] === 'Y';
    dropShadow(b, 13, 22, 11, 2, 0.6);
    // poles
    if (!jw) { b.vl(1, 6, 22, P.T1); b.vl(2, 6, 22, P.T3); }
    if (!je) { b.vl(21, 6, 22, P.T3); b.vl(22, 6, 22, P.T1); }
    // counter
    b.rect(0, 14, TS, 8, P.T2); b.hl(0, TS - 1, 14, P.T4); b.hl(0, TS - 1, 15, P.T3); b.hl(0, TS - 1, 21, P.T0);
    for (let x = 3; x < TS; x += 6) b.vl(x, 16, 20, P.T1);
    // goods
    const goods = [[P.C3, P.C4], [P.G4, P.G5], [P.FIRE2, P.Y3], [P.F5, P.F4]];
    for (let i = 0; i < 4; i++) {
      const g = goods[(i + I.v) % 4], x = 3 + i * 5;
      b.set(x, 12, g[0]); b.set(x + 1, 12, g[1]); b.set(x + 2, 12, g[0]); b.set(x, 13, g[0]); b.set(x + 1, 13, g[0]); b.set(x + 2, 13, scale(g[0], 0.7));
      b.set(x + 1, 11, g[1]);
    }
    // awning with stripes and scalloped edge
    for (let y = 0; y < 9; y++) for (let x = 0; x < TS; x++) {
      if (y === 0 && ((!jw && x < 1) || (!je && x > 22))) continue;
      const st = ((x / 3) | 0) & 1;
      let c = st ? P.P3 : P.C3;
      if (y < 2) c = st ? P.F1 : P.C4;
      if (y > 5) c = st ? P.P2 : P.C2;
      b.set(x, y, c);
    }
    for (let x = 0; x < TS; x++) { const lx = x % 6; if (lx === 1 || lx === 2 || lx === 3 || lx === 4) b.set(x, 9, (((x / 3) | 0) & 1) ? P.P1 : P.C1); b.dk(x, 10, 0.6); }
    b.hl(0, TS - 1, 0, P.C1);
  }
  const STATUE = [
    '.....1.....',
    '.....5.....',
    '.....4.....',
    '....141....',
    '...15432...',
    '...14432...',
    '...12321...',
    '..1543321..',
    '.154433321.',
    '.143433221.',
    '.143333221.',
    '..1433321..',
    '..1433221..',
    '..1433221..',
    '..14332221.',
    '.144333221.',
  ];
  function statueTile(b, I) {
    drawGround(b, I.base, I);
    dropShadow(b, 14, 21, 10, 2.5, 0.6);
    // pedestal
    b.rect(4, 14, 16, 8, P.K3); b.hl(4, 19, 14, P.K5); b.hl(4, 19, 15, P.K4); b.vl(4, 15, 21, P.K4); b.vl(19, 15, 21, P.K1);
    b.hl(4, 19, 21, P.K1); b.hl(5, 18, 18, P.K2); b.rect(9, 17, 6, 2, P.Y2); b.hl(9, 14, 17, P.Y3);
    stamp(b, 7, 0, STATUE, { 1: P.K1, 2: P.K2, 3: P.K3, 4: P.K4, 5: P.K5 });
  }

  // =====================================================================
  //  Interior
  // =====================================================================
  function iwallTile(b, I) {
    const n = I.n, v = I.v;
    const front = !IWALL(n[4]) && n[4] !== ' ';
    const L = !IWALL(n[6]), Rt = !IWALL(n[2]), Tp = !IWALL(n[0]);
    // top face
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) b.set(x, y, ((x + y) % 4 === 0) ? P.B1 : mix(P.B1, P.B0, 0.5));
    if (L) for (let y = 0; y < TS; y++) { b.set(0, y, P.X0); b.set(1, y, P.B2); }
    if (Rt) for (let y = 0; y < TS; y++) { b.set(TS - 1, y, P.X0); b.set(TS - 2, y, P.B0); }
    if (Tp) { b.hl(0, TS - 1, 0, P.X0); b.hl(0, TS - 1, 1, P.B2); }
    if (front) frontFace(b, 4, v);
  }
  function frontFace(b, y0, v) {
    b.hl(0, TS - 1, y0 - 1, P.B3);
    for (let y = y0; y < TS; y++) for (let x = 0; x < TS; x++) {
      let c;
      if (y < 14) { c = hsh(x, y, v) < 0.06 ? P.P1 : P.P2; if (y === y0) c = P.P0; if (((x / 12) | 0) && x % 12 === 0) c = P.P1; }
      else if (y === 14) c = P.T4;
      else if (y === 15) c = P.T1;
      else if (y >= TS - 2) c = y === TS - 1 ? P.T0 : P.T1;
      else { const lx = x % 8; c = lx === 0 ? P.T1 : lx === 1 ? P.T4 : P.T2; if (y === 16) c = P.T3; }
      b.set(x, y, c);
    }
  }
  function tableTile(b, I) {
    drawGround(b, I.base, I);
    const n = I.n, jw = n[6] === 't', je = n[2] === 't';
    const x0 = jw ? 0 : 2, x1 = je ? TS - 1 : 21;
    for (let x = x0; x <= x1; x++) { b.dk(x + 2, 19, 0.6); b.dk(x + 2, 20, 0.7); b.dk(x + 2, 21, 0.85); }
    if (!jw) { b.rect(3, 15, 2, 6, P.T1); }
    if (!je) { b.rect(19, 15, 2, 6, P.T0); }
    for (let y = 4; y < 18; y++) for (let x = x0; x <= x1; x++) {
      let c = y === 4 ? P.T5 : y < 15 ? (((y + (x >> 3)) % 3 === 0) ? P.T3 : P.T4) : y === 15 ? P.T2 : y === 16 ? P.T1 : P.T0;
      if (!jw && x === x0 && y < 15) c = P.T3; if (!je && x === x1 && y < 15) c = P.T2;
      b.set(x, y, c);
    }
    if (I.v % 3 === 0) { b.rect(8, 7, 5, 4, P.F1); b.hl(8, 12, 10, P.K3); b.set(10, 8, P.C3); b.set(11, 8, P.FIRE2); }
    else if (I.v % 3 === 1) { b.rect(13, 6, 3, 5, P.K4); b.vl(15, 6, 10, P.K2); b.set(16, 8, P.K3); b.hl(13, 15, 6, P.T1); }
    else { b.rect(10, 5, 2, 5, P.F1); b.set(10, 4, P.FIRE2); b.set(10, 3, P.Y4); b.hl(9, 12, 10, P.Y1); }
  }
  function counterTile(b, I) {
    drawGround(b, I.base, I);
    const n = I.n, jw = n[6] === 'e', je = n[2] === 'e';
    b.rect(0, 8, TS, 14, P.T2);
    for (let x = 0; x < TS; x++) { b.set(x, 8, P.T5); b.set(x, 9, P.T4); b.set(x, 10, P.T4); b.set(x, 11, P.T1); b.set(x, 21, P.T0); b.dk(x, 22, 0.65); }
    for (let x = 2; x < TS; x += 8) { b.rect(x, 13, 6, 7, P.T3); b.hl(x, x + 5, 13, P.T1); b.vl(x, 13, 19, P.T1); b.hl(x, x + 5, 19, P.T4); }
    if (!jw) { b.vl(0, 8, 21, P.T0); }
    if (!je) { b.vl(TS - 1, 8, 21, P.T0); }
    // wares on top
    const items = [[3, P.G3, P.G5], [8, P.T1, P.T3], [13, P.W2, P.W4], [18, P.C2, P.C4]];
    for (const [x, c1, c2] of items) {
      if (hsh(x, 0, I.v) < 0.3) continue;
      b.rect(x, 3, 3, 6, c1); b.vl(x, 3, 8, c2); b.set(x + 1, 1, c1); b.set(x + 1, 2, c1); b.set(x + 1, 0, P.T4);
    }
  }
  function altarTile(b, I) {
    drawGround(b, I.base, I);
    const fl = I.af & 3;
    dropShadow(b, 13, 21, 11, 2, 0.55);
    b.rect(2, 9, 20, 12, P.K3); b.vl(2, 9, 20, P.K4); b.vl(21, 9, 20, P.K1); b.hl(2, 21, 20, P.K1);
    b.rect(1, 7, 22, 3, P.F1); b.hl(1, 22, 7, P.K5); b.hl(1, 22, 9, P.P2);
    b.rect(8, 9, 8, 8, P.C2); b.hl(8, 15, 16, P.Y2); b.vl(8, 9, 16, P.Y2); b.vl(15, 9, 16, P.Y2);
    b.vl(11, 10, 15, P.Y3); b.vl(12, 10, 15, P.Y2); b.hl(10, 13, 12, P.Y3);
    for (const cx of [4, 19]) {
      b.rect(cx, 2, 2, 5, P.F1); b.vl(cx + 1, 2, 6, P.P2); b.hl(cx - 1, cx + 2, 7, P.Y1);
      b.set(cx, 1, fl & 1 ? P.FIRE1 : P.FIRE2); b.set(cx + (fl === 2 ? 1 : 0), 0, P.Y4);
    }
  }
  function pewTile(b, I) {
    drawGround(b, I.base, I);
    const n = I.n, jw = n[6] === 'u', je = n[2] === 'u';
    const x0 = jw ? 0 : 2, x1 = je ? TS - 1 : 21;
    for (let x = x0; x <= x1; x++) {
      b.set(x, 3, P.T4); b.set(x, 4, P.T3); b.set(x, 5, P.T3); b.set(x, 6, P.T2); b.set(x, 7, P.T1);
      b.set(x, 11, P.T5); for (let y = 12; y < 16; y++) b.set(x, y, P.T3); b.set(x, 16, P.T1); b.set(x, 17, P.T0);
      b.dk(x + 1, 18, 0.65); b.dk(x + 1, 19, 0.8);
    }
    for (let x = x0; x <= x1; x += 6) { b.rect(x, 8, 2, 3, P.T1); }
    if (!jw) { b.rect(1, 2, 2, 18, P.T2); b.vl(1, 2, 19, P.T4); b.hl(1, 2, 19, P.T0); }
    if (!je) { b.rect(21, 2, 2, 18, P.T1); b.vl(22, 2, 19, P.T0); }
  }
  function bedTile(b, I) {
    drawGround(b, I.base, I);
    const n = I.n, upper = n[4] === 'j', lower = n[0] === 'j';
    dropShadow(b, 14, lower ? 22 : 21, 9, 2, 0.6);
    const y0 = lower ? 0 : 2, y1 = upper ? TS - 1 : 21;
    b.rect(3, y0, 18, y1 - y0 + 1, P.T2); b.vl(3, y0, y1, P.T3); b.vl(20, y0, y1, P.T1);
    if (!lower) { b.rect(3, 1, 18, 3, P.T3); b.hl(3, 20, 1, P.T5); b.hl(3, 20, 3, P.T1); }
    if (!upper) { b.rect(3, 19, 18, 3, P.T3); b.hl(3, 20, 19, P.T4); b.hl(3, 20, 21, P.T0); }
    const blanketTop = lower ? 0 : upper ? 12 : 11;
    const blanketBot = upper ? TS - 1 : 18;
    if (!lower) { b.rect(5, 5, 14, 5, P.F1); b.hl(5, 18, 9, P.P2); b.vl(18, 5, 9, P.P2); b.hl(6, 17, 5, P.W6); }
    const bc = I.v % 2 ? [P.W3, P.W2, P.W1] : [P.C3, P.C2, P.C1];
    for (let y = blanketTop; y <= blanketBot; y++) for (let x = 4; x < 20; x++) {
      let c = x < 7 ? bc[0] : x > 17 ? bc[2] : bc[1];
      if (!lower && y === blanketTop) c = P.F1; else if (!lower && y === blanketTop + 1) c = bc[0];
      if ((x + y) % 6 === 0 && x > 6 && x < 18) c = bc[0];
      b.set(x, y, c);
    }
  }
  function hearthTile(b, I) {
    const v = I.v, af = I.af % 3;
    iwallTile(b, I);
    b.rect(2, 3, 20, 21, P.K3);
    for (let y = 3; y < TS; y++) for (let x = 2; x < 22; x++) {
      const row = ((y - 3) / 4) | 0, lx = (x + (row & 1) * 3) % 6;
      let c = hsh(x >> 2, row, v) < 0.5 ? P.K3 : P.K4;
      if ((y - 3) % 4 === 3 || lx === 5) c = P.K1;
      b.set(x, y, c);
    }
    b.rect(1, 3, 22, 3, P.T2); b.hl(1, 22, 3, P.T4); b.hl(1, 22, 5, P.T0);
    for (let y = 9; y < 23; y++) for (let x = 6; x < 18; x++) {
      const dy = y - 12, dx = x + 0.5 - 12;
      if (dy < 0 && Math.hypot(dx, dy) > 6) continue;
      b.set(x, y, P.X0);
    }
    b.hl(6, 17, 22, P.K1);
    b.rect(8, 19, 8, 2, P.T1); b.hl(8, 15, 19, P.T3);
    const FL = [
      ['...3....', '..323.3.', '.32123..', '.321123.', '32111123', '3211123.'],
      ['.....3..', '.3.323..', '..32123.', '.321123.', '32111123', '.3211123'],
      ['..3.....', '..323...', '.321233.', '3211123.', '32111123', '32111123'],
    ][af];
    stamp(b, 8, 13, FL, { 1: P.FIRE1, 2: P.FIRE2, 3: P.FIRE3 });
    for (let x = 6; x < 18; x++) if (hsh(x, af, 3) < 0.4) b.set(x, 21, P.FIRE4);
  }
  function shelfTile(b, I) {
    iwallTile(b, I);
    const v = I.v;
    b.rect(1, 2, 22, 22, P.T1); b.vl(1, 2, 23, P.T3); b.vl(22, 2, 23, P.T0); b.hl(1, 22, 2, P.T4);
    const bookC = [P.C2, P.W2, P.G2, P.Y1, P.F5, P.T3, P.C3, P.E3];
    for (const sy of [3, 10, 17]) {
      b.hl(2, 21, sy + 6, P.T3); b.hl(2, 21, sy + 5 + 1, P.T4);
      let x = 3;
      while (x < 21) {
        const w = 1 + Math.floor(hsh(x, sy, v) * 2), h = 3 + Math.floor(hsh(sy, x, v) * 3);
        const c = bookC[Math.floor(hsh(x + 7, sy, v) * bookC.length)];
        if (hsh(x, sy, v + 1) < 0.08) { x += 2; continue; }
        for (let i = 0; i < w && x + i < 21; i++) { b.vl(x + i, sy + 6 - h, sy + 5, i === 0 ? lighten(c, 0.25) : c); b.set(x + i, sy + 6 - h + 1, P.Y2); }
        x += w + (hsh(x, v, sy) < 0.25 ? 1 : 0);
      }
    }
  }

  // =====================================================================
  //  Renderer registry + cache
  // =====================================================================
  // need: 's' (shadow only), 'n' (neighbour codes), 'g' (neighbour codes + ground classes), base: infers ground under object
  const REG = {};
  function reg(codes, spec) { for (const c of codes) REG[c] = spec; }
  reg('.', { need: 's', fn: (b, I) => { grassTex(b, I.v); applyShadow(b, I.sh); } });
  reg('o', { need: 's', anim: 2, spd: 30, fn: (b, I) => { flowerTex(b, I.v, I.af); applyShadow(b, I.sh); } });
  reg('y', { need: 'n', anim: 2, spd: 36, fn: wheatTile });
  reg(',=psxicq', { need: 'g', fn: (b, I) => drawGround(b, I.c, I) });
  reg('f', { need: 's', fn: forestTile });
  reg('T', { need: 'n', fn: denseTile });
  reg('h', { need: 's', fn: hillsTile });
  reg('M', { need: 'n', uniq: true, fn: mountainTile });
  reg('w', { need: 'g', anim: 4, spd: 24, fn: (b, I) => waterTile(b, I, false) });
  reg('~', { need: 'g', anim: 4, spd: 20, fn: (b, I) => waterTile(b, I, true) });
  reg('b', { need: 'g', anim: 4, spd: 24, fn: bridgeEW });
  reg('B', { need: 'g', anim: 4, spd: 24, fn: bridgeNS });
  reg('r', { need: 'g', base: true, fn: boulderTile });
  reg('X', { need: 'g', base: true, fn: ruinTile });
  reg('F', { need: 'g', base: true, fn: fenceTile });
  reg('R', { need: 'n', fn: (b, I) => roofTile(b, I, false) });
  reg('Q', { need: 'n', fn: (b, I) => roofTile(b, I, true) });
  reg('+', { need: 'n', fn: spireTile });
  reg('W', { need: 'n', fn: (b, I) => timberTile(b, I, 'W') });
  reg('N', { need: 'n', fn: (b, I) => timberTile(b, I, 'N') });
  reg('D', { need: 'n', fn: (b, I) => timberTile(b, I, 'D') });
  reg('S', { need: 'n', fn: (b, I) => stoneWallTile(b, I, 'S') });
  reg('G', { need: 'n', fn: (b, I) => stoneWallTile(b, I, 'G') });
  reg('K', { need: 'n', fn: (b, I) => stoneWallTile(b, I, 'K') });
  reg('l', { need: 'g', base: true, fn: wellTile });
  reg('k', { need: 'g', base: true, fn: barrelTile });
  reg('g', { need: 'g', base: true, fn: graveTile });
  reg('P', { need: 'g', base: true, fn: shrubTile });
  reg('L', { need: 'g', base: true, anim: 4, spd: 14, fn: lampTile });
  reg('Y', { need: 'g', base: true, fn: stallTile });
  reg('Z', { need: 'g', base: true, fn: statueTile });
  reg('I', { need: 'n', fn: iwallTile });
  reg('t', { need: 'g', base: true, fn: tableTile });
  reg('e', { need: 'g', base: true, fn: counterTile });
  reg('a', { need: 'g', base: true, anim: 4, spd: 12, fn: altarTile });
  reg('u', { need: 'g', base: true, fn: pewTile });
  reg('j', { need: 'g', base: true, fn: bedTile });
  reg('v', { need: 'n', anim: 3, spd: 9, fn: hearthTile });
  reg('n', { need: 'n', fn: shelfTile });
  reg(' ', { need: '', fn: (b) => b.fill(P.X0) });

  const tileCache = new Map();
  const nb = new Array(8), gb = new Array(8);
  let tbuf = null;
  function renderTile(key, spec, I) {
    if (!tbuf) tbuf = new Buf(TS, TS);
    tbuf.fill(0);
    spec.fn(tbuf, I);
    if (tileCache.size > 8000) tileCache.clear();
    const c = tbuf.canvas(); tileCache.set(key, c); return c;
  }
  G.tileCanvas = function (map, tx, ty, frame) {
    const code = map.get(tx, ty);
    const spec = REG[code] || REG['.'];
    const v = Math.floor(hsh(tx, ty, 7) * 8);
    let af = 0;
    if (spec.anim) af = (Math.floor((frame || 0) / spec.spd) + (v & 1)) % spec.anim;
    for (let k = 0; k < 8; k++) nb[k] = map.get(tx + DX[k], ty + DY[k]);
    const sh = (TALL.has(nb[0]) ? 1 : 0) | (TALL.has(nb[6]) ? 2 : 0) | (TALL.has(nb[7]) ? 4 : 0);
    let key = code + v + '.' + af;
    let base = '';
    if (spec.need === 's') key += '#' + sh;
    else if (spec.need === 'n' || spec.need === 'g') {
      key += nb.join('') + sh;
      if (spec.need === 'g') { for (let k = 0; k < 8; k++) gb[k] = groundOf(map, tx + DX[k], ty + DY[k]); key += '/' + gb.join(''); }
      if (spec.base) { base = inferBase(map, tx, ty, code); key += '^' + base; }
    }
    if (spec.uniq) key += '@' + tx + ',' + ty;
    let c = tileCache.get(key);
    if (!c) c = renderTile(key, spec, { c: code, n: nb.slice(), g: gb.slice(), v, af, sh, base, tx, ty });
    return c;
  };
  G.drawTile = function (ctx, map, tx, ty, px, py, frame) {
    ctx.drawImage(G.tileCanvas(map, tx, ty, frame == null ? G.frame : frame), px | 0, py | 0);
  };
  G.clearTileCache = () => tileCache.clear();

  // =====================================================================
  //  Mini-map
  // =====================================================================
  const MINI = {
    '.': '#4f9c30', 'o': '#62a83a', 'y': '#d4ac38', ',': '#b8884a', '=': '#8e8e9a', 'p': '#bdb092', 'f': '#2e7428', 'T': '#16401a',
    'h': '#7aa440', 'M': '#8c6c48', 's': '#dcc080', '~': '#5890e0', 'w': '#2250b4', 'b': '#9c5e2a', 'B': '#9c5e2a', 'r': '#7c7c88',
    'x': '#a09c98', 'X': '#5c5c6c', 'F': '#8c5a28', 'R': '#b43620', 'Q': '#3a5c98', '+': '#3a5c98', 'W': '#d8ccae', 'N': '#d8ccae',
    'D': '#74421e', 'S': '#8a8a96', 'G': '#8a8a96', 'K': '#74421e', 'l': '#6c6c80', 'k': '#9c5e2a', 'g': '#9a9aa4', 'P': '#3c8a2c',
    'L': '#e8c850', 'Y': '#c8343c', 'Z': '#b4b2b4', 'i': '#a0602c', 'I': '#4c4032', 'q': '#9c1c2c', 't': '#c0823a', 'e': '#74421e',
    'a': '#e6e2d8', 'u': '#74421e', 'j': '#d8d8e8', 'v': '#e05818', 'n': '#5c3418', 'c': '#a08c6c', ' ': '#000000',
  };
  G.MINI_COLORS = MINI;
  G.drawMiniTile = function (ctx, code, x, y, size) {
    ctx.fillStyle = MINI[code] || '#4f9c30';
    ctx.fillRect(x, y, size, size);
    if (size >= 4) {
      if (code === 'f' || code === 'T') { ctx.fillStyle = code === 'T' ? '#0c2a10' : '#1c5018'; ctx.fillRect(x + size - 2, y + size - 2, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); }
      else if (code === 'M') { ctx.fillStyle = '#c8a878'; ctx.fillRect(x + (size >> 1) - 1, y + 1, 2, 1); }
      else if (code === 'w') { ctx.fillStyle = '#4c84dc'; ctx.fillRect(x + 1, y + (size >> 1), size - 2, 1); }
    }
  };

  // =====================================================================
  //  Battle backdrops (320x224)
  // =====================================================================
  const BW = 320, BH = 224;
  const H = h => U(h);
  function bands(b, y0, y1, cols) {
    const n = cols.length, h = (y1 - y0) / n;
    for (let y = Math.max(0, y0); y < y1 && y < b.h; y++) {
      const i = Math.min(n - 1, Math.floor((y - y0) / h)), r = y - Math.round(y0 + i * h);
      for (let x = 0; x < b.w; x++) {
        let c = cols[i];
        if (i > 0) {
          if (r === 0 && ((x + y) & 1)) c = cols[i - 1];
          else if (r === 1 && (x & 3) === ((y & 1) << 1)) c = cols[i - 1];
          else if (r === -1) c = cols[i - 1];
        }
        b.set(x, y, c);
      }
    }
  }
  // smooth 1D value noise (fractal)
  function vnoise(x, seed) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hsh(i, seed, 1) * (1 - u) + hsh(i + 1, seed, 1) * u;
  }
  function fbm(x, seed, oct) { let a = 0, amp = 1, tot = 0; for (let o = 0; o < (oct || 4); o++) { a += vnoise(x, seed + o * 17) * amp; tot += amp; amp *= 0.5; x *= 2.03; } return a / tot; }
  // mountain range silhouette with lit/shade flanks, gullies and optional snow
  function mountains(b, R, yBase, yBot, count, hMin, hMax, pal, snow) {
    const pk = [];
    for (let i = 0; i < count; i++) pk.push({ x: -30 + (i + 0.2 + R() * 0.6) * ((BW + 60) / count), h: hMin + R() * (hMax - hMin), s: 0.5 + R() * 0.5 });
    const seed = Math.floor(R() * 1e6);
    for (let x = 0; x < b.w; x++) {
      let H = -1e9, p = null;
      for (const q of pk) { const t = q.h - Math.abs(x - q.x) * q.s; if (t > H) { H = t; p = q; } }
      const rough = (fbm(x / 22, seed, 4) - 0.5) * p.h * 0.45;
      const top = Math.round(yBase - H - rough);
      const peakTop = yBase - p.h;
      const lit = x < p.x;
      for (let y = Math.max(0, top); y < yBot; y++) {
        const depth = y - top;
        let c = lit ? pal.lt : pal.mid;
        // gullies running parallel to the flank
        const u = x + (y - peakTop) * (lit ? 1 : -1) * p.s * 0.9;
        const gv = vnoise(u / 3, seed + 5);
        if (depth > 2 && gv < 0.22) c = lit ? pal.mid : pal.sh;
        else if (!lit && depth > 1 && gv > 0.8) c = pal.lt === c ? c : pal.mid === c ? pal.lt : pal.mid;
        if (!lit && depth < 2) c = pal.sh;
        if (lit && depth < 1) c = pal.snowRim || c;
        if (snow && p.h > snow.min) {
          const sl = peakTop + snow.d + (fbm(x / 6, seed + 9, 3) - 0.5) * 10;
          if (y < sl) c = lit ? snow.lt : (gv < 0.3 ? snow.sh : snow.lt === c ? c : snow.sh);
        }
        if (y >= yBot - 8 && pal.base) { const f = (y - (yBot - 8)) / 8; if (hsh(x, y, seed) < f) c = pal.base; }
        b.set(x, y, c);
      }
    }
  }
  // flat-topped desert buttes with horizontal strata
  function mesas(b, R, yBase, count, pal) {
    for (let i = 0; i < count; i++) {
      const cx = R() * BW, w = 26 + R() * 50, h = 14 + R() * 26, top = yBase - h;
      const seed = Math.floor(R() * 1e5);
      for (let x = Math.floor(cx - w / 2 - h * 0.5); x < cx + w / 2 + h * 0.5; x++) {
        const edge = Math.abs(x - cx) - w / 2;
        const tt = edge < 0 ? top + fbm(x / 5, seed, 2) * 3 : top + edge * 2.2 + fbm(x / 5, seed, 2) * 3;
        for (let y = Math.max(0, Math.round(tt)); y < yBase; y++) {
          const lit = x < cx - w * 0.15;
          let c = lit ? pal.lt : pal.mid;
          if (x > cx + w * 0.3) c = pal.sh;
          const band = Math.floor((y - top) / 4 + vnoise(x / 9, seed) * 1.5);
          if (band % 3 === 2) c = c === pal.lt ? pal.mid : pal.sh;
          if (y - tt < 1.5) c = pal.top;
          b.set(x, y, c);
        }
      }
    }
  }
  function boulderBG(b, cx, cy, r) {
    for (let y = Math.floor(cy - r); y <= cy + r * 0.4; y++) for (let x = Math.floor(cx - r * 1.3); x <= cx + r * 1.3; x++) {
      const dx = (x - cx) / (r * 1.3), dy = (y - cy) / r, q = dx * dx + dy * dy;
      if (q > 1) continue;
      const l = -(dx * 0.7 + dy * 0.7);
      b.set(x, y, q > 0.8 && dx > -0.2 ? P.K1 : l > 0.5 ? P.K5 : l > 0.1 ? P.K4 : l > -0.3 ? P.K3 : P.K2);
    }
    for (let x = Math.floor(cx - r * 1.3); x <= cx + r * 1.4; x++) b.dk(x + 2, Math.round(cy + r * 0.4) + 1, 0.6);
  }
  // soft rolling hills
  function rolling(b, R, yBase, yBot, amp, pal) {
    const ph = [R() * TAU, R() * TAU, R() * TAU], f = [0.013 + R() * 0.01, 0.031 + R() * 0.01, 0.07];
    const seed = Math.floor(R() * 1e6);
    for (let x = 0; x < b.w; x++) {
      const hgt = amp * (0.55 * Math.sin(x * f[0] + ph[0]) + 0.3 * Math.sin(x * f[1] + ph[1]) + 0.12 * Math.sin(x * f[2] + ph[2]));
      const top = Math.round(yBase - hgt);
      const slope = amp * (0.55 * f[0] * Math.cos(x * f[0] + ph[0]) + 0.3 * f[1] * Math.cos(x * f[1] + ph[1]));
      for (let y = Math.max(0, top); y < yBot; y++) {
        let c = pal.mid;
        const d = y - top;
        if (d < 2) c = pal.lt;
        else if (slope > 0.12 && d < 10 && ((x + y) & 1)) c = pal.lt;
        else if (slope < -0.15 && d < 12) c = ((x + y) & 1) ? pal.sh : pal.mid;
        if (pal.dots && hsh(x, y, seed) < 0.02) c = pal.dots;
        b.set(x, y, c);
      }
    }
  }
  function treeLine(b, R, yBase, yBot, rMin, rMax, pal) {
    let x = -8;
    const seed = Math.floor(R() * 1e6);
    while (x < b.w + 10) {
      const r = rMin + R() * (rMax - rMin), cy = yBase - r * (0.3 + R() * 0.7);
      for (let y = Math.floor(cy - r); y < yBot; y++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
        const dx = xx + 0.5 - x, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
        if (y < cy && d > r) continue;
        if (y >= cy && Math.abs(dx) > r) continue;
        let c = pal.mid;
        if (y < cy + r * 0.3) {
          const l = -(dx * 0.6 + dy * 0.8) / r + (hsh(xx >> 1, y >> 1, seed) - 0.5) * 0.5;
          c = l > 0.45 ? pal.lt : l > -0.2 ? pal.mid : pal.sh;
          if (d > r - 1 && dx > 0) c = pal.sh;
        } else c = ((xx + y) & 1) && y < cy + r ? pal.mid : pal.sh;
        b.set(xx, y, c);
      }
      x += r * (0.9 + R() * 0.6);
    }
  }
  function pinesLine(b, R, yBase, yBot, hMin, hMax, pal) {
    let x = -6;
    while (x < b.w + 8) {
      const h = hMin + R() * (hMax - hMin), top = yBase - h, w = h * 0.3;
      for (let y = Math.floor(top); y < yBot; y++) {
        const t = Math.min(1, (y - top) / h), tier = (t * 4) % 1;
        const hw = y > yBase ? w : Math.max(0.5, t * w * (0.6 + tier * 0.5));
        for (let xx = Math.floor(x - hw); xx <= x + hw; xx++) {
          const dx = xx + 0.5 - x;
          b.set(xx, y, y > yBase - 1 ? pal.sh : dx < -hw * 0.25 ? pal.lt : dx < hw * 0.4 ? pal.mid : pal.sh);
        }
      }
      x += w * (1.0 + R() * 0.8);
    }
  }
  // perspective striped ground
  function groundStripes(b, hy, y1, c1, c2, C) {
    for (let y = hy; y < y1; y++) {
      const z = y - hy + 2, bw = z * z / C;
      const idx = Math.floor(C / z);
      for (let x = 0; x < b.w; x++) {
        let c = (idx & 1) ? c1 : c2;
        if (bw < 1.6) c = ((x + y) & 1) ? c1 : c2;
        b.set(x, y, c);
      }
    }
  }
  function tufts(b, R, hy, y1, count, pal) {
    for (let i = 0; i < count; i++) {
      const t = Math.pow(R(), 0.7), y = Math.round(hy + 3 + t * (y1 - hy - 4)), x = Math.round(R() * BW);
      const s = 1 + Math.round(t * 3);
      for (let k = -s; k <= s; k++) {
        const hgt = Math.round((s + 1) * (1 - Math.abs(k) / (s + 1.5)) * (0.7 + (k & 1) * 0.5));
        for (let j = 0; j < hgt; j++) b.set(x + k, y - j, j === hgt - 1 ? pal[2] : pal[1]);
      }
      b.hl(x - s, x + s, y + 1, pal[0]);
    }
  }
  function pebbles(b, R, hy, y1, count, pal) {
    for (let i = 0; i < count; i++) {
      const t = Math.pow(R(), 0.8), y = Math.round(hy + 2 + t * (y1 - hy - 3)), x = Math.round(R() * BW);
      const w = 1 + Math.round(t * 3 * (0.5 + R())), h = Math.max(1, Math.round(w * 0.6));
      b.rect(x, y, w, h, pal[1]); b.hl(x, x + w - 1, y, pal[2]); b.hl(x, x + w, y + h, pal[0]);
    }
  }
  function cloud(b, cx, cy, w, R, pal) {
    const puffs = [], n = 4 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) { const t = i / (n - 1); puffs.push({ x: cx - w / 2 + t * w, y: cy - Math.sin(t * Math.PI) * w * 0.12 - R() * w * 0.06, r: w * (0.12 + Math.sin(t * Math.PI) * 0.12 + R() * 0.05) }); }
    const bottom = cy + w * 0.06;
    for (let y = Math.floor(cy - w * 0.5); y <= bottom; y++) for (let x = Math.floor(cx - w * 0.75); x <= cx + w * 0.75; x++) {
      let inside = false, best = 1e9, bp = null;
      for (const p of puffs) { const d = Math.hypot(x - p.x, y - p.y); if (d < p.r) { inside = true; const dd = d / p.r; if (dd < best) { best = dd; bp = p; } } }
      if (!inside) continue;
      let c = pal[1];
      const dy = (y - bp.y) / bp.r, dx = (x - bp.x) / bp.r;
      if (dy + dx * 0.3 < -0.45) c = pal[2];
      if (y > bottom - 3 || dy > 0.55) c = pal[0];
      else if (y > bottom - 5 && ((x + y) & 1)) c = pal[0];
      const X = ((x % b.w) + b.w) % b.w;
      b.set(X, y, c);
    }
  }
  function cloudLayer(seed, n, yMin, yMax, pal, wMin, wMax) {
    const b = new Buf(BW * 2, 120), R = rng(seed);
    for (let i = 0; i < n; i++) cloud(b, (i + R() * 0.6) * (BW * 2 / n), yMin + R() * (yMax - yMin), wMin + R() * (wMax - wMin), R, pal);
    return b.canvas();
  }
  function sun(b, cx, cy, r, core, halo) {
    for (let y = cy - r * 2; y <= cy + r * 2; y++) for (let x = cx - r * 2; x <= cx + r * 2; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < r) b.set(x, y, core);
      else if (d < r * 1.5 && ((x + y) & 1)) b.tint(x, y, halo, 0.5);
      else if (d < r * 2 && (x & 1) && (y & 1)) b.tint(x, y, halo, 0.3);
    }
  }

  // ---- house row for the town backdrop ----
  function house(b, R, x, w, groundY, wallH, roofH, roofPal, haze) {
    const hz = c => haze ? mix(c, haze[0], haze[1]) : c;
    const wallTop = groundY - wallH;
    // roof (front slope, trapezoid with overhang)
    for (let y = wallTop - roofH; y < wallTop + 2; y++) {
      const t = (y - (wallTop - roofH)) / roofH, inset = Math.round((1 - Math.min(1, t)) * roofH * 0.5);
      for (let xx = x - 2 + inset; xx < x + w + 2 - inset; xx++) {
        const ly = (y - (wallTop - roofH)) % 4;
        let c = ly === 3 ? roofPal[0] : ly === 0 ? roofPal[3] : roofPal[2];
        if (xx === x - 2 + inset) c = roofPal[3]; if (xx === x + w + 1 - inset) c = roofPal[0];
        if (y >= wallTop) c = roofPal[0];
        if (y === wallTop - roofH) c = roofPal[0];
        b.set(xx, y, hz(c));
      }
    }
    // chimney
    if (R() < 0.6) { const cx = x + Math.floor(w * (0.2 + R() * 0.5)), ch = Math.floor(roofH * 0.9); for (let y = wallTop - roofH - 4; y < wallTop - roofH + ch * 0.5; y++) for (let xx = cx; xx < cx + 5; xx++) b.set(xx, y, hz(xx === cx ? P.K4 : xx === cx + 4 ? P.K1 : P.K3)); }
    // wall
    for (let y = wallTop + 2; y < groundY; y++) for (let xx = x; xx < x + w; xx++) {
      let c = P.P3;
      if (y > groundY - 5) c = ((xx + Math.floor(y / 2) * 3) % 6 === 0 || (y % 2 === 0)) ? P.K2 : P.K3;
      if (xx === x || xx === x + w - 1 || xx === x + 1) c = P.T1;
      if (y === wallTop + 2 || y === wallTop + 3) c = P.T1;
      b.set(xx, y, hz(c));
    }
    // windows & door
    const doorX = x + Math.floor(w / 2 - 4 + (R() - 0.5) * w * 0.3);
    for (let y = groundY - 17; y < groundY; y++) for (let xx = doorX; xx < doorX + 9; xx++) b.set(xx, y, hz(xx === doorX || xx === doorX + 8 || y === groundY - 17 ? P.T0 : ((xx - doorX) % 3 === 0 ? P.T2 : P.T3)));
    for (let wx = x + 5; wx + 9 < x + w - 3; wx += 16) {
      if (wx + 9 > doorX - 1 && wx < doorX + 10) continue;
      const wy = wallTop + 8;
      for (let y = wy; y < wy + 10; y++) for (let xx = wx; xx < wx + 9; xx++) {
        let c = (xx === wx || xx === wx + 8 || y === wy || y === wy + 9 || xx === wx + 4 || y === wy + 5) ? P.T1 : ((xx - wx) - (y - wy) > 1 && (xx - wx) - (y - wy) < 4 ? P.W4 : P.W1);
        b.set(xx, y, hz(c));
      }
    }
  }

  const BG = {};
  function buildBG(key) {
    const sky = new Buf(BW, BH), front = new Buf(BW, BH);
    let clouds = null, R = rng(key.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const SKY_DAY = ['#2040b8', '#2a4ec4', '#3460d0', '#3e70d8', '#4c80e0', '#5c92e8', '#70a6f0', '#88baf4', '#a4ccf8', '#c0dcf8'].map(H);
    const CLOUD = [H('#9cb0d8'), H('#dce8f8'), H('#ffffff')];
    const farMtn = { lt: H('#8c9cd4'), mid: H('#6c7cbc'), sh: H('#5664a4'), base: H('#98b0dc') };
    const snowC = { lt: H('#f0f4ff'), sh: H('#b8c4e8'), min: 34, d: 9 };
    const G_ = [P.G1, P.G2, P.G5];
    switch (key) {
      case 'road':
      case 'grass': {
        bands(sky, 0, 124, SKY_DAY);
        clouds = cloudLayer(11, 7, 18, 70, CLOUD, 40, 90);
        mountains(front, R, 108, 124, 7, 18, 52, farMtn, snowC);
        rolling(front, R, 112, 124, 9, { lt: H('#78b46c'), mid: H('#5c9c5c'), sh: H('#4c8454') });
        treeLine(front, R, 122, 126, 4, 7, { lt: P.G4, mid: P.G2, sh: P.G1 });
        groundStripes(front, 124, BH, P.G3, H('#48942c'), 420);
        if (key === 'road') {
          // horizontal dirt road across the fighting band
          for (let y = 142; y < 206; y++) {
            const edge = y < 146 || y > 201;
            for (let x = 0; x < BW; x++) {
              const j = Math.sin(x * 0.07 + y) * 1.5;
              if (y < 143 + j || y > 204 + j) continue;
              let c = ((Math.floor(420 / (y - 122)) & 1) ? P.D3 : mix(P.D3, P.D2, 0.35));
              if (edge) c = ((x + y) & 1) ? P.D1 : P.D2;
              if ((Math.abs(y - 160) < 2 || Math.abs(y - 186) < 2.5) && hsh(x >> 2, y, 3) < 0.7) c = P.D2;
              front.set(x, y, c);
            }
          }
          pebbles(front, R, 146, 200, 70, [P.D1, P.D4, P.D5]);
          tufts(front, R, 126, 142, 40, G_);
          tufts(front, R, 206, BH, 40, G_);
        } else {
          tufts(front, R, 126, BH, 150, G_);
          for (let i = 0; i < 26; i++) { const x = Math.floor(R() * BW), y = 150 + Math.floor(R() * 70); const c = [P.F1, P.F2, P.F3, P.F4][i % 4]; front.set(x, y, c); front.set(x + 1, y, c); front.set(x, y - 1, c); front.set(x + 1, y + 1, P.G1); }
        }
        break;
      }
      case 'forest': {
        bands(sky, 0, 130, ['#6ca44c', '#5c9444', '#4c843c', '#3e7434', '#30642c'].map(H));
        // distant trunks
        const trunkRow = (count, wMin, wMax, col, colL, y0, y1) => {
          for (let i = 0; i < count; i++) {
            const x = Math.floor(R() * BW), w = wMin + Math.floor(R() * (wMax - wMin));
            for (let y = y0; y < y1; y++) for (let xx = x; xx < x + w; xx++) front.set(xx, y, xx === x ? colL : ((xx - x) > w * 0.6 ? scale(col, 0.8) : col));
          }
        };
        trunkRow(26, 3, 6, H('#2c4c2c'), H('#3c6038'), 0, 130);
        treeLine(front, R, 40, 44, 12, 22, { lt: H('#4c8c3c'), mid: H('#2c6428'), sh: H('#1c4418') });
        trunkRow(12, 7, 13, H('#4c3420'), H('#6c4c2c'), 20, 140);
        // canopy overhead
        for (let x = 0; x < BW; x++) {
          const hgt = 22 + Math.sin(x * 0.05) * 8 + Math.sin(x * 0.13 + 1) * 5 + hsh(x >> 2, 0, 5) * 4;
          for (let y = 0; y < hgt; y++) {
            const l = hsh(x >> 1, y >> 1, 9);
            front.set(x, y, y > hgt - 3 ? P.J1 : l < 0.25 ? P.J4 : l < 0.6 ? P.J3 : P.J2);
          }
        }
        // light shafts
        for (const [sx, w] of [[70, 14], [190, 10], [260, 18]]) for (let y = 30; y < 150; y++) for (let x = sx + (y - 30) * 0.4; x < sx + w + (y - 30) * 0.4; x++) if (((Math.floor(x) + y) & 1) === 0) front.tint(x, y, H('#e8f0a0'), 0.18);
        treeLine(front, R, 134, 140, 6, 12, { lt: P.J5, mid: P.J3, sh: P.J2 });
        groundStripes(front, 136, BH, H('#467a2a'), H('#3e6e26'), 380);
        for (let i = 0; i < 260; i++) { const t = R(), y = Math.round(138 + t * 86), x = Math.floor(R() * BW); const c = [H('#6c5020'), H('#8c6c28'), P.J4, H('#a07830')][i % 4]; front.set(x, y, c); if (t > 0.4) front.set(x + 1, y, c); }
        tufts(front, R, 138, BH, 60, [P.J1, P.J3, P.J5]);
        break;
      }
      case 'hills': {
        bands(sky, 0, 126, SKY_DAY);
        clouds = cloudLayer(21, 6, 12, 60, CLOUD, 50, 100);
        mountains(front, R, 100, 126, 6, 30, 70, farMtn, snowC);
        rolling(front, R, 108, 126, 16, { lt: H('#8cbc70'), mid: H('#6ca060'), sh: H('#588858') });
        rolling(front, R, 120, 128, 12, { lt: P.G5, mid: P.G4, sh: P.G3 });
        boulderBG(front, 44, 124, 6); boulderBG(front, 54, 126, 4); boulderBG(front, 236, 121, 8); boulderBG(front, 296, 127, 5);
        groundStripes(front, 128, BH, P.G3, H('#48942c'), 400);
        tufts(front, R, 130, BH, 110, G_);
        pebbles(front, R, 132, BH, 30, [P.K1, P.K3, P.K4]);
        break;
      }
      case 'desert': {
        bands(sky, 0, 130, ['#3a70c8', '#4c84cc', '#6498d0', '#80acd4', '#a0bcd0', '#c4ccc4', '#dcd4b4', '#ecd8a4'].map(H));
        sun(sky, 250, 38, 11, H('#fffbe0'), H('#fff0b0'));
        clouds = cloudLayer(31, 3, 20, 50, [H('#d8c8b8'), H('#f4ece0'), H('#ffffff')], 40, 70);
        mesas(front, R, 124, 4, { top: H('#f0d0a0'), lt: H('#d8a070'), mid: H('#bc8058'), sh: H('#9c6448') });
        rolling(front, R, 122, 132, 10, { lt: P.S4, mid: P.S3, sh: P.S2 });
        groundStripes(front, 130, BH, P.S2, H('#d2b474'), 380);
        const dw = (x, y) => { const d = 700 / (y - 128); return d + Math.sin(x * 0.02 + d * 0.8) * 0.55 + Math.sin(x * 0.057 + d * 1.9) * 0.15; };
        for (let y = 146; y < BH; y++) for (let x = 0; x < BW; x++) {
          const a = Math.floor(dw(x, y)), c = Math.floor(dw(x, y + 1)), u = Math.floor(dw(x, y - 1));
          if (a !== c) front.set(x, y, P.S4); else if (a !== u && y > 170) front.set(x, y, P.S1);
        }
        pebbles(front, R, 134, BH, 30, [P.B1, P.B3, P.B4]);
        tufts(front, R, 136, BH, 16, [P.S0, P.H1, P.H3]);
        break;
      }
      case 'bridge':
      case 'river': {
        bands(sky, 0, 112, SKY_DAY);
        clouds = cloudLayer(41, 7, 14, 64, CLOUD, 40, 90);
        mountains(front, R, 96, 112, 6, 16, 48, farMtn, snowC);
        treeLine(front, R, 108, 114, 4, 8, { lt: H('#5c9c4c'), mid: H('#3c7c3c'), sh: H('#2c5c30') });
        // water band
        const wy0 = 113, wy1 = key === 'river' ? 146 : 224;
        bands(front, wy0, wy1, [H('#78a8e8'), P.W4, P.W3, H('#3068c8'), P.W2, H('#1e46a8')].slice(0, key === 'river' ? 6 : 6));
        for (let i = 0; i < 160; i++) { const t = R(), y = Math.round(wy0 + 2 + t * (wy1 - wy0 - 3)), x = Math.floor(R() * BW), l = 2 + Math.round(t * 8); front.hl(x, x + l, y, t < 0.3 ? P.W6 : P.W5); front.hl(x + 1, x + l - 1, y + 1, P.W2); }
        if (key === 'river') {
          // near bank
          for (let x = 0; x < BW; x++) { const e = 146 + Math.round(Math.sin(x * 0.04) * 2 + hsh(x >> 2, 0, 1) * 2); front.set(x, e - 1, P.W6); for (let y = e; y < BH; y++) front.set(x, y, y < e + 3 ? P.D1 : y < e + 4 ? P.G2 : P.G3); }
          groundStripes(front, 150, BH, P.G3, H('#48942c'), 300);
          tufts(front, R, 152, BH, 90, G_);
          // reeds
          for (let i = 0; i < 18; i++) { const x = Math.floor(R() * BW), h = 6 + Math.floor(R() * 8); for (let j = 0; j < h; j++) front.set(x + (j > h - 3 ? 1 : 0), 150 - j, P.G2); front.rect(x, 150 - h, 2, 3, P.D1); }
        } else {
          // back rail
          const rail = (y, h) => { for (let x = 0; x < BW; x++) { front.set(x, y, P.T4); front.set(x, y + 1, P.T3); front.set(x, y + 2, P.T1); } for (let x = 6; x < BW; x += 40) for (let yy = y - 4; yy < y + h; yy++) for (let xx = x; xx < x + 5; xx++) front.set(xx, yy, xx === x ? P.T4 : xx === x + 4 ? P.T0 : P.T2); };
          // deck
          for (let y = 140; y < 212; y++) {
            const z = y - 110, idx = Math.floor(2400 / z);
            for (let x = 0; x < BW; x++) {
              let c = (idx & 1) ? P.T3 : mix(P.T3, P.T4, 0.35);
              const prev = Math.floor(2400 / (z - 1));
              if (prev !== idx) c = P.T1;
              if (hsh(x >> 3, idx, 4) < 0.06) c = P.T2;
              front.set(x, y, c);
            }
          }
          for (let x = 0; x < BW; x++) { front.set(x, 212, P.T1); front.set(x, 213, P.T0); for (let y = 214; y < 218; y++) front.tint(x, y, P.W0, 0.5); }
          rail(128, 12); rail(136, 4);
          for (let x = 0; x < BW; x++) front.set(x, 139, P.T0);
        }
        break;
      }
      case 'town': {
        bands(sky, 0, 128, SKY_DAY);
        clouds = cloudLayer(51, 6, 10, 50, CLOUD, 40, 80);
        mountains(front, R, 92, 128, 5, 14, 40, farMtn, null);
        // church tower (back)
        const tx = 204;
        for (let y = 30; y < 128; y++) for (let x = tx; x < tx + 24; x++) front.set(x, y, mix(x < tx + 3 ? P.K4 : x > tx + 20 ? P.K2 : P.K3, H('#a4c0e8'), 0.35));
        for (let y = 4; y < 32; y++) { const w = (y - 4) / 28 * 15; for (let x = Math.round(tx + 12 - w); x < tx + 12 + w; x++) front.set(x, y, mix(x < tx + 12 ? P.Q3 : P.Q1, H('#a4c0e8'), 0.35)); }
        front.vl(tx + 12, 0, 4, P.Y2); front.hl(tx + 10, tx + 14, 1, P.Y2);
        for (let y = 44; y < 58; y++) for (let x = tx + 8; x < tx + 16; x++) front.set(x, y, mix(P.K0, H('#a4c0e8'), 0.35));
        // back row of houses (hazy)
        let x = -10;
        while (x < BW) { const w = 34 + Math.floor(R() * 26); house(front, R, x, w, 128, 22 + Math.floor(R() * 10), 14 + Math.floor(R() * 8), R() < 0.5 ? RPAL : QPAL, [H('#a4c0e8'), 0.42]); x += w + 6 + Math.floor(R() * 10); }
        // front row
        x = -20;
        while (x < BW) { const w = 50 + Math.floor(R() * 30); house(front, R, x, w, 134, 34 + Math.floor(R() * 8), 18 + Math.floor(R() * 8), R() < 0.6 ? RPAL : QPAL, null); x += w + 22 + Math.floor(R() * 20); }
        // cobble ground
        for (let y = 134; y < BH; y++) {
          const z = y - 100, row = Math.floor(1800 / z), rowPrev = Math.floor(1800 / (z - 1));
          const bw = Math.max(4, z * 0.5);
          for (let x = 0; x < BW; x++) {
            const off = (row & 1) * bw * 0.5;
            const lx = ((x + off) % bw);
            const sv = hsh(Math.floor((x + off) / bw), row, 3);
            let c = sv < 0.4 ? P.K3 : sv < 0.75 ? mix(P.K3, P.B3, 0.5) : P.B3;
            if (rowPrev !== row) c = P.K1;
            else if (lx < 1) c = P.K1;
            else if (lx < 2) c = lighten(c, 0.2);
            front.set(x, y, c);
          }
        }
        for (let x2 = 0; x2 < BW; x2++) { front.set(x2, 134, P.K0); front.set(x2, 135, P.K2); }
        break;
      }
      case 'fort': {
        bands(sky, 0, 132, ['#4c68a8', '#5874b0', '#6480b8', '#728cbc', '#8098c0', '#90a4c4', '#a4b4c8'].map(H));
        clouds = cloudLayer(61, 6, 10, 60, [H('#8894b0'), H('#c4cce0'), H('#e8ecf4')], 50, 100);
        mountains(front, R, 96, 132, 6, 14, 44, { lt: H('#8290bc'), mid: H('#6878a8'), sh: H('#586494'), base: H('#8c9cc0') }, null);
        const wallTop = 76, wallBot = 132;
        const block = (x0, y0, x1, y1, tone) => {
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const row = Math.floor((y - y0) / 7), ly = (y - y0) % 7, lx = (x + (row & 1) * 8) % 16;
            const sv = hsh(Math.floor((x + (row & 1) * 8) / 16), row, x0);
            let c = sv < 0.5 ? P.K3 : mix(P.K3, P.B3, 0.4);
            if (ly === 6 || lx === 15) c = P.K1; else if (ly === 0 || lx === 0) c = lighten(c, 0.2);
            if (tone) c = scale(c, tone);
            front.set(x, y, c);
          }
        };
        block(0, wallTop, BW, wallBot, 0.92);
        for (let x = 0; x < BW; x += 20) block(x, wallTop - 10, x + 11, wallTop, 0.92);
        for (let x = 0; x < BW; x++) { front.set(x, wallTop, P.K4); front.set(x, wallTop + 1, P.K2); }
        for (const tx of [30, 250]) {
          block(tx, 36, tx + 44, wallBot, 1);
          for (let x = tx; x < tx + 44; x += 12) block(x, 26, x + 7, 36, 1);
          front.hl(tx, tx + 43, 36, P.K5);
          for (let y = 56; y < 78; y++) { front.set(tx + 21, y, P.K0); front.set(tx + 22, y, P.K0); }
          front.vl(tx + 22, 2, 26, P.T1);
          for (let y = 4; y < 16; y++) for (let x = tx + 23; x < tx + 23 + 18 - (y - 4) * 0.4; x++) front.set(x, y, ((y + Math.floor(x / 3)) & 1) ? P.C2 : P.C3);
        }
        for (let x = 110; x < 210; x += 34) for (let y = 92; y < 108; y++) front.set(x, y, P.K0);
        // gate
        for (let y = 94; y < 132; y++) for (let x = 140; x < 180; x++) { const dx = x - 160, dy = y - 108; if (dy < 0 && Math.hypot(dx, dy) > 20) continue; front.set(x, y, (Math.abs(dx) > 17 || (dy < 0 && Math.hypot(dx, dy) > 17)) ? P.K4 : ((x & 3) === 0 || (y % 6 === 0)) ? P.K0 : P.K1); }
        // flagstone floor with perspective grid
        for (let y = 132; y < BH; y++) {
          const z = y - 96, row = Math.floor(1500 / z), rp = Math.floor(1500 / (z - 1));
          for (let x = 0; x < BW; x++) {
            const u = (x - 160) / z * 12, col = Math.floor(u / 10 + (row & 1) * 0.5), lu = ((u / 10 + (row & 1) * 0.5) % 1 + 1) % 1;
            const sv = hsh(col, row, 7);
            let c = sv < 0.4 ? P.K3 : sv < 0.75 ? mix(P.K3, P.B3, 0.5) : P.K4;
            if (rp !== row) c = P.K1; else if (lu < 0.05) c = P.K2;
            if (hsh(x, y, 5) < 0.02) c = P.G2;
            front.set(x, y, c);
          }
        }
        for (let x = 0; x < BW; x++) front.set(x, 132, P.K0);
        break;
      }
      case 'indoor': {
        // ceiling beams
        bands(sky, 0, BH, [H('#1c1410')]);
        for (let y = 0; y < 26; y++) for (let x = 0; x < BW; x++) front.set(x, y, (x % 64 < 12) ? (y < 24 ? P.T2 : P.T0) : (y % 5 === 4 ? P.T0 : P.T1));
        // wall
        for (let y = 26; y < 132; y++) for (let x = 0; x < BW; x++) {
          let c;
          if (y < 96) { c = hsh(x, y, 3) < 0.05 ? P.P1 : P.P2; if (x % 64 < 8) c = x % 64 < 2 ? P.T4 : P.T2; if (y === 60 || y === 61) c = P.T2; }
          else if (y < 99) c = y === 96 ? P.T5 : P.T1;
          else { const lx = x % 32; c = lx < 2 ? P.T1 : lx < 3 ? P.T4 : P.T2; if (y > 128) c = P.T0; if (y === 100) c = P.T3; }
          front.set(x, y, c);
        }
        // windows
        for (const wx of [24, 216]) {
          for (let y = 32; y < 84; y++) for (let x = wx; x < wx + 44; x++) {
            let c = (x - wx < 3 || wx + 44 - x <= 3 || y < 35 || y > 80) ? P.T1 : (x === wx + 21 || x === wx + 22 || y === 57 || y === 58) ? P.T2 : ((x - wx) + (y - 32) * 0.6 < 40 && (x - wx) + (y - 32) * 0.6 > 30 ? P.W5 : P.W4);
            front.set(x, y, c);
          }
          for (let x = wx - 3; x < wx + 47; x++) { front.set(x, 84, P.T4); front.set(x, 85, P.T1); }
        }
        // shelf with pots and a tapestry
        for (let x = 110; x < 210; x++) { front.set(x, 58, P.T4); front.set(x, 59, P.T1); }
        for (let i = 0; i < 6; i++) { const x = 116 + i * 16, h = 8 + (i % 3) * 3, c = [P.R3, P.W2, P.K3, P.Y2, P.G3, P.C2][i]; for (let y = 58 - h; y < 58; y++) for (let xx = x; xx < x + 9; xx++) front.set(xx, y, xx === x ? lighten(c, 0.3) : xx > x + 6 ? scale(c, 0.7) : c); }
        for (let y = 64; y < 92; y++) for (let x = 138; x < 182; x++) { let c = ((x - 138) % 11 === 5 || (y - 64) % 9 === 4) ? P.Y2 : P.C2; if (x < 140 || x > 179) c = P.Y1; front.set(x, y, c); }
        // plank floor in perspective
        for (let y = 132; y < BH; y++) {
          const z = y - 92;
          for (let x = 0; x < BW; x++) {
            const u = (x - 160) * 40 / z, pl = Math.floor(u / 16), lu = ((u / 16) % 1 + 1) % 1;
            const row = Math.floor(3000 / z) + (pl & 1) * 3, rp = Math.floor(3000 / (z - 1)) + (pl & 1) * 3;
            let c = hsh(pl, Math.floor(row / 6), 2) < 0.5 ? P.T3 : mix(P.T3, P.T4, 0.35);
            if (lu < 0.07) c = P.T1; else if (lu > 0.93) c = P.T2;
            if (Math.floor(row / 6) !== Math.floor(rp / 6)) c = P.T1;
            front.set(x, y, c);
          }
        }
        for (let x = 0; x < BW; x++) { front.set(x, 132, P.T0); front.set(x, 133, P.T1); }
        break;
      }
      case 'castle': {
        bands(sky, 0, BH, [H('#141424')]);
        for (let y = 0; y < 138; y++) for (let x = 0; x < BW; x++) {
          const row = Math.floor(y / 8), ly = y % 8, lx = (x + (row & 1) * 10) % 20;
          const sv = hsh(Math.floor((x + (row & 1) * 10) / 20), row, 1);
          let c = sv < 0.5 ? H('#4c5068') : H('#44485e');
          if (ly === 7 || lx === 19) c = H('#24263a'); else if (ly === 0) c = H('#5c6078');
          front.set(x, y, c);
        }
        // tall arched windows
        for (const wx of [58, 138, 218]) for (let y = 20; y < 110; y++) for (let x = wx; x < wx + 26; x++) {
          const dx = x + 0.5 - (wx + 13), dy = y - 33;
          if (dy < 0 && Math.hypot(dx, dy) > 13) continue;
          const inner = dy < 0 ? Math.hypot(dx, dy) < 10.5 : Math.abs(dx) < 10.5 && y < 106;
          let c = inner ? ((((x - wx) + y * 0.5) % 9 < 3) ? H('#b0d0f8') : H('#7ca4e0')) : H('#8c90a8');
          if (inner && (x === wx + 13 || (y - 20) % 18 === 0)) c = H('#303450');
          front.set(x, y, c);
        }
        // light cast from windows
        for (const wx of [58, 138, 218]) for (let y = 110; y < 200; y++) for (let x = wx - 10 + (y - 110) * 0.3; x < wx + 36 + (y - 110) * 0.3; x++) if (((Math.floor(x) + y) & 1) === 0) front.tint(x, y, H('#c8dcff'), 0.1);
        // columns
        for (const cx of [20, 110, 200, 290]) {
          for (let y = 0; y < 140; y++) for (let x = cx - 12; x < cx + 12; x++) {
            let c = x < cx - 8 ? H('#9ca0b8') : x < cx - 2 ? H('#80849c') : x < cx + 6 ? H('#686c84') : H('#4c5068');
            if ((x - cx + 12) % 6 === 0) c = scale(c, 0.8);
            if (y > 126 || y < 8) c = y === 127 || y === 7 ? H('#b8bcd0') : H('#707490');
            front.set(x, y, c);
          }
        }
        // banners
        for (let x = 0; x < BW; x++) { for (let y = 0; y < 6; y++) front.set(x, y, y === 5 ? H('#24263a') : y === 0 ? H('#9ca0b8') : (x % 8 < 4 ? H('#707490') : H('#5c6078'))); front.set(x, 6, P.Y1); }
        for (const bx of [150]) for (let y = 8; y < 64; y++) for (let x = bx - 12; x < bx + 12 && y < 64 - Math.abs(x - bx) * 0.6; x++) {
          let c = Math.abs(x - bx) > 9 ? P.Y2 : P.C2;
          if (Math.hypot(x - bx, y - 30) < 6 && Math.hypot(x - bx, y - 30) > 4) c = P.Y3;
          front.set(x, y, c);
        }
        // marble floor
        for (let y = 138; y < BH; y++) {
          const z = y - 100;
          for (let x = 0; x < BW; x++) {
            const u = (x - 160) * 30 / z, col = Math.floor(u / 24), row = Math.floor(1200 / z);
            let c = ((col + row) & 1) ? H('#c4c4d0') : H('#6c6c84');
            if (Math.floor(1200 / (z - 1)) !== row) c = H('#34344c');
            front.set(x, y, c);
          }
        }
        // carpet runner
        for (let y = 158; y < 200; y++) for (let x = 0; x < BW; x++) {
          let c = P.C2;
          if (y < 161 || y > 196) c = P.Y2; if (y === 158 || y === 199) c = P.C0;
          if (y > 163 && y < 194 && (((x >> 3) + (y >> 3)) & 1) && (x % 8 === 3 || y % 8 === 3)) c = P.C3;
          front.set(x, y, c);
        }
        for (let x = 0; x < BW; x++) { front.set(x, 138, H('#20202c')); front.dk(x, 200, 0.6); front.dk(x, 201, 0.75); }
        break;
      }
      case 'night': {
        bands(sky, 0, 128, ['#060818', '#0a0e24', '#0e1430', '#141c40', '#1a244c', '#222e58', '#2c3a64'].map(H));
        const Rs = rng(77);
        for (let i = 0; i < 140; i++) { const x = Math.floor(Rs() * BW), y = Math.floor(Rs() * 110), br = Rs(); sky.set(x, y, br > 0.9 ? H('#ffffff') : br > 0.5 ? H('#b8c4f0') : H('#6c78b0')); if (br > 0.96) { sky.set(x - 1, y, H('#6c78b0')); sky.set(x + 1, y, H('#6c78b0')); sky.set(x, y - 1, H('#6c78b0')); sky.set(x, y + 1, H('#6c78b0')); } }
        for (let y = 12; y < 64; y++) for (let x = 220; x < 280; x++) {
          const d = Math.hypot(x - 250, y - 38);
          if (d < 14) { let c = H('#f0ecc8'); if (Math.hypot(x - 245, y - 34) < 3 || Math.hypot(x - 255, y - 42) < 2.5 || Math.hypot(x - 253, y - 32) < 1.5) c = H('#c8c4a4'); if (d > 12 && x > 250) c = H('#d0cca8'); sky.set(x, y, c); }
          else if (d < 24 && ((x + y) & 1)) sky.tint(x, y, H('#8890c0'), 0.3 * (1 - (d - 14) / 10));
        }
        clouds = cloudLayer(71, 3, 60, 90, [H('#10183a'), H('#1c2650'), H('#2c3866')], 40, 70);
        mountains(front, R, 108, 128, 6, 14, 40, { lt: H('#1c2448'), mid: H('#161c3c'), sh: H('#121632'), base: H('#141a38') }, null);
        pinesLine(front, R, 126, 130, 10, 22, { lt: H('#14283c'), mid: H('#0e1e30'), sh: H('#0a1624') });
        groundStripes(front, 128, BH, H('#1c3c34'), H('#18342e'), 400);
        tufts(front, R, 130, BH, 100, [H('#0c201c'), H('#244840'), H('#3c6c5c')]);
        break;
      }
      default: return buildBG('grass');
    }
    return { sky: sky.canvas(), clouds, front: front.canvas() };
  }
  G.BG_KEYS = ['grass', 'road', 'forest', 'hills', 'desert', 'river', 'bridge', 'town', 'fort', 'indoor', 'castle', 'night'];
  G.drawBattleBG = function (ctx, key, t) {
    key = G.BG_KEYS.includes(key) ? key : 'grass';
    let bg = BG[key]; if (!bg) bg = BG[key] = buildBG(key);
    t = t || 0;
    ctx.drawImage(bg.sky, 0, 0);
    if (bg.clouds) {
      const o = Math.floor(t * 0.08) % (BW * 2);
      ctx.drawImage(bg.clouds, -o, 0); ctx.drawImage(bg.clouds, BW * 2 - o, 0);
    }
    ctx.drawImage(bg.front, 0, 0);
    if (key === 'river' || key === 'bridge') {
      // water glints
      const ph = Math.floor(t / 18);
      ctx.fillStyle = '#f0fcff';
      for (let i = 0; i < 12; i++) {
        const x = Math.floor(hsh(i, ph, 3) * BW), y = key === 'river' ? 116 + Math.floor(hsh(ph, i, 5) * 28) : 114 + Math.floor(hsh(ph, i, 5) * 12);
        ctx.fillRect(x, y, 2 + (i % 3), 1);
      }
    }
  };
})();
