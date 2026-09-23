// ===== Field exploration: towns, interiors, overworld; NPCs, talking, searching, doors, events =====
'use strict';
(function () {
  const D = () => G.data;
  const key = (x, y) => x + ',' + y;

  class Field {
    constructor(mapId, x, y, dir) {
      this.mapId = mapId; this.def = G.maps[mapId];
      const rows = this.def.rows;
      this.map = { w: Math.max(...rows.map(r => r.length)), h: rows.length, rows, get(x, y) { if (y < 0 || y >= this.h || x < 0 || x >= this.w) return ' '; return this.rows[y][x] || ' '; } };
      this.player = { x, y, dir: dir || 'down', ox: 0, oy: 0, moving: false, spec: D().chars.rowan.map };
      this.npcs = [];
      (this.def.npcs || []).forEach(n => { if (!n.cond || n.cond()) this.addNpc(n); });
      this.t = 0; this.tasks = new G.Tasks(); this.cam = { x: 0, y: 0 };
      this.locked = false; this.stepCount = 0;
      G.field = this;
      this.snapCam();
    }
    addNpc(n) {
      const spec = n.spec || (n.npc && D().npcs[n.npc] ? D().npcs[n.npc].map : n.char ? D().chars[n.char].map : null);
      const o = Object.assign({ ox: 0, oy: 0, dir: 'down', home: [n.x, n.y], wt: G.r(120) }, n, { spec });
      this.npcs.push(o); return o;
    }
    npc(id) { return this.npcs.find(n => n.id === id); }
    removeNpc(id) { this.npcs = this.npcs.filter(n => n.id !== id); }
    onEnter() {
      G.audio.play(this.def.music || 'town');
      if (this.def.name && !this.noBanner) { this.banner = { text: this.def.name, t: 150 }; }
      if (this.def.onEnter) this.tasks.add(this.def.onEnter(this));
    }
    // ---------- walkability ----------
    blocked(x, y, self) {
      if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return true;
      const ex = this.exitAt(x, y); if (ex) return false;
      const t = G.TERRAIN[this.map.get(x, y)] || G.TERRAIN['.'];
      if (t.block || t.wall) return true;
      if (this.npcs.some(n => n !== self && !n.ghost && n.x === x && n.y === y)) return true;
      if (self !== this.player && this.player.x === x && this.player.y === y) return true;
      return false;
    }
    exitAt(x, y) { return (this.def.exits || []).find(e => e.x === x && e.y === y && (!e.cond || e.cond())); }
    // ---------- camera ----------
    camTarget() {
      const T = G.TILE, p = this.player;
      let cx = p.x * T + p.ox + T / 2 - G.W / 2, cy = p.y * T + p.oy + T / 2 - G.H / 2;
      const mw = this.map.w * T, mh = this.map.h * T;
      cx = mw <= G.W ? (mw - G.W) / 2 : G.clamp(cx, 0, mw - G.W);
      cy = mh <= G.H ? (mh - G.H) / 2 : G.clamp(cy, 0, mh - G.H);
      return { x: cx, y: cy };
    }
    snapCam() { this.cam = this.camTarget(); }
    // ---------- movement ----------
    *step(o, dir, speed = 3) {
      o.dir = dir; const [dx, dy] = G.DIRS[dir];
      const nx = o.x + dx, ny = o.y + dy;
      if (this.blocked(nx, ny, o)) return false;
      o.moving = true; o.x = nx; o.y = ny;
      const n = Math.ceil(G.TILE / speed);
      for (let i = 1; i <= n; i++) { o.ox = -dx * (G.TILE - Math.min(G.TILE, i * speed)); o.oy = -dy * (G.TILE - Math.min(G.TILE, i * speed)); yield 1; }
      o.ox = 0; o.oy = 0; o.moving = false;
      return true;
    }
    // scripted walks: dirs string like "uurrd"
    *walkNpc(o, dirs, speed = 2) {
      const m = { u: 'up', d: 'down', l: 'left', r: 'right' };
      for (const c of dirs) { if (m[c]) { const dir = m[c]; const [dx, dy] = G.DIRS[dir]; o.dir = dir; o.x += dx; o.y += dy; const n = Math.ceil(G.TILE / speed); for (let i = 1; i <= n; i++) { o.ox = -dx * (G.TILE - Math.min(G.TILE, i * speed)); o.oy = -dy * (G.TILE - Math.min(G.TILE, i * speed)); yield 1; } o.ox = 0; o.oy = 0; } else if (c === '.') yield 16; else if (c === 'U') o.dir = 'up'; else if (c === 'D') o.dir = 'down'; else if (c === 'L') o.dir = 'left'; else if (c === 'R') o.dir = 'right'; }
    }
    *playerWalk() {
      const p = this.player;
      while (true) {
        yield 1;
        if (this.locked || G.top() !== this) continue;
        const d = G.input.dir();
        if (d) {
          if (p.dir !== d && !G.input.h(d + 'Moved')) { p.dir = d; }
          const [dx, dy] = G.DIRS[d];
          const ex = this.exitAt(p.x + dx, p.y + dy);
          const moved = yield* this.step(p, d, 3);
          if (moved) {
            this.stepCount++;
            if (this.stepCount % 2 === 0) G.audio.sfx('step');
            if (ex) { yield* this.useExit(ex); continue; }
            const ev = (this.def.events || []).find(e => e.x === p.x && e.y === p.y && (!e.once || !G.state.flags['ev_' + this.mapId + e.x + '_' + e.y]) && (!e.cond || e.cond()));
            if (ev) { if (ev.once) G.state.flags['ev_' + this.mapId + ev.x + '_' + ev.y] = true; this.locked = true; yield* ev.run(this); this.locked = false; }
          }
          continue;
        }
        if (G.input.p('A')) { this.locked = true; yield* this.interact(); this.locked = false; continue; }
        if (G.input.p('C')) { this.locked = true; yield* G.fieldMenu(this); this.locked = false; continue; }
      }
    }
    *useExit(ex) {
      if (ex.run) { this.locked = true; const ok = yield* ex.run(this); this.locked = false; if (ok === false) return; }
      if (ex.battle) { if (!G.state.battlesWon[ex.battle]) { G.audio.sfx('door'); yield G.fadeTo(1, 0.05); G.startBattle(ex.battle); return; } }
      if (!ex.to) return;
      G.audio.sfx(ex.sfx || 'door');
      yield G.fadeTo(1, 0.08);
      G.goto(ex.to, ex.tx, ex.ty, ex.dir || this.player.dir);
    }
    facing() { const [dx, dy] = G.DIRS[this.player.dir]; return [this.player.x + dx, this.player.y + dy]; }
    *interact() {
      const [fx, fy] = this.facing();
      let n = this.npcs.find(o => o.x === fx && o.y === fy);
      // talk across counters
      if (!n) { const t = this.map.get(fx, fy); if (t === 'e' || t === 't' || t === 'a' || t === 'Y') { const [dx, dy] = G.DIRS[this.player.dir]; n = this.npcs.find(o => o.x === fx + dx && o.y === fy + dy); } }
      if (n && n.talk) {
        const back = { u: 'down', d: 'up', l: 'right', r: 'left' }[this.player.dir[0]];
        const prev = n.dir; if (!n.fixed) n.dir = back;
        if (typeof n.talk === 'function') yield* n.talk(this, n);
        else { const lines = Array.isArray(n.talk) ? n.talk : [n.talk]; yield G.say(lines, { portrait: G.portraitOf(n) }); }
        if (!n.fixed && n.wander) n.dir = prev;
        return;
      }
      yield* this.search(fx, fy);
    }
    *search(fx, fy) {
      if (fx === undefined) [fx, fy] = this.facing();
      const k = this.mapId + ':' + key(fx, fy);
      const s = (this.def.searches || {})[key(fx, fy)];
      if (s) {
        if (G.state.searched[k]) { yield G.say(s.emptyText || 'Nothing else here.'); return; }
        if (s.cond && !s.cond()) { yield G.say('Nothing here.'); return; }
        G.state.searched[k] = true;
        if (s.text) yield G.say(s.text);
        if (s.item) {
          const who = G.st.giveItem(s.item); G.audio.jingle('item');
          yield G.say(who ? (who.name + ' found ' + D().items[s.item].name + '!') : ('Found ' + D().items[s.item].name + '! It was sent to the caravan depot.'));
        }
        if (s.gold) { G.state.gold += s.gold; G.audio.sfx('coin'); yield G.say('Found ' + s.gold + ' gold coins!'); }
        if (s.run) yield* s.run(this);
        return;
      }
      yield G.say('Rowan searches the area... Nothing unusual.', { silent: false });
    }
    // ---------- NPC wandering ----------
    *npcAI() {
      while (true) {
        yield 1;
        if (this.locked || G.top() !== this) continue;
        for (const n of this.npcs) {
          if (!n.wander || n.moving || n.busy) continue;
          if (--n.wt > 0) continue;
          n.wt = 60 + G.r(160);
          const dirs = ['up', 'down', 'left', 'right']; const d = dirs[G.r(4)];
          const [dx, dy] = G.DIRS[d];
          const nx = n.x + dx, ny = n.y + dy;
          if (Math.abs(nx - n.home[0]) + Math.abs(ny - n.home[1]) > (n.wander === true ? 2 : n.wander)) { n.dir = d; continue; }
          if (this.blocked(nx, ny, n) || this.exitAt(nx, ny)) { n.dir = d; continue; }
          const self = this; const g = (function* () { n.busy = true; yield* self.step(n, d, 1.5); n.busy = false; })();
          this.tasks.add(g);
        }
      }
    }
    start() { this.tasks.add(this.playerWalk()); this.tasks.add(this.npcAI()); }
    update() {
      this.t++;
      this.tasks.update();
      const ct = this.camTarget(); this.cam.x += (ct.x - this.cam.x) * 0.3; this.cam.y += (ct.y - this.cam.y) * 0.3;
      if (Math.abs(ct.x - this.cam.x) < 0.5) this.cam.x = ct.x; if (Math.abs(ct.y - this.cam.y) < 0.5) this.cam.y = ct.y;
      if (this.banner) this.banner.t--;
      G.state.playTime += 1 / 60;
      if (G.input.p('M')) G.audio.toggleMute();
    }
    draw(ctx) {
      const T = G.TILE, cx = Math.round(this.cam.x), cy = Math.round(this.cam.y);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      const x0 = Math.floor(cx / T), y0 = Math.floor(cy / T);
      for (let y = y0; y <= y0 + Math.ceil(G.H / T) + 1; y++) for (let x = x0; x <= x0 + Math.ceil(G.W / T) + 1; x++) {
        if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) continue;
        G.drawTile(ctx, this.map, x, y, x * T - cx, y * T - cy, this.t);
      }
      const ents = this.npcs.filter(n => n.spec && !n.hidden).concat([this.player]).sort((a, b) => (a.y * T + a.oy) - (b.y * T + b.oy));
      for (const e of ents) {
        const moving = e.moving || e.ox || e.oy;
        const fr = moving ? Math.floor(this.t / 6) % 2 : Math.floor((this.t + (e.x || 0) * 13) / 24) % 2;
        const img = G.unitSprite(e.spec, e.dir, fr);
        ctx.drawImage(img, Math.round(e.x * T + e.ox - cx), Math.round(e.y * T + e.oy - cy - 3));
      }
      if (this.banner && this.banner.t > 0) {
        const a = Math.min(1, this.banner.t / 30);
        ctx.globalAlpha = a; const w = G.textWidth(this.banner.text) + 30;
        G.win(ctx, (G.W - w) / 2, 10, w, 22); G.textC(ctx, this.banner.text, G.W / 2, 17, '#f8e060'); ctx.globalAlpha = 1;
      }
      if (G.showGold) G.goldWin(ctx, G.W - 82, 6);
    }
  }
  G.Field = Field;
  G.maps = {};
  G.portraitOf = function (n) {
    if (!n) return null;
    if (n.portrait) return n.portrait;
    if (n.npc && D().npcs[n.npc]) return D().npcs[n.npc].portrait;
    if (n.char) return D().chars[n.char].portrait;
    return null;
  };
  G.goto = function (mapId, x, y, dir) {
    const f = new Field(mapId, x, y, dir);
    G.state.loc = { map: mapId, x, y, dir };
    G.replace(f); f.start();
    G.fade.a = 1; G.fadeTo(0, 0.08);
    return f;
  };
  G.recallToChurch = function () {
    const c = G.state.church; G.st.healAll();
    G.roster && 0;
    G.goto(c.map, c.x, c.y, 'down');
  };
})();
