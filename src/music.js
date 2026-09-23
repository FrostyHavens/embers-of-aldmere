// ===== Music: original compositions for "Embers of Aldmere" =====
// All melodies, basslines and progressions here are original. Lead lines are
// hand-written MML ('|' marks bar lines; the parser ignores it). Accompaniment
// (bass, arpeggios, pads) is generated from chord progressions by the helpers
// below so harmony always matches the written chords.
'use strict';
(function () {
  const S = G.audio.songs;

  // ---------- helpers ----------
  const NN = ['c', 'c+', 'd', 'd+', 'e', 'f', 'f+', 'g', 'g+', 'a', 'a+', 'b'];
  const LENS = [[4, '1'], [3, '2.'], [2, '2'], [1.5, '4.'], [1, '4'], [0.75, '8.'], [0.5, '8'], [1 / 3, '12'], [0.25, '16'], [1 / 6, '24'], [0.125, '32']];
  function lenStr(b) {
    const out = []; let rem = b;
    while (rem > 1e-6) { const L = LENS.find(l => l[0] <= rem + 1e-6); if (!L) break; out.push(L[1]); rem -= L[0]; }
    return out;
  }
  function note(m, beats) {
    const ls = lenStr(beats);
    return 'o' + (Math.floor(m / 12) - 1) + NN[((m % 12) + 12) % 12] + ls[0] + ls.slice(1).map(l => '&' + l).join('') + ' ';
  }
  function rest(beats) { return lenStr(beats).map(l => 'r' + l).join('') + ' '; }

  const PCN = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function pcOf(letter, acc) { let p = PCN[letter.toLowerCase()]; if (acc === '#') p++; else if (acc === 'b') p--; return (p + 12) % 12; }
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
    sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], m7b5: [0, 3, 6, 10], aug: [0, 4, 8], '6': [0, 4, 7, 9],
  };
  function chord(sym) {
    const [main, bass] = sym.split('/');
    const m = /^([A-G])([#b]?)(.*)$/.exec(main);
    if (!m || !QUAL[m[3]]) throw new Error('bad chord ' + sym);
    const root = pcOf(m[1], m[2]);
    return { root, iv: QUAL[m[3]], bass: bass ? pcOf(bass[0], bass.slice(1)) : root };
  }
  // "D | Bm | G A | ..." -> segments; chords in a bar split it evenly, '.' extends the previous chord
  function prog(str, bpb = 4) {
    const segs = [];
    str.split('|').forEach(bar => {
      const syms = bar.trim().split(/\s+/).filter(Boolean);
      const each = bpb / syms.length;
      syms.forEach(s => { if (s === '.') segs[segs.length - 1].beats += each; else segs.push({ ch: chord(s), beats: each }); });
    });
    return segs;
  }
  function nearest(pc, target, lo, hi) {
    let best = null;
    for (let m = lo; m <= hi; m++) if (((m % 12) + 12) % 12 === pc && (best === null || Math.abs(m - target) < Math.abs(best - target))) best = m;
    return best;
  }
  function lenBeats(n, dot) { return (4 / n) * (dot ? 1.5 : 1); }

  // Pattern track. tokens: <sym>[:]<len>[.]  sym: 0-9 chord-tone index (wraps up octaves),
  // R root (slash bass), O root+12, L fifth below, N root-1, U root+2, x rest.
  function pat(segs, tokens, base) {
    const toks = tokens.trim().split(/\s+/).map(t => {
      const m = /^([0-9]|[ROLNUx]):?(\d+)(\.?)$/.exec(t); if (!m) throw new Error('bad token ' + t);
      return { s: m[1], b: lenBeats(+m[2], !!m[3]) };
    });
    let out = '', prev = base;
    for (const seg of segs) {
      const ch = seg.ch;
      const r = nearest(ch.root, prev, base - 7, base + 7);
      const br = nearest(ch.bass, r, r - 6, r + 5);
      let t = 0, k = 0;
      while (t < seg.beats - 1e-6) {
        const tk = toks[k++ % toks.length]; const d = Math.min(tk.b, seg.beats - t);
        let m;
        switch (tk.s) {
          case 'x': m = null; break;
          case 'R': m = br; break;
          case 'O': m = br + 12; break;
          case 'L': m = r - 5; break;
          case 'N': m = br - 1; break;
          case 'U': m = br + 2; break;
          default: { const i = +tk.s, n = ch.iv.length; m = r + ch.iv[i % n] + 12 * Math.floor(i / n); }
        }
        out += m === null ? rest(d) : note(m, d);
        t += d;
      }
      prev = r;
    }
    return out;
  }

  // Voice-led chord voices: returns n MML strings (lowest voice first).
  // rhythm: optional tokens n<len> (play) / x<len> (rest), cycled per chord.
  function voices(segs, n, center, rhythm) {
    const rt = rhythm ? rhythm.trim().split(/\s+/).map(t => {
      const m = /^([nx]):?(\d+)(\.?)$/.exec(t); if (!m) throw new Error('bad rhythm ' + t);
      return { play: m[1] === 'n', b: lenBeats(+m[2], !!m[3]) };
    }) : null;
    const outs = new Array(n).fill('');
    let prev = null;
    for (const seg of segs) {
      const ch = seg.ch;
      const pcs = ch.iv.map(i => (ch.root + i) % 12);
      const req = [];
      if (ch.iv[1] === 3 || ch.iv[1] === 4) req.push(pcs[1]);
      if (n >= 3 && pcs.length >= 4) req.push(pcs[3]);
      const cand = [];
      for (let m = center - 9; m <= center + 9; m++) if (pcs.includes(m % 12)) cand.push(m);
      let best = null, bestCost = Infinity;
      const pick = (start, acc) => {
        if (acc.length === n) {
          const pset = acc.map(m => m % 12);
          if (new Set(pset).size < n) return;
          if (!req.every(p => pset.includes(p))) return;
          if (acc[n - 1] - acc[0] > 12) return;
          let cost = 0;
          for (let i = 0; i < n; i++) cost += prev ? Math.abs(acc[i] - prev[i]) : Math.abs(acc[i] - center);
          for (let i = 1; i < n; i++) if (acc[i] - acc[i - 1] <= 2) cost += 3;
          const mean = acc.reduce((a, b) => a + b, 0) / n; cost += 0.3 * Math.abs(mean - center);
          if (cost < bestCost) { bestCost = cost; best = acc.slice(); }
          return;
        }
        for (let i = start; i < cand.length; i++) { acc.push(cand[i]); pick(i + 1, acc); acc.pop(); }
      };
      pick(0, []);
      if (!best) throw new Error('no voicing');
      for (let v = 0; v < n; v++) {
        if (!rt) { outs[v] += note(best[v], seg.beats); continue; }
        let t = 0, k = 0;
        while (t < seg.beats - 1e-6) {
          const tk = rt[k++ % rt.length]; const d = Math.min(tk.b, seg.beats - t);
          outs[v] += tk.play ? note(best[v], d) : rest(d); t += d;
        }
      }
      prev = best;
    }
    return outs;
  }
  const rep = (s, n) => new Array(n + 1).join(s);
  const cat = (...a) => [].concat(...a);

  // =====================================================================
  // TITLE — D major, heroic march. Intro 2 | A 8 | B 8 | bVI-bVII turn 2
  // =====================================================================
  {
    const P = prog('D | Asus4 A | D | Bm | G | A | D | F#m | G A | D | G | A | F#m | Bm | Em | A | Bm G | A | Bb | C');
    const mel =
      'o4 a8. a16 o5 d4 d8. e16 f+4 | o5 e4. d8 c+2 |' +
      'o5 d4. a8 a4 b8 a8 | o5 f+4. e8 d4 f+4 | o5 g4. f+8 e4 d4 | o5 e4 c+8 d8 e2 |' +
      'o5 d4. a8 a4 o6 d8 c+8 | o6 c+4. o5 a8 f+4 a4 | o5 b4 o6 d4 c+4 e4 | o6 d2 o5 a4 f+4 |' +
      'o5 g4. a8 b4 g4 | o5 a4. g8 f+4 e4 | o5 f+4. e8 f+4 a4 | o5 b2 f+2 |' +
      'o5 g4. f+8 e4 g4 | o5 a4. b8 a4 e4 | o5 f+4 d4 g4 b4 | o5 a2&a8 e8 f+8 g8 |' +
      'o5 f4. d8 f4 b-4 | o5 g4. e8 g8 a8 g8 e8 |';
    const pad = voices(P, 2, 63);
    const N = '@kick c4 @snare c8 c16 c16 @kick c4 @snare c4 |';
    const C = '@crash c4 @snare c8 c16 c16 @kick c4 @snare c4 |';
    const F = '@snare c16 c16 c16 c16 c8 c8 @tom o3 a8 f8 d8 o2 a8 |';
    S.title = {
      tempo: 112, loop: true, tracks: [
        { inst: 'brass', mml: 'v13 q7 ' + mel },
        { inst: 'strings', mml: 'v9 q8 ' + pad[1] },
        { inst: 'strings', mml: 'v8 q8 ' + pad[0] },
        { inst: 'harp', mml: 'v8 ' + pat(P, '0:8 1:8 2:8 3:8 4:8 3:8 2:8 1:8', 57) },
        { inst: 'bass', mml: 'v12 q6 ' + pat(P, 'R:4 O:8 R:8 2:4 O:8 R:8', 43) },
        { inst: 'kick', mml: 'v11 ' + C + N + C + `[${N}]6 ` + F + C + `[${N}]6 ` + F + C + F },
      ],
    };
  }

  // =====================================================================
  // BATTLE — E minor, driving. Intro 2 | A 8 | B 8 | C 8
  // =====================================================================
  {
    const P = prog('Em | C D | Em | C | D | B | Em | C | Am B7 | Em | G | D | Em | C | G | D | C | B | C | D | Em | Em | C | D | B | B7');
    const mel =
      'r1 | r2 o4 b8 o5 d8 e8 f+8 |' +
      'o5 e8 g8 b4 a8 g8 f+8 g8 | o5 e4. c8 e8 g8 o6 c4 | o5 b8 a8 f+8 a8 d8 f+8 a4 | o5 f+4. d+8 f+4 b4 |' +
      'o5 e8 g8 b4 a8 g8 f+8 g8 | o5 e4. c8 e8 g8 o6 c8 d8 | o6 e4 c8 o5 a8 b4 a8 f+8 | o5 e2 r8 e8 f+8 g8 |' +
      'o5 b2 a8 g8 a8 b8 | o5 a4. f+8 d4 f+8 a8 | o5 b4. o6 c8 d4 e4 | o6 e4. d8 c4 o5 g4 |' +
      'o5 b2 a8 g8 a8 b8 | o5 a4. f+8 d4 a4 | o5 g4. a8 b4 o6 c4 | o6 d+2 o5 b4 f+4 |' +
      'o5 e16 f+16 g8 g8 e8 g8 a8 g8 e8 | o5 f+16 g16 a8 a8 f+8 a8 b8 a8 f+8 | o5 g16 a16 b8 b8 g8 b8 o6 c8 d8 e8 | o6 e4. d8 e8 d8 o5 b4 |' +
      'o6 c4. o5 b8 a8 g8 e4 | o5 d8 f+8 a8 o6 d8 c8 o5 a8 f+8 d8 | o5 d+4. f+8 b4 a4 | o5 b2. r4 |';
    const A = P.slice(0, 20), Cs = P.slice(20); // segments: bars 1-18 have 20 segs (2 split bars)
    const pad = voices(P, 2, 64);
    const N = '@kick c8 r8 @snare c8 @kick c8 c8 r8 @snare c8 r8 |';
    const C = '@crash c8 r8 @snare c8 @kick c8 c8 r8 @snare c8 r8 |';
    const F = '@snare c16 c16 c8 c16 c16 c8 @tom o4 c16 c16 o3 a8 f8 d8 |';
    S.battle = {
      tempo: 148, loop: true, tracks: [
        { inst: 'lead', mml: 'v13 q6 ' + mel },
        { inst: 'strings', mml: 'v8 q8 ' + pad[1] },
        { inst: 'harp', mml: 'v8 ' + pat(P, '0:8 1:8 2:8 1:8 3:8 2:8 1:8 2:8', 59) },
        { inst: 'bass', mml: 'v12 q5 ' + pat(A, 'R:8 R:8 O:8 R:8 R:8 R:8 O:8 R:8', 40) + pat(Cs, 'R:8 O:8 R:8 O:8 2:8 O:8 R:8 O:8', 40) },
        { inst: 'kick', mml: 'v11 ' + C + F + C + `[${N}]6 ` + F + C + `[${N}]6 ` + F + C + `[${N}]6 ` + F },
        { inst: 'hat', mml: '[[v9 c8 v5 c8]4 |]26' },
      ],
    };
  }

  // =====================================================================
  // BOSS — D minor, dark & heavy. Intro 4 | A 8 | B 8
  // =====================================================================
  {
    const P = prog('Dm | Bb | Dm | A | Dm | Bb | Gm | A | Dm | Bb | Eb | A7 | Gm | Dm | Eb | Bb | Gm | A | Bb | A');
    const mel =
      'r1 | r1 | r1 | r2 o4 a8 b-8 o5 c+8 e8 |' +
      'o5 d2. c+8 d8 | o5 f4. e8 d4 o4 b-4 | o4 g4 b-4 o5 d4 g4 | o5 f2 e4 c+4 |' +
      'o5 a2. g+8 a8 | o6 d4. c8 o5 b-4 f4 | o5 g4. f8 e-4 b-4 | o5 a4. g8 e4 c+4 |' +
      'o5 d8. d16 d8 f8 e8 d8 c8 o4 b-8 | o4 a4. b-8 a4 f4 | o4 g8. g16 g8 b-8 o5 e-8 d8 c8 o4 b-8 | o5 d4. c8 d4 f4 |' +
      'o5 g4. f8 d4 o4 b-4 | o4 a4 b-4 o5 c+4 e4 | o5 f4. e8 f4 g4 | o5 a2. r4 |';
    const pad = voices(P, 2, 60);
    const N = '@kick c8 c8 @snare c8 @kick c8 r8 c8 @snare c8 c16 c16 |';
    const C = '@crash c8 @kick c8 @snare c8 @kick c8 r8 c8 @snare c8 c16 c16 |';
    const F = '@snare c8 c8 c16 c16 c8 @tom o3 c8 o2 a8 f8 d8 |';
    S.boss = {
      tempo: 136, loop: true, tracks: [
        { inst: 'brass', mml: 'v13 q7 ' + mel },
        { inst: 'strings', mml: 'v9 q8 ' + pad[1] },
        { inst: 'strings', mml: 'v8 q8 ' + pad[0] },
        { inst: 'bass', mml: 'v12 q5 ' + pat(P, 'R:8 R:8 O:8 R:8 N:8 R:8 O:8 R:8', 40) },
        { inst: 'kick', mml: 'v11 ' + C + N + N + F + C + `[${N}]6 ` + F + C + `[${N}]6 ` + F },
        { inst: 'hat', mml: '[[v7 c8 v4 c8]4 |]20' },
      ],
    };
  }

  // =====================================================================
  // FIELD — G major, adventurous walk. A 8 | B 8
  // =====================================================================
  {
    const P = prog('G | D | Em | C | G | Em | Am | D | C | D | Bm | Em | Am | Bm | C | D');
    const mel =
      'o4 g8 a8 b8 o5 d8 g4 f+8 g8 | o5 a4 f+4 d4 e8 f+8 | o5 g4. f+8 e4 o4 b4 | o5 c4 e4 g2 |' +
      'o5 b4. a8 g8 f+8 g8 a8 | o5 b4 e8 f+8 g4 b4 | o6 c4. o5 b8 a4 e4 | o5 f+4 a4 d2 |' +
      'o5 e8 f+8 g4 e4 c4 | o5 f+8 g8 a4 f+4 d4 | o5 d4 f+4 b4. a8 | o5 g2 e4 g4 |' +
      'o5 a4. g8 e4 c4 | o5 d4 f+8 e8 d4 o4 b4 | o5 c4 e4 g4 o6 c4 | o5 b4 a8 g8 f+4 d4 |';
    const pad = voices(P, 2, 60);
    S.field = {
      tempo: 120, loop: true, tracks: [
        { inst: 'lead', mml: 'v12 q7 ' + mel },
        { inst: 'strings', mml: 'v8 q8 ' + pad[1] },
        { inst: 'harp', mml: 'v8 ' + pat(P, '0:8 1:8 2:8 3:8 4:8 3:8 2:8 1:8', 55) },
        { inst: 'bass', mml: 'v11 q6 ' + pat(P, 'R:4 2:8 R:8 O:4 2:4', 43) },
        { inst: 'kick', mml: 'v9 [@kick c4 @snare c4 @kick c8 c8 @snare c4 |]16' },
        { inst: 'hat', mml: '[[v6 c8 v3 c8]4 |]16' },
      ],
    };
  }

  // =====================================================================
  // TOWN — F major waltz (3/4). A 8 | B 8 | A' 8
  // =====================================================================
  {
    const pA = prog('F | C | Dm | Bb | F | Gm | C | C7', 3);
    const pB = prog('Bb | C | Am | Dm | Bb | F | Gm | C', 3);
    const pA2 = prog('F | C | Dm | Bb | F | Gm | C | F', 3);
    const P = cat(pA, pB, pA2);
    const a6 = 'o5 c4 a4 f4 | o5 e4. d8 c4 | o5 d4 f4 a4 | o5 g2 f4 | o5 a4. g8 f4 | o5 b-4 g4 d4 |';
    const mel = a6 + 'o5 e4. f8 g4 | o5 b-4 a4 g4 |' +
      'o5 d4. f8 b-4 | o5 a4 g4 e4 | o5 c4 e4 a4 | o5 f4. e8 d4 | o5 d4. e8 f4 | o5 c4 f4 a4 | o5 b-4. a8 g4 | o5 g2 e4 |' +
      a6 + 'o5 g4. d8 e4 | o5 f2. |';
    const pah = voices(P, 2, 62, 'x4 n4 n4');
    const beats = P.reduce((a, s) => a + s.beats, 0);
    const lenA = pA.reduce((a, s) => a + s.beats, 0);
    S.town = {
      tempo: 104, loop: true, bpb: 3, tracks: [
        { inst: 'flute', mml: 'v12 q7 ' + mel },
        { inst: 'epiano', mml: 'v8 q5 ' + pah[1] },
        { inst: 'epiano', mml: 'v7 q5 ' + pah[0] },
        { inst: 'bass', mml: 'v11 q6 ' + pat(P, 'R:4 x:4 2:4', 41) },
        { inst: 'harp', mml: 'v7 ' + rest(lenA) + pat(cat(pB, pA2), '0:8 1:8 2:8 3:8 2:8 1:8', 53) },
      ],
    };
    if (Math.abs(beats - 72) > 1e-6) throw new Error('town length');
  }

  // =====================================================================
  // CHURCH — C major hymn on organ with bells
  // =====================================================================
  {
    const P = prog('C | F | C | G | Am | F | G | C | F | C | Dm | G | Em | Am | F G | C');
    const mel =
      'o5 e2 d4 e4 | o5 f2 a2 | o5 g4. f8 e4 c4 | o5 d1 |' +
      'o5 c2 e2 | o5 a4 g4 f4 a4 | o5 g2 f4 d4 | o5 c1 |' +
      'o5 a2 f4 a4 | o5 g2 e2 | o5 f4 a4 f4 d4 | o5 g2 d2 |' +
      'o5 g4 e4 g4 b4 | o5 a2 e2 | o5 f4 a4 g4 f4 | o5 e1 |';
    const inner = voices(P, 2, 61);
    S.church = {
      tempo: 70, loop: true, tracks: [
        { inst: 'organ', mml: 'v11 q8 ' + mel },
        { inst: 'organ', mml: 'v8 q8 ' + inner[1] },
        { inst: 'organ', mml: 'v7 q8 ' + inner[0] },
        { inst: 'organ', mml: 'v9 q8 ' + pat(P, 'R:1', 43) },
        { inst: 'bell', mml: 'v6 ' + pat(P, '0:2 2:4 1:4', 84) },
      ],
    };
  }

  // =====================================================================
  // HEADQUARTERS — A major, warm & homely (maj7 colours)
  // =====================================================================
  {
    const P = prog('Amaj7 | F#m7 | Dmaj7 | E7 | Amaj7 | C#m7 | Dmaj7 E7 | A A7 | Dmaj7 | C#m7 | Bm7 | E7 | Dmaj7 | C#m7 | Bm7 E7 | A');
    const mel =
      'o5 c+4. e8 e4 c+8 o4 b8 | o4 a2 f+4 a4 | o5 c+4. d8 f+4 e4 | o5 e2 d4 o4 b4 |' +
      'o5 c+4. e8 a4 g+8 e8 | o5 e4 g+8 f+8 e4 c+4 | o5 d4 f+4 e4 o4 b4 | o5 c+2 o4 a4 g4 |' +
      'o4 f+4. a8 o5 c+4 e4 | o5 e4. d8 c+4 o4 b4 | o4 a4. b8 o5 d4 f+4 | o5 e2. d8 c+8 |' +
      'o5 d4 f+4 a4 f+4 | o5 g+4. f+8 e4 c+4 | o5 d4 c+8 o4 b8 o5 e4 d4 | o4 a2. r4 |';
    const ep = voices(P, 2, 59, 'x8 n4 n8 x4 n4');
    S.headquarters = {
      tempo: 88, loop: true, tracks: [
        { inst: 'flute', mml: 'v12 q7 ' + mel },
        { inst: 'epiano', mml: 'v8 q6 ' + ep[1] },
        { inst: 'epiano', mml: 'v7 q6 ' + ep[0] },
        { inst: 'harp', mml: 'v6 ' + pat(P, '0:8 1:8 2:8 3:8 2:8 1:8 2:8 3:8', 54) },
        { inst: 'bass', mml: 'v11 q6 ' + pat(P, 'R:4. 2:8 O:4 2:4', 45) },
      ],
    };
  }

  // =====================================================================
  // STORY — C minor, tense & mysterious (heartbeat pulse, low harp ostinato)
  // =====================================================================
  {
    const P = prog('Cm | Cm | Ab | Ab | Fm | Fm | G | G | Cm | Db | Cm | Db | Ab | Fm | Dm7b5 | G');
    const mel =
      'o4 g2. a-4 | o4 g1 | o5 c2. e-4 | o5 e-2. d4 |' +
      'o5 c1 | o4 a-2 b-4 a-4 | o4 g2 b4 o5 d4 | o5 f2 d2 |' +
      'o5 e-4. d8 c2 | o5 d-2 f2 | o5 e-4. f8 g2 | o5 a-2 f2 |' +
      'o5 e-4. c8 o4 a-2 | o4 a-4 b-4 o5 c4 f4 | o5 a-2 f4 d4 | o5 d2 o4 b2 |';
    const pad = voices(P, 2, 55);
    S.story = {
      tempo: 84, loop: true, tracks: [
        { inst: 'flute', mml: 'v11 q7 ' + mel },
        { inst: 'strings', mml: 'v8 q8 ' + pad[1] },
        { inst: 'strings', mml: 'v7 q8 ' + pad[0] },
        { inst: 'harp', mml: 'v8 ' + pat(P, '0:8 2:8 1:8 2:8 3:8 2:8 1:8 2:8', 48) },
        { inst: 'bass', mml: 'v10 q8 ' + pat(P, 'R:1', 38) },
        { inst: 'kick', mml: 'v8 [c8 c8 r4 r2 |]16' },
      ],
    };
  }

  // =====================================================================
  // SAD — A minor, slow and melancholy
  // =====================================================================
  {
    const P = prog('Am | F | C | E | Am | Dm | Bm7b5 E | Am | F | G | Em | Am | Dm | G | E | E7');
    const mel =
      'o5 e2 a4. g8 | o5 f2. e4 | o5 e4. d8 c4 e4 | o5 d4. c8 o4 b2 |' +
      'o5 c4 e4 a2 | o5 a4. g8 f4 d4 | o5 d4 f4 e4 d4 | o5 c1 |' +
      'o5 c4 f4 a4. g8 | o5 g2 d2 | o5 e4. d8 e4 g4 | o5 a2 e2 |' +
      'o5 f4. e8 d4 a4 | o5 g4. f8 d2 | o5 e4 g+4 b4 o6 d4 | o5 b2 g+2 |';
    const pad = voices(P, 2, 60);
    S.sad = {
      tempo: 66, loop: true, tracks: [
        { inst: 'flute', mml: 'v12 q7 ' + mel },
        { inst: 'epiano', mml: 'v8 ' + pat(P, '0:8 1:8 2:8 3:8 2:8 1:8 2:8 1:8', 52) },
        { inst: 'strings', mml: 'v7 q8 ' + pad[1] },
        { inst: 'strings', mml: 'v6 q8 ' + pad[0] },
        { inst: 'bass', mml: 'v10 q7 ' + pat(P, 'R:2 2:2', 45) },
      ],
    };
  }

  // =====================================================================
  // CASTLE — E-flat major, stately (timpani + snare)
  // =====================================================================
  {
    const P = prog('Eb | Ab | Bb | Eb | Cm | Ab | F | Bb | Ab | Bb | Gm | Cm | Fm | Bb7 | Ab Bb | Eb');
    const mel =
      'o4 b-8. b-16 o5 e-4 g4. e-8 | o5 a-4 o6 c8. o5 b-16 a-4 e-4 | o5 d4. e-8 f4 b-4 | o5 g4. f8 e-2 |' +
      'o5 g8. g16 g4 o6 c4. o5 b-8 | o5 e-4 a-8. b-16 o6 c4 o5 a-4 | o6 c4. o5 a8 f4 a4 | o5 b-2. f4 |' +
      'o5 e-4. f8 e-4 c4 | o5 d4. e-8 f4 d4 | o5 b-4. a-8 g4 d4 | o5 e-2 g4 o6 c4 |' +
      'o6 c4. o5 a-8 f4 a-4 | o5 b-4. a-8 f4 d4 | o5 e-4 c4 d4 f4 | o5 e-2. r4 |';
    const pad = voices(P, 2, 62);
    const N = '@tom o2 e-4 @snare c8. c16 @tom o2 b-4 @snare c8 c8 |';
    const C = '@crash c4 @snare c8. c16 @tom o2 b-4 @snare c8 c8 |';
    const F = '@snare c16 c16 c16 c16 c16 c16 c16 c16 @tom o2 b-4 o2 e-4 |';
    S.castle = {
      tempo: 96, loop: true, tracks: [
        { inst: 'brass', mml: 'v13 q7 ' + mel },
        { inst: 'strings', mml: 'v9 q8 ' + pad[1] },
        { inst: 'strings', mml: 'v8 q8 ' + pad[0] },
        { inst: 'harp', mml: 'v6 ' + pat(P, '0:8 1:8 2:8 3:8', 58) },
        { inst: 'bass', mml: 'v11 q6 ' + pat(P, 'R:4. R:8 2:4 R:4', 41) },
        { inst: 'tom', mml: 'v10 ' + C + `[${N}]6 ` + F + C + `[${N}]6 ` + F },
      ],
    };
  }

  // =====================================================================
  // Jingles (loop: false)
  // =====================================================================
  S.victory = { // C major fanfare, 8 beats @132 ≈ 3.6 s
    tempo: 132, loop: false, tracks: [
      { inst: 'brass', mml: 'v13 o5 g8. g16 o6 c8. c16 e4 d8 c8 | o6 d8 c8 o5 b8 o6 d8 c2 |' },
      { inst: 'brass', mml: 'v10 o5 e8. e16 g8. g16 g4 f8 e8 | o5 f8 e8 d8 f8 e2 |' },
      { inst: 'strings', mml: 'v9 q8 o4 g2 a2 | o4 g2 g2 |' },
      { inst: 'bass', mml: 'v12 o3 c4 o2 g4 o3 c4 o2 g4 | o2 g4 g4 o3 c2 |' },
      { inst: 'snare', mml: 'v11 @crash c4 @snare c8 c8 c4 c16 c16 c16 c16 | @snare c4 c4 @crash c2 |' },
    ],
  };
  S.levelup = { // F major sparkle, 4 beats @160 = 1.5 s
    tempo: 160, loop: false, tracks: [
      { inst: 'lead', mml: 'v13 o5 f16 a16 o6 c16 f16 e8 f8 g8 a4. |' },
      { inst: 'bell', mml: 'v9 r4 o5 c8 c8 e8 f4. |' },
      { inst: 'bass', mml: 'v11 o3 f4 c8 c8 c8 o2 f4. |' },
    ],
  };
  S.promote = { // G major, I-IV-V-I, 6 beats @120 = 3 s
    tempo: 120, loop: false, tracks: [
      { inst: 'brass', mml: 'v13 o5 d8 g8 b8 o6 d8 c8 e8 d4 | o6 g2 |' },
      { inst: 'strings', mml: 'v9 q8 o4 b2 o5 e4 f+4 | o5 b2 |' },
      { inst: 'bell', mml: 'v8 r2 r2 | o6 d8 g8 b4 |' },
      { inst: 'bass', mml: 'v12 o3 g4 d4 c4 d4 | o2 g2 |' },
      { inst: 'snare', mml: 'v10 c16 c16 c16 c16 c4 c4 c4 | @crash c2 |' },
    ],
  };
  S.join = { // A major, cheerful, 6 beats @140 ≈ 2.6 s
    tempo: 140, loop: false, tracks: [
      { inst: 'lead', mml: 'v13 o5 e8 c+8 e8 a8 g+8 a8 b8 o6 c+8 | o6 e8 c+8 o5 a4 |' },
      { inst: 'epiano', mml: 'v9 o4 a4 o5 c+4 o4 b4 g+4 | o4 a2 |' },
      { inst: 'bass', mml: 'v11 o3 a8 r8 e8 r8 o2 e8 r8 b8 r8 | o3 a4 o2 a4 |' },
      { inst: 'kick', mml: 'v10 @kick c8 @hat c8 @snare c8 @hat c8 @kick c8 @hat c8 @snare c8 c8 | @crash c2 |' },
    ],
  };
  S.item = { // C major blip, 3 beats @150 = 1.2 s
    tempo: 150, loop: false, tracks: [
      { inst: 'lead', mml: 'v13 o5 e16 g16 o6 c16 e16 d8 g8 e4 |' },
      { inst: 'bell', mml: 'v9 o5 c16 e16 g16 o6 c16 o5 b8 b8 o6 c4 |' },
      { inst: 'bass', mml: 'v11 o3 c4 o2 g4 o3 c4 |' },
    ],
  };
  S.defeat = { // C minor, falling line, 4 beats @70 ≈ 3.4 s
    tempo: 70, loop: false, tracks: [
      { inst: 'strings', mml: 'v12 q8 o5 e-8 d8 c8 o4 b8 o5 c2 |' },
      { inst: 'strings', mml: 'v9 q8 o4 g4 a-8 f8 g2 |' },
      { inst: 'strings', mml: 'v8 q8 o4 c4 c8 d8 c2 |' },
      { inst: 'bass', mml: 'v11 q8 o3 c4 f8 g8 c2 |' },
    ],
  };
  S.inn = { // F major lullaby, 4 beats @90 ≈ 2.7 s
    tempo: 90, loop: false, tracks: [
      { inst: 'flute', mml: 'v12 q8 o5 c4 f8 a8 g4 f4 |' },
      { inst: 'harp', mml: 'v9 o4 f8 a8 o5 c8 f8 o4 e8 g8 a4 |' },
      { inst: 'bass', mml: 'v10 q8 o3 f2 c4 f4 |' },
      { inst: 'bell', mml: 'v7 r2. o6 f4 |' },
    ],
  };
})();
