// ===== Audio: 2-operator FM synth + MML sequencer + SFX (all procedural) =====
'use strict';
(function () {
  const A = G.audio = {
    ctx: null, master: null, musicGain: null, sfxGain: null, muted: false,
    song: null, songName: null, events: [], nextIdx: 0, startTime: 0, loopLen: 0, loopCount: 0,
    musicVol: 0.55, sfxVol: 0.6,
  };
  A.unlock = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    A.ctx = new AC();
    A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : 0.8;
    const comp = A.ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    A.master.connect(comp); comp.connect(A.ctx.destination);
    A.musicGain = A.ctx.createGain(); A.musicGain.gain.value = A.musicVol; A.musicGain.connect(A.master);
    A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = A.sfxVol; A.sfxGain.connect(A.master);
    // noise buffer
    const len = A.ctx.sampleRate; const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
    if (A.pending) { const p = A.pending; A.pending = null; A.play(p); }
  };
  A.toggleMute = function () { A.muted = !A.muted; if (A.master) A.master.gain.value = A.muted ? 0 : 0.8; };

  // ---------- Instruments ----------
  // fm: ratio (mod:carrier), idx (mod depth), idxEnd, a/d/s/r envelope, wave for carrier
  const INST = A.INST = {
    lead: { t: 'fm', ratio: 1, idx: 2.2, idxEnd: 0.8, a: 0.005, d: 0.25, s: 0.55, r: 0.12, wave: 'sine' },
    brass: { t: 'fm', ratio: 1, idx: 3.2, idxEnd: 1.6, a: 0.03, d: 0.2, s: 0.7, r: 0.1, wave: 'sine' },
    bell: { t: 'fm', ratio: 3.5, idx: 4, idxEnd: 0.3, a: 0.002, d: 0.6, s: 0.15, r: 0.4, wave: 'sine' },
    epiano: { t: 'fm', ratio: 1, idx: 1.4, idxEnd: 0.2, a: 0.003, d: 0.5, s: 0.3, r: 0.25, wave: 'sine' },
    bass: { t: 'fm', ratio: 0.5, idx: 2.8, idxEnd: 1.2, a: 0.003, d: 0.18, s: 0.6, r: 0.06, wave: 'sine' },
    slap: { t: 'fm', ratio: 1, idx: 5, idxEnd: 0.8, a: 0.002, d: 0.12, s: 0.5, r: 0.05, wave: 'triangle' },
    strings: { t: 'fm', ratio: 2, idx: 0.9, idxEnd: 0.9, a: 0.12, d: 0.3, s: 0.8, r: 0.3, wave: 'sawtooth', lp: 1800 },
    organ: { t: 'fm', ratio: 2, idx: 1.2, idxEnd: 1.2, a: 0.01, d: 0.1, s: 0.9, r: 0.08, wave: 'sine' },
    flute: { t: 'fm', ratio: 1, idx: 0.6, idxEnd: 0.3, a: 0.05, d: 0.2, s: 0.8, r: 0.12, wave: 'triangle' },
    harp: { t: 'fm', ratio: 2, idx: 1.8, idxEnd: 0.1, a: 0.002, d: 0.7, s: 0.05, r: 0.35, wave: 'triangle' },
    square: { t: 'osc', wave: 'square', a: 0.003, d: 0.1, s: 0.6, r: 0.06, lp: 3000 },
    kick: { t: 'kick' }, snare: { t: 'snare' }, hat: { t: 'hat' }, tom: { t: 'tom' }, crash: { t: 'crash' },
  };

  function voice(inst, freq, t, dur, vol, dest) {
    const ac = A.ctx; const I = INST[inst] || INST.lead;
    if (I.t === 'kick' || I.t === 'snare' || I.t === 'hat' || I.t === 'tom' || I.t === 'crash') return drum(I.t, t, vol, dest, freq);
    const out = ac.createGain(); out.gain.value = 0;
    let node = out;
    if (I.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = I.lp; out.connect(f); node = f; }
    node.connect(dest);
    const car = ac.createOscillator(); car.type = I.wave || 'sine'; car.frequency.value = freq;
    car.connect(out);
    let mod = null;
    if (I.t === 'fm') {
      mod = ac.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * I.ratio;
      const mg = ac.createGain();
      mg.gain.setValueAtTime(freq * I.idx, t);
      mg.gain.exponentialRampToValueAtTime(Math.max(1, freq * I.idxEnd), t + Math.max(0.02, I.d));
      mod.connect(mg); mg.connect(car.frequency);
      mod.start(t);
    }
    const peak = vol, sus = vol * I.s;
    const g = out.gain;
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + I.a);
    g.setTargetAtTime(sus, t + I.a, I.d / 3);
    const end = t + Math.max(dur, I.a + 0.01);
    g.setValueAtTime(g.value || sus, end); // anchor
    g.cancelScheduledValues(end);
    g.setTargetAtTime(0.0001, end, I.r / 3);
    car.start(t); car.stop(end + I.r * 2 + 0.05);
    if (mod) mod.stop(end + I.r * 2 + 0.05);
  }
  function drum(kind, t, vol, dest, freq) {
    const ac = A.ctx;
    if (kind === 'kick' || kind === 'tom') {
      const o = ac.createOscillator(), g = ac.createGain();
      const f0 = kind === 'kick' ? 140 : (freq || 200);
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(kind === 'kick' ? 40 : f0 * 0.5, t + 0.15);
      g.gain.setValueAtTime(vol * 1.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'kick' ? 0.22 : 0.3));
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.35);
      return;
    }
    const n = ac.createBufferSource(); n.buffer = A.noise;
    const f = ac.createBiquadFilter(); const g = ac.createGain();
    let len = 0.12;
    if (kind === 'snare') { f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; len = 0.16; }
    else if (kind === 'hat') { f.type = 'highpass'; f.frequency.value = 7000; len = 0.04; vol *= 0.6; }
    else { f.type = 'highpass'; f.frequency.value = 3000; len = 0.9; vol *= 0.7; }
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random() * 0.5); n.stop(t + len + 0.05);
    if (kind === 'snare') { const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = 190; og.gain.setValueAtTime(vol * 0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.08); o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.1); }
  }

  // ---------- MML parser ----------
  // o4 l8 v12 @lead  c d e f+ g. a16 r4 > c < b- [cdeg]2 &(tie) q7 (gate /8)
  const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function parseMML(src, defInst) {
    const ev = []; let time = 0, oct = 4, len = 4, vol = 12, inst = defInst, gate = 7 / 8;
    let i = 0; const s = src.replace(/\s+/g, ' ');
    const stack = [];
    function num() { let m = /^\d+/.exec(s.slice(i)); if (!m) return null; i += m[0].length; return +m[0]; }
    function dur() {
      let n = num(); let d = 4 / (n || len);
      let add = d / 2; while (s[i] === '.') { d += add; add /= 2; i++; }
      return d;
    }
    let lastNote = null;
    while (i < s.length) {
      const c = s[i++];
      if (c === ' ' || c === '|') continue;
      if (c === 'o') { oct = num(); continue; }
      if (c === '>') { oct++; continue; }
      if (c === '<') { oct--; continue; }
      if (c === 'l') { len = num(); continue; }
      if (c === 'v') { vol = num(); continue; }
      if (c === 'q') { gate = num() / 8; continue; }
      if (c === '@') { let m = /^[a-z]+/.exec(s.slice(i)); inst = m[0]; i += m[0].length; continue; }
      if (c === '[') { stack.push({ pos: i, count: null }); continue; }
      if (c === ']') {
        const top = stack[stack.length - 1]; const n = num() || 2;
        if (top.count === null) top.count = n - 1;
        if (top.count > 0) { top.count--; i = top.pos; } else stack.pop();
        continue;
      }
      if (c === 'r') { time += dur(); lastNote = null; continue; }
      if (c === '&') { // tie: extend last note
        const d = /^[a-g]/.test(s[i]) ? (i++, (s[i] === '+' || s[i] === '#' || s[i] === '-') && i++, dur()) : dur();
        if (lastNote) { lastNote.dur += d; lastNote.gdur = lastNote.dur * gate; } time += d; continue;
      }
      if (NOTE[c] !== undefined) {
        let n = NOTE[c];
        if (s[i] === '+' || s[i] === '#') { n++; i++; } else if (s[i] === '-') { n--; i++; }
        const d = dur();
        const midi = 12 * (oct + 1) + n;
        lastNote = { t: time, dur: d, gdur: d * gate, midi, vol, inst };
        ev.push(lastNote); time += d; continue;
      }
      // unknown char: skip
    }
    return { ev, len: time };
  }
  A.parseMML = parseMML;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- Song playback ----------
  A.songs = {}; // filled by music.js: name -> {tempo, loop, tracks:[{inst, vol, mml}]}
  A.compile = function (song) {
    if (song._c) return song._c;
    let all = [], maxLen = 0;
    song.tracks.forEach((tr, ti) => {
      const p = parseMML(tr.mml, tr.inst);
      p.ev.forEach(e => { e.track = ti; e.gain = (tr.vol == null ? 1 : tr.vol); });
      all = all.concat(p.ev); maxLen = Math.max(maxLen, p.len);
    });
    all.sort((a, b) => a.t - b.t);
    song._c = { ev: all, len: song.bars ? song.bars * 4 : maxLen };
    return song._c;
  };
  A.play = function (name, force) {
    if (!A.ctx) { A.pending = name; A.songName = name; return; }
    if (A.songName === name && A.song && !force) return;
    A.stop();
    const song = A.songs[name]; if (!song) return;
    A.song = song; A.songName = name;
    const c = A.compile(song);
    A.events = c.ev; A.loopLen = c.len; A.nextIdx = 0; A.loopCount = 0;
    A.spb = 60 / song.tempo; // seconds per beat (quarter)
    A.startTime = A.ctx.currentTime + 0.08;
    A.busGain = A.ctx.createGain(); A.busGain.gain.value = 1; A.busGain.connect(A.musicGain);
  };
  A.stop = function (fadeSec = 0) {
    if (A.busGain && A.ctx) {
      const g = A.busGain; const t = A.ctx.currentTime;
      if (fadeSec > 0) { g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fadeSec); setTimeout(() => g.disconnect(), fadeSec * 1000 + 100); }
      else { g.gain.setValueAtTime(0, t); setTimeout(() => g.disconnect(), 50); }
    }
    A.song = null; A.songName = null; A.busGain = null;
  };
  A.tick = function () {
    if (!A.ctx || !A.song) return;
    const now = A.ctx.currentTime, ahead = now + 0.25;
    let guard = 0;
    while (guard++ < 400) {
      if (A.nextIdx >= A.events.length) {
        if (!A.song.loop) { if (now > A.startTime + (A.loopCount + 1) * A.loopLen * A.spb + 0.5) { const cb = A.song.onEnd; A.song = null; A.songName = null; cb && cb(); } return; }
        A.nextIdx = 0; A.loopCount++;
      }
      const e = A.events[A.nextIdx];
      const base = A.startTime + A.loopCount * A.loopLen * A.spb;
      const t = base + e.t * A.spb;
      if (t > ahead) break;
      if (t >= now - 0.05) voice(e.inst, mtof(e.midi), Math.max(t, now), e.gdur * A.spb, (e.vol / 15) * 0.22 * e.gain, A.busGain);
      A.nextIdx++;
    }
  };
  // play a one-shot jingle over (ducking) the current music, then resume
  A.jingle = function (name, cb) {
    const prev = A.songName;
    const song = A.songs[name]; if (!song) { cb && cb(); return; }
    song.onEnd = () => { if (prev && prev !== name) A.play(prev, true); cb && cb(); };
    A.play(name, true);
    if (!A.ctx) { setTimeout(() => cb && cb(), 10); }
  };

  // ---------- SFX ----------
  function sfxNotes(list, inst = 'square', vol = 0.18) {
    if (!A.ctx) return; const t0 = A.ctx.currentTime + 0.01;
    list.forEach(([m, st, du]) => voice(inst, mtof(m), t0 + st, du, vol, A.sfxGain));
  }
  function sweep(f0, f1, len, type = 'square', vol = 0.15) {
    if (!A.ctx) return; const ac = A.ctx, t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g); g.connect(A.sfxGain); o.start(t); o.stop(t + len + 0.02);
  }
  function noiseHit(len, freq, vol = 0.5, type = 'lowpass') {
    if (!A.ctx) return; const ac = A.ctx, t = ac.currentTime;
    const n = ac.createBufferSource(); n.buffer = A.noise; const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, freq / 6), t + len);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(f); f.connect(g); g.connect(A.sfxGain); n.start(t); n.stop(t + len + 0.05);
  }
  A.sfx = function (name) {
    if (!A.ctx) return;
    switch (name) {
      case 'cursor': sfxNotes([[84, 0, 0.03]], 'square', 0.08); break;
      case 'ok': sfxNotes([[79, 0, 0.04], [86, 0.045, 0.06]], 'square', 0.1); break;
      case 'cancel': sfxNotes([[74, 0, 0.04], [67, 0.045, 0.06]], 'square', 0.1); break;
      case 'error': sfxNotes([[50, 0, 0.1], [49, 0.1, 0.12]], 'square', 0.12); break;
      case 'text': sfxNotes([[88 + G.r(3), 0, 0.012]], 'square', 0.03); break;
      case 'step': noiseHit(0.03, 1200, 0.05); break;
      case 'door': noiseHit(0.25, 900, 0.35); sweep(180, 90, 0.2, 'triangle', 0.2); break;
      case 'swing': noiseHit(0.12, 5000, 0.25, 'bandpass'); break;
      case 'hit': noiseHit(0.18, 2400, 0.7); sweep(200, 60, 0.12, 'square', 0.2); break;
      case 'crit': noiseHit(0.3, 4000, 0.9); sweep(400, 50, 0.25, 'sawtooth', 0.25); break;
      case 'miss': sweep(900, 1800, 0.15, 'triangle', 0.12); break;
      case 'arrow': sweep(1400, 500, 0.18, 'triangle', 0.12); noiseHit(0.08, 6000, 0.15, 'highpass'); break;
      case 'fire': noiseHit(0.7, 1500, 0.6); sweep(120, 60, 0.6, 'sawtooth', 0.12); break;
      case 'ice': sfxNotes([[96, 0, 0.1], [100, 0.06, 0.1], [103, 0.12, 0.1], [108, 0.18, 0.2]], 'bell', 0.12); noiseHit(0.4, 8000, 0.15, 'highpass'); break;
      case 'bolt': noiseHit(0.5, 6000, 0.7, 'highpass'); sweep(2000, 100, 0.4, 'sawtooth', 0.15); break;
      case 'heal': sfxNotes([[72, 0, 0.12], [76, 0.08, 0.12], [79, 0.16, 0.12], [84, 0.24, 0.3]], 'bell', 0.1); break;
      case 'buff': sfxNotes([[67, 0, 0.1], [71, 0.07, 0.1], [74, 0.14, 0.1], [79, 0.21, 0.25]], 'epiano', 0.12); break;
      case 'debuff': sfxNotes([[79, 0, 0.1], [74, 0.07, 0.1], [70, 0.14, 0.1], [63, 0.21, 0.25]], 'epiano', 0.12); break;
      case 'warp': sweep(200, 2000, 0.8, 'sine', 0.15); sweep(300, 3000, 0.8, 'triangle', 0.08); break;
      case 'die': sweep(600, 40, 0.6, 'square', 0.15); noiseHit(0.6, 800, 0.3); break;
      case 'coin': sfxNotes([[88, 0, 0.05], [93, 0.06, 0.18]], 'square', 0.09); break;
      case 'item': sfxNotes([[79, 0, 0.08], [83, 0.08, 0.08], [86, 0.16, 0.08], [91, 0.24, 0.2]], 'square', 0.08); break;
      case 'chest': noiseHit(0.1, 600, 0.3); break;
      case 'select': sfxNotes([[91, 0, 0.05]], 'bell', 0.08); break;
    }
  };
})();
