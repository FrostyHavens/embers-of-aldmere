// ===== Tactical battle map: turn loop, movement, menus, targeting, enemy AI =====
'use strict';
(function () {
  const D = () => G.data, R = () => G.rules, T = () => G.TILE;
  const key = (x, y) => x + ',' + y;
  const DIR4 = [[0, -1, 'up'], [0, 1, 'down'], [-1, 0, 'left'], [1, 0, 'right']];

  class Battle {
    constructor(id, opts = {}) {
      this.id = id; this.def = G.battles[id]; this.opts = opts;
      const rows = this.def.map;
      this.map = { w: Math.max(...rows.map(r => r.length)), h: rows.length, rows, get(x, y) { if (y < 0 || y >= this.h || x < 0 || x >= this.w) return ' '; return this.rows[y][x] || ' '; } };
      this.units = []; this.t = 0; this.tasks = new G.Tasks();
      this.cam = { x: 0, y: 0 }; this.camT = { x: 0, y: 0 };
      this.cursor = null; this.overlay = null; this.overlayColor = null; this.area = null;
      this.active = null; this.hud = true; this.result = null; this.round = 0;
      this.setup();
      this.tasks.add(this.main());
    }
    // ---------- setup ----------
    setup() {
      const party = G.st.active().filter(u => !u.dead);
      const pts = this.def.allies;
      party.slice(0, pts.length).forEach((u, i) => {
        u.x = pts[i][0]; u.y = pts[i][1]; u.dir = this.def.allyDir || 'up'; u.side = 'ally'; u.ox = 0; u.oy = 0; u.gone = false; u.status = u.status || {};
        this.units.push(u);
      });
      this.def.enemies.forEach((e, i) => {
        const k = D().enemies[e.t];
        const lvBoost = e.lv ? e.lv - k.lv : 0;
        const u = {
          enemy: true, kind: k, name: e.name || k.name, lv: e.lv || k.lv, uid: 'e' + i,
          mhp: k.hp + lvBoost * 2, mmp: k.mp, att: k.att + lvBoost, def: k.def + Math.floor(lvBoost / 2), agi: k.agi + Math.floor(lvBoost / 2),
          x: e.x, y: e.y, dir: e.dir || 'down', side: 'enemy', ox: 0, oy: 0, status: {}, ai: e.ai || k.ai || 'aggressive', awake: e.ai !== 'wait' && k.ai !== 'wait',
          drop: e.drop || null, hidden: !!e.hidden, boss: !!e.boss || !!k.boss, tag: e.tag, trigger: e.trigger
        };
        u.hp = u.mhp; u.mp = u.mmp;
        this.units.push(u);
      });
      const L = G.st.leader();
      this.centerOn(L.x, L.y, true);
    }
    env() {
      return {
        tileOf: u => this.map.get(u.x, u.y),
        dist: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
        onKill: (u) => { u.gone = true; if (!u.enemy) { u.dead = true; u.defeats = (u.defeats || 0) + 1; } }
      };
    }
    alive(side) { return this.units.filter(u => !u.gone && u.hp > 0 && !u.hidden && (!side || u.side === side)); }
    unitAt(x, y) { return this.units.find(u => !u.gone && u.hp > 0 && !u.hidden && u.x === x && u.y === y); }
    dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

    // ---------- pathing ----------
    // Dijkstra over movement points. Opposing units block; friendly units can be passed through.
    reach(u, mov = R().mov(u), fromX = u.x, fromY = u.y) {
      const best = new Map(), prev = new Map();
      best.set(key(fromX, fromY), 0);
      const open = [[0, fromX, fromY]];
      while (open.length) {
        open.sort((a, b) => a[0] - b[0]);
        const [c, x, y] = open.shift();
        if (c > best.get(key(x, y))) continue;
        for (const [dx, dy] of DIR4) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h) continue;
          const cost = R().moveCost(u, this.map.get(nx, ny)); if (!isFinite(cost)) continue;
          const o = this.unitAt(nx, ny); if (o && o.side !== u.side) continue;
          const nc = c + cost; if (nc > mov + 1e-9) continue;
          const k = key(nx, ny);
          if (!best.has(k) || nc < best.get(k)) { best.set(k, nc); prev.set(k, key(x, y)); open.push([nc, nx, ny]); }
        }
      }
      // remove tiles occupied by others (can pass, can't stop)
      const stop = new Set();
      for (const k of best.keys()) { const [x, y] = k.split(',').map(Number); const o = this.unitAt(x, y); if (!o || o === u) stop.add(k); }
      return { cost: best, prev, stop };
    }
    pathTo(r, x, y) { const out = []; let k = key(x, y); while (k) { out.unshift(k.split(',').map(Number)); k = r.prev.get(k); } return out; }
    tilesInRange(x, y, rg) {
      const out = [];
      for (let dy = -rg[1]; dy <= rg[1]; dy++) for (let dx = -rg[1]; dx <= rg[1]; dx++) {
        const d = Math.abs(dx) + Math.abs(dy); if (d < rg[0] || d > rg[1]) continue;
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h) continue; out.push([nx, ny]);
      }
      return out;
    }
    areaTiles(x, y, r) { return this.tilesInRange(x, y, [0, r]); }
    targetsInRange(u, rg, side, x = u.x, y = u.y) {
      return this.tilesInRange(x, y, rg).map(([tx, ty]) => this.unitAt(tx, ty)).filter(o => o && o.side === side);
    }

    // ---------- camera ----------
    centerOn(x, y, snap) {
      const T = G.TILE;
      const mw = this.map.w * T, mh = this.map.h * T;
      let cx = x * T + T / 2 - G.W / 2, cy = y * T + T / 2 - G.H / 2;
      cx = mw <= G.W ? (mw - G.W) / 2 : G.clamp(cx, 0, mw - G.W);
      cy = mh <= G.H ? (mh - G.H) / 2 : G.clamp(cy, 0, mh - G.H);
      this.camT = { x: cx, y: cy }; if (snap) this.cam = { x: cx, y: cy };
    }
    *focus(x, y) { this.centerOn(x, y); for (let i = 0; i < 40; i++) { if (Math.abs(this.cam.x - this.camT.x) < 1 && Math.abs(this.cam.y - this.camT.y) < 1) break; yield 1; } this.cam.x = this.camT.x; this.cam.y = this.camT.y; }

    // ---------- movement animation ----------
    *walk(u, path, speed = 4) {
      for (let i = 1; i < path.length; i++) {
        const [px, py] = path[i - 1], [nx, ny] = path[i];
        const dx = nx - px, dy = ny - py;
        u.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
        const steps = Math.ceil(G.TILE / speed);
        for (let s = 1; s <= steps; s++) { u.ox = -dx * (G.TILE - s * speed); u.oy = -dy * (G.TILE - s * speed); if (s === 1) { u.x = nx; u.y = ny; } this.centerOn(u.x, u.y); yield 1; }
        u.ox = 0; u.oy = 0;
      }
    }

    // ---------- main loop ----------
    *main() {
      G.fade.a = 1; G.audio.play(this.def.music || 'battle');
      yield G.fadeTo(0, 0.05);
      if (this.def.intro) yield* this.def.intro(this);
      while (!this.result) {
        this.round++;
        const order = R().turnOrder(this.units.filter(u => !u.gone && u.hp > 0 && !u.hidden));
        for (const u of order) {
          if (u.gone || u.hp <= 0 || u.hidden) continue;
          yield* this.startTurn(u);
          if (u.gone || u.hp <= 0) { this.checkEnd(); if (this.result) break; continue; }
          if (u.status.sleep) { u.status.sleep--; yield* this.focus(u.x, u.y); yield G.say(u.name + ' is asleep.', { auto: 40 }); continue; }
          if (u.enemy || G.debugAuto || G.autoBattle) yield* this.enemyTurn(u); else yield* this.playerTurn(u);
          this.active = null; this.overlay = null; this.cursor = null; this.area = null;
          if (this.def.onAfterTurn) yield* this.def.onAfterTurn(this, u);
          this.checkEnd();
          if (this.result) break;
        }
      }
      yield* this.finish();
    }
    checkEnd() {
      const L = G.st.leader();
      if (this.recall) { this.result = 'recall'; return; }
      if (L.hp <= 0 || L.gone) { this.result = 'lose'; return; }
      if (this.def.win === 'boss') { if (this.units.some(u => u.boss && (u.gone || u.hp <= 0))) this.result = 'win'; }
      if (this.alive('enemy').length === 0 && !this.units.some(u => u.enemy && u.hidden && !u.gone)) this.result = 'win';
    }
    *startTurn(u) {
      // status countdowns
      if (u.status.quick) { u.status.quick--; if (!u.status.quick) delete u.status.quickPow; }
      if (u.status.sap) { u.status.sap--; if (!u.status.sap) delete u.status.sapPow; }
      if (u.status.poison) {
        yield* this.focus(u.x, u.y);
        const dmg = Math.max(1, Math.floor(u.mhp / 10));
        u.hp = Math.max(0, u.hp - dmg); G.audio.sfx('debuff'); this.flashUnit = { u, t: 16 };
        yield G.say(u.name + ' suffers ' + dmg + ' poison damage.', { auto: 45 });
        if (u.hp <= 0) { G.audio.sfx('die'); yield G.say(u.name + (u.enemy ? ' is defeated!' : ' has fallen!'), { auto: 45 }); this.env().onKill(u); }
      }
    }

    // ---------- player turn ----------
    *playerTurn(u) {
      this.active = u; u.dir = u.dir || 'down';
      yield* this.focus(u.x, u.y);
      const start = [u.x, u.y];
      let r = this.reach(u);
      this.overlay = r.stop; this.overlayColor = 'move';
      G.audio.sfx('select');
      while (true) {
        // ---- free movement inside the reach area ----
        this.cursor = null; this.overlay = r.stop; this.overlayColor = 'move';
        let acted = false;
        while (true) {
          yield 1;
          if (G.autoBattle && u.ox === 0 && u.oy === 0) { u.x = start[0]; u.y = start[1]; this.overlay = null; this.cursor = null; yield* this.enemyTurn(u); return; }
          const d = G.input.dir();
          if (d && u.ox === 0 && u.oy === 0) {
            const [dx, dy] = G.DIRS[d]; const nx = u.x + dx, ny = u.y + dy;
            u.dir = d;
            if (r.cost.has(key(nx, ny))) { yield* this.walk(u, [[u.x, u.y], [nx, ny]], 6); }
            continue;
          }
          if (G.input.p('B')) { if (u.x !== start[0] || u.y !== start[1]) { G.audio.sfx('cancel'); u.x = start[0]; u.y = start[1]; this.centerOn(u.x, u.y); } continue; }
          if (G.input.p('C')) { yield* this.lookMode(u.x, u.y); r = this.reach(u, R().mov(u), start[0], start[1]); this.overlay = r.stop; this.overlayColor = 'move'; continue; }
          if (G.input.p('A')) {
            const o = this.unitAt(u.x, u.y); if (o && o !== u) { G.audio.sfx('error'); continue; }
            break;
          }
        }
        // ---- action menu ----
        this.overlay = null;
        const tg = this.targetsInRange(u, R().range(u), 'enemy');
        const spells = R().spellLevelsKnown(u).filter(s => D().spells[s.id].kind !== 'recall' || true);
        const ch = yield G.cross({
          up: { label: 'Attack', icon: 'attack', disabled: tg.length === 0 },
          left: { label: 'Magic', icon: 'magic', disabled: spells.length === 0 },
          right: { label: 'Item', icon: 'item', disabled: u.items.length === 0 },
          down: { label: 'Stay', icon: 'stay' }
        }, { x: G.W / 2 - 40, y: G.H - 50 });
        const sel = ch && ch.result;
        if (!sel) continue;
        if (sel === 'down') { acted = true; }
        else if (sel === 'up') { acted = yield* this.doAttackCmd(u, tg); }
        else if (sel === 'left') { acted = yield* this.doMagicCmd(u); }
        else if (sel === 'right') { acted = yield* this.doItemCmd(u); }
        if (acted) break;
      }
      this.overlay = null; this.cursor = null;
      if (u.hp > 0) u.dir = 'down';
    }
    *doAttackCmd(u, targets) {
      const t = yield* this.pickTarget(u, targets, R().range(u), 'attack');
      if (!t) return false;
      yield* this.runAction({ actor: u, targets: [t], kind: 'attack' });
      return true;
    }
    *doMagicCmd(u) {
      while (true) {
        const w = yield G.spellMenu(u);
        const s = w.result; if (!s || G.autoBattle) return false;
        const sp = D().spells[s.id], L = sp.levels[s.lv - 1];
        if (sp.kind === 'recall') {
          const c = yield G.say('Use Recall to flee to the last church? The battle will be lost but EXP is kept.');
          const ok = yield G.confirm(); if (ok.result !== 0) continue;
          yield* this.runAction({ actor: u, targets: [u], kind: 'spell', spell: s.id, lvl: s.lv });
          this.recall = true; return true;
        }
        const side = sp.target === 'enemy' ? 'enemy' : 'ally';
        const res = yield* this.pickArea(u, L.range, L.area, side, sp);
        if (!res) continue;
        yield* this.runAction({ actor: u, targets: res, kind: 'spell', spell: s.id, lvl: s.lv });
        return true;
      }
    }
    *doItemCmd(u) {
      while (true) {
        const w = yield G.itemList(u, { title: u.name + '\'s items' });
        const idx = w.result; if (idx == null || idx < 0 || G.autoBattle) return false;
        const it = D().items[u.items[idx].id];
        const c = yield G.cross({ up: { label: 'Use', icon: 'use', disabled: it.type !== 'use' }, left: { label: 'Give', icon: 'give' }, right: { label: 'Equip', icon: 'equip', disabled: !G.st.canEquip(u, u.items[idx].id) }, down: { label: 'Drop', icon: 'drop', disabled: it.type === 'key' } }, { x: G.W / 2 - 40, y: G.H - 50 });
        const op = c.result; if (G.autoBattle) return false; if (!op) continue;
        if (op === 'up') {
          if (it.effect === 'recall') {
            yield G.say('Use the feather to flee to the last church? The battle will be lost but EXP is kept.');
            const ok = yield G.confirm(); if (ok.result !== 0) continue;
            u.items.splice(idx, 1); G.audio.sfx('warp'); G.fx.flash = 20; this.recall = true; return true;
          }
          const rg = it.range === 0 ? [0, 0] : [0, it.range];
          const cand = this.tilesInRange(u.x, u.y, rg).map(([x, y]) => this.unitAt(x, y)).filter(o => o && o.side === 'ally');
          const t = yield* this.pickTarget(u, cand, rg, 'heal');
          if (!t) continue;
          yield* this.runAction({ actor: u, targets: [t], kind: 'item', itemIdx: idx });
          return true;
        } else if (op === 'left') {
          const cand = this.tilesInRange(u.x, u.y, [1, 1]).map(([x, y]) => this.unitAt(x, y)).filter(o => o && o.side === 'ally');
          if (!cand.length) { yield G.say('There is nobody beside ' + u.name + ' to give it to.'); continue; }
          const t = yield* this.pickTarget(u, cand, [1, 1], 'heal');
          if (!t) continue;
          yield* G.giveItemFlow(u, idx, t);
          continue;
        } else if (op === 'right') {
          G.st.equip(u, idx); G.audio.sfx('ok');
          yield G.say(u.name + ' equips the ' + it.name + '.');
          continue;
        } else if (op === 'down') {
          yield G.say('Drop the ' + it.name + '? It will be lost.');
          const ok = yield G.confirm(); if (ok.result === 0) { u.items.splice(idx, 1); G.audio.sfx('cancel'); }
          continue;
        }
      }
    }
    *runAction(action) {
      action.bg = R().terrain(this.map.get((action.actor.enemy ? action.targets[0] : action.actor).x, (action.actor.enemy ? action.targets[0] : action.actor).y)).bg;
      if (action.actor.enemy === action.targets[0].enemy && action.actor.enemy) action.bg = R().terrain(this.map.get(action.actor.x, action.actor.y)).bg;
      if (this.def.bgOverride) action.bg = this.def.bgOverride;
      yield G.fadeTo(1, 0.15);
      const w = G.playAction(action, this.env());
      G.fade.a = 0; G.fade.target = 0;
      yield w;
      if (w.scene.recall) this.recall = true;
      G.fade.a = 1;
      yield G.fadeTo(0, 0.15);
      // death notices on the map (SF-style)
      for (const k of (w.result.killed || [])) { if (k.enemy && k.onDeath) yield* k.onDeath(this); }
      if (this.def.onKill) for (const k of (w.result.killed || [])) yield* this.def.onKill(this, k);
    }

    // target cycling among a list of units
    *pickTarget(u, targets, rg, mode) {
      if (!targets.length) return null;
      this.overlay = new Set(this.tilesInRange(u.x, u.y, rg).map(([x, y]) => key(x, y)));
      this.overlayColor = mode === 'attack' ? 'attack' : 'heal';
      targets.sort((a, b) => (a.y - b.y) || (a.x - b.x));
      let i = 0;
      this.cursor = { x: targets[0].x, y: targets[0].y }; this.infoTarget = targets[0];
      while (true) {
        yield 1;
        if (G.autoBattle) { this.overlay = null; this.cursor = null; this.infoTarget = null; return null; }
        const d = G.input.repDir(14, 8);
        if (d) { i = (i + (d === 'up' || d === 'left' ? -1 : 1) + targets.length) % targets.length; G.audio.sfx('cursor'); }
        const t = targets[i]; this.cursor = { x: t.x, y: t.y }; this.infoTarget = t; this.centerOn(t.x, t.y);
        if (u.x !== t.x || u.y !== t.y) u.dir = Math.abs(t.x - u.x) > Math.abs(t.y - u.y) ? (t.x > u.x ? 'right' : 'left') : (t.y > u.y ? 'down' : 'up');
        if (G.input.p('A')) { G.audio.sfx('ok'); this.overlay = null; this.cursor = null; this.infoTarget = null; return t; }
        if (G.input.p('B')) { G.audio.sfx('cancel'); this.overlay = null; this.cursor = null; this.infoTarget = null; this.centerOn(u.x, u.y); return null; }
      }
    }
    // free cursor within range with area-of-effect preview
    *pickArea(u, rg, radius, side, sp) {
      const inRange = new Set(this.tilesInRange(u.x, u.y, rg).map(([x, y]) => key(x, y)));
      this.overlay = inRange; this.overlayColor = side === 'enemy' ? 'attack' : 'heal';
      // start on nearest valid unit
      const cands = this.tilesInRange(u.x, u.y, rg).map(([x, y]) => this.unitAt(x, y)).filter(o => o && o.side === side);
      let cx = cands.length ? cands[0].x : u.x, cy = cands.length ? cands[0].y : u.y;
      if (!cands.length) { this.overlay = null; yield G.say('No one is within range.'); return null; }
      while (true) {
        this.cursor = { x: cx, y: cy };
        this.area = new Set(this.areaTiles(cx, cy, radius).map(([x, y]) => key(x, y)));
        const hit = this.areaTiles(cx, cy, radius).map(([x, y]) => this.unitAt(x, y)).filter(o => o && o.side === side);
        this.infoTarget = this.unitAt(cx, cy) || null;
        this.centerOn(cx, cy);
        yield 1;
        if (G.autoBattle) { this.overlay = null; this.cursor = null; this.area = null; this.infoTarget = null; return null; }
        const d = G.input.repDir(12, 6);
        if (d) { const [dx, dy] = G.DIRS[d]; if (inRange.has(key(cx + dx, cy + dy))) { cx += dx; cy += dy; G.audio.sfx('cursor'); } }
        if (G.input.p('A')) {
          if (!hit.length) { G.audio.sfx('error'); continue; }
          G.audio.sfx('ok'); this.overlay = null; this.cursor = null; this.area = null; this.infoTarget = null;
          // order: center first
          hit.sort((a, b) => this.dist(a, { x: cx, y: cy }) - this.dist(b, { x: cx, y: cy }));
          return hit;
        }
        if (G.input.p('B')) { G.audio.sfx('cancel'); this.overlay = null; this.cursor = null; this.area = null; this.infoTarget = null; this.centerOn(u.x, u.y); return null; }
      }
    }
    // look around the map (C button); A on a unit shows its move+attack reach
    *lookMode(x, y) {
      const saveO = this.overlay, saveC = this.overlayColor;
      this.overlay = null; this.cursor = { x, y };
      while (true) {
        yield 1;
        if (G.autoBattle) break;
        const d = G.input.repDir(10, 4);
        if (d) { const [dx, dy] = G.DIRS[d]; this.cursor.x = G.clamp(this.cursor.x + dx, 0, this.map.w - 1); this.cursor.y = G.clamp(this.cursor.y + dy, 0, this.map.h - 1); this.centerOn(this.cursor.x, this.cursor.y); this.overlay = null; }
        this.infoTarget = this.unitAt(this.cursor.x, this.cursor.y) || null;
        if (G.input.p('A') && this.infoTarget) {
          const o = this.infoTarget; const r = this.reach(o);
          const s = new Set(r.stop);
          const rg = R().range(o);
          for (const k of r.stop) { const [ax, ay] = k.split(',').map(Number); this.tilesInRange(ax, ay, rg).forEach(([tx, ty]) => s.add(key(tx, ty))); }
          this.overlay = s; this.overlayColor = o.enemy ? 'attack' : 'move';
          G.audio.sfx('select');
        } else if (G.input.p('A') && !this.infoTarget) {
          // quick status
        }
        if (G.input.p('C') && this.infoTarget) { yield G.statusScreen(this.infoTarget); }
        if (G.input.p('B')) { G.audio.sfx('cancel'); break; }
      }
      this.cursor = null; this.infoTarget = null; this.overlay = saveO; this.overlayColor = saveC;
      if (this.active) this.centerOn(this.active.x, this.active.y);
    }

    // ---------- enemy AI ----------
    threatSet(u) {
      const r = this.reach(u); const rg = R().range(u); const s = new Set();
      for (const k of r.stop) { const [ax, ay] = k.split(',').map(Number); this.tilesInRange(ax, ay, rg).forEach(([tx, ty]) => s.add(key(tx, ty))); }
      return s;
    }
    expected(att, tgt, tile) {
      let d = Math.max(1, R().stat(att, 'att') - R().stat(tgt, 'def'));
      const le = R().landEffect(tgt, tile); if (le === 15) d = d * 230 / 256; else if (le >= 30) d = d * 205 / 256;
      return d;
    }
    *enemyTurn(u) {
      this.active = u;
      if (u.enemy && !u.awake) {
        // wake if any ally is inside this unit's threat area, or if it was damaged
        const th = this.threatSet(u);
        if (u.hp < u.mhp || this.alive('ally').some(a => th.has(key(a.x, a.y)))) u.awake = true;
        else return;
      }
      yield* this.focus(u.x, u.y);
      yield 10;
      const plan = this.planEnemy(u);
      if (plan.path && plan.path.length > 1) { yield* this.walk(u, plan.path, 4); yield 6; }
      if (plan.kind === 'attack') {
        const t = plan.targets[0];
        u.dir = Math.abs(t.x - u.x) > Math.abs(t.y - u.y) ? (t.x > u.x ? 'right' : 'left') : (t.y > u.y ? 'down' : 'up');
        this.cursor = { x: t.x, y: t.y }; yield 16; this.cursor = null;
        yield* this.runAction({ actor: u, targets: plan.targets, kind: 'attack' });
      } else if (plan.kind === 'spell') {
        this.area = new Set(plan.targets.map(t => key(t.x, t.y))); this.cursor = { x: plan.targets[0].x, y: plan.targets[0].y }; yield 20; this.area = null; this.cursor = null;
        yield* this.runAction({ actor: u, targets: plan.targets, kind: 'spell', spell: plan.spell, lvl: plan.lvl });
      } else yield 8;
      u.dir = 'down';
    }
    planEnemy(u) {
      const FOE = u.side === 'ally' ? 'enemy' : 'ally', OWN = u.side;
      const allies = this.alive(FOE);
      const r = u.ai === 'guard' ? { stop: new Set([key(u.x, u.y)]), prev: new Map(), cost: new Map([[key(u.x, u.y), 0]]) } : this.reach(u);
      let best = null;
      const consider = (score, plan) => { if (!best || score > best.score) best = Object.assign({ score }, plan); };
      // allies on auto: weigh how many foes could reach a tile (the leader is far more careful)
      let danger = null;
      if (OWN === 'ally') {
        danger = new Map();
        for (const f of allies) for (const k of this.threatSet(f)) danger.set(k, (danger.get(k) || 0) + 1);
      }
      const isLeader = u.id === 'rowan', hurt = u.hp / u.mhp;
      const riskW = OWN !== 'ally' ? 0 : (isLeader ? (hurt < 0.5 ? 14 : 5) : (hurt < 0.35 ? 6 : 1));
      const risk = (tx, ty) => danger ? (danger.get(key(tx, ty)) || 0) * riskW : 0;
      const tiles = [...r.stop].map(k => k.split(',').map(Number));
      const rg = R().range(u);
      const spells = R().spellLevelsKnown(u);
      for (const [tx, ty] of tiles) {
        const le = R().landEffect(u, this.map.get(tx, ty));
        const moveCost = (r.cost.get(key(tx, ty)) || 0);
        // physical attacks
        for (const t of this.targetsInRange(u, rg, FOE, tx, ty)) {
          const e = this.expected(u, t, this.map.get(t.x, t.y));
          let s = e * 3 + (e >= t.hp ? 60 : 0) + (1 - t.hp / t.mhp) * 12 + le / 10 - moveCost * 0.01 - risk(tx, ty);
          if (t.id === 'rowan') s += 6; if (t.boss) s += 4;
          if (R().cls(t) && R().cls(t).healer) s += 4;
          consider(s, { kind: 'attack', tile: [tx, ty], targets: [t] });
        }
        // spells
        for (const sp of spells) {
          const S = D().spells[sp.id];
          for (let lv = sp.lv; lv >= 1; lv--) {
            const L = S.levels[lv - 1]; if (u.mp < L.mp) continue;
            if (S.kind === 'heal') {
              for (const [cx, cy] of this.tilesInRange(tx, ty, L.range)) {
                const o = this.unitAt(cx, cy) || ((cx === tx && cy === ty) ? u : null);
                if (!o || o.side !== OWN || o.hp >= o.mhp * 0.7) continue;
                const s = (o.mhp - o.hp) * 3 + (o.boss ? 20 : 0) + (o.id === 'rowan' ? 25 : 0) + 30 - risk(tx, ty) * 0.5;
                consider(s, { kind: 'spell', spell: sp.id, lvl: lv, tile: [tx, ty], targets: [o] });
              }
            } else if (S.kind === 'damage' || S.kind === 'poison') {
              for (const [cx, cy] of this.tilesInRange(tx, ty, L.range)) {
                const hit = this.areaTiles(cx, cy, L.area).map(([x, y]) => this.unitAt(x, y)).filter(o => o && o.side === FOE);
                if (!hit.length) continue;
                let s = 0;
                hit.forEach(o => { const p = S.kind === 'damage' ? L.power : 4; s += p * 3 + (p >= o.hp ? 60 : 0); });
                s -= L.mp * 0.5; if (S.kind === 'poison' && hit.every(o => o.status.poison)) s = -1;
                consider(s + 2 - risk(tx, ty), { kind: 'spell', spell: sp.id, lvl: lv, tile: [tx, ty], targets: hit });
              }
            }
          }
        }
      }
      if (best && !(OWN === 'ally' && best.score < 0 && hurt < 0.5)) { best.path = this.pathTo(r, best.tile[0], best.tile[1]); return best; }
      // hurt ally on auto: fall back toward a healer, else the safest tile
      if (OWN === 'ally' && hurt < 0.5) {
        const healer = this.alive('ally').find(a => a !== u && R().cls(a) && R().cls(a).healer);
        let bt = null, bv = Infinity;
        for (const [tx, ty] of tiles) { const sc = risk(tx, ty) * 10 + (healer ? Math.abs(tx - healer.x) + Math.abs(ty - healer.y) : 0); if (sc < bv) { bv = sc; bt = [tx, ty]; } }
        if (bt) return { kind: 'none', path: this.pathTo(r, bt[0], bt[1]) };
      }
      // approach: distance field from allies (terrain-aware, ignoring units)
      if (u.ai === 'guard') return { kind: 'none' };
      const field = new Map(); const open = [];
      allies.forEach(a => { this.tilesInRange(a.x, a.y, rg).forEach(([x, y]) => { if (isFinite(R().moveCost(u, this.map.get(x, y)))) { field.set(key(x, y), 0); open.push([0, x, y]); } }); });
      while (open.length) {
        open.sort((a, b) => a[0] - b[0]); const [c, x, y] = open.shift();
        if (c > field.get(key(x, y))) continue;
        for (const [dx, dy] of DIR4) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h) continue;
          const mc = R().moveCost(u, this.map.get(nx, ny)); if (!isFinite(mc)) continue;
          const nc = c + mc; const k = key(nx, ny);
          if (!field.has(k) || nc < field.get(k)) { field.set(k, nc); open.push([nc, nx, ny]); }
        }
      }
      let bt = null, bv = Infinity;
      for (const [tx, ty] of tiles) { const v = field.has(key(tx, ty)) ? field.get(key(tx, ty)) : Infinity; const le = R().landEffect(u, this.map.get(tx, ty)); const sc = v - le / 100 + risk(tx, ty) * (isLeader ? 0.6 : 0.15); if (sc < bv) { bv = sc; bt = [tx, ty]; } }
      if (!bt) return { kind: 'none' };
      return { kind: 'none', path: this.pathTo(r, bt[0], bt[1]) };
    }

    // ---------- end of battle ----------
    *finish() {
      this.active = null; this.overlay = null;
      const res = this.result;
      if (res === 'win') {
        G.audio.jingle('victory');
        yield 30;
        if (this.def.outro) yield* this.def.outro(this);
      } else if (res === 'lose') {
        G.audio.play('sad');
        yield G.say(G.st.leader().name + ' has fallen... The force retreats.', { auto: 0 });
      } else if (res === 'recall') {
        yield 20;
      }
      yield G.fadeTo(1, 0.03);
      // cleanup
      this.units.forEach(u => { if (!u.enemy) { delete u.x; delete u.y; delete u.ox; delete u.oy; delete u.side; delete u.gone; u.status = {}; } });
      G.onBattleEnd(this.id, res);
    }

    // ---------- scene hooks ----------
    update() {
      this.t++;
      this.tasks.update();
      if (this.flashUnit && --this.flashUnit.t <= 0) this.flashUnit = null;
      this.cam.x += (this.camT.x - this.cam.x) * 0.25; this.cam.y += (this.camT.y - this.cam.y) * 0.25;
      if (Math.abs(this.camT.x - this.cam.x) < 0.5) this.cam.x = this.camT.x; if (Math.abs(this.camT.y - this.cam.y) < 0.5) this.cam.y = this.camT.y;
    }
    draw(ctx) {
      const T = G.TILE; const cx = Math.round(this.cam.x), cy = Math.round(this.cam.y);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      const x0 = Math.floor(cx / T), y0 = Math.floor(cy / T);
      for (let y = y0; y <= y0 + Math.ceil(G.H / T) + 1; y++) for (let x = x0; x <= x0 + Math.ceil(G.W / T) + 1; x++) {
        if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) continue;
        G.drawTile(ctx, this.map, x, y, x * T - cx, y * T - cy, this.t);
      }
      // overlays
      const pulse = 0.22 + 0.14 * Math.sin(this.t / 8);
      const colMap = { move: '#ffffff', attack: '#ff3030', heal: '#60ff90' };
      if (this.overlay) {
        ctx.fillStyle = colMap[this.overlayColor] || '#fff'; ctx.globalAlpha = pulse;
        for (const k of this.overlay) { const [x, y] = k.split(',').map(Number); ctx.fillRect(x * T - cx + 1, y * T - cy + 1, T - 2, T - 2); }
        ctx.globalAlpha = 1;
      }
      if (this.area) {
        ctx.fillStyle = '#ffe040'; ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.t / 5);
        for (const k of this.area) { const [x, y] = k.split(',').map(Number); ctx.fillRect(x * T - cx + 1, y * T - cy + 1, T - 2, T - 2); }
        ctx.globalAlpha = 1;
      }
      // units (y-sorted)
      const us = this.units.filter(u => !u.gone && u.hp > 0 && !u.hidden).sort((a, b) => (a.y * T + a.oy) - (b.y * T + b.oy));
      for (const u of us) {
        const spec = u.enemy ? u.kind.map : D().chars[u.id].map;
        const isAct = u === this.active;
        const fr = Math.floor((this.t + (u.x * 7 + u.y * 3)) / (isAct ? 8 : 16)) % 2;
        const img = G.unitSprite(spec, u.dir || 'down', fr);
        const px = u.x * T + u.ox - cx, py = u.y * T + u.oy - cy - 3;
        if (px < -T || py < -T || px > G.W || py > G.H) continue;
        ctx.drawImage(img, Math.round(px), Math.round(py));
        if (this.flashUnit && this.flashUnit.u === u && this.flashUnit.t % 4 < 2) ctx.drawImage(G.tinted(img, '#80ff80', JSON.stringify(spec) + u.dir + fr), Math.round(px), Math.round(py));
        if (u.status.poison) { ctx.fillStyle = '#60e060'; ctx.fillRect(px + 19, py + 2, 3, 3); }
        if (u.status.quick) { ctx.fillStyle = '#80c0ff'; ctx.fillRect(px + 1, py + 2, 3, 3); }
        if (u.status.sap) { ctx.fillStyle = '#c060c0'; ctx.fillRect(px + 1, py + 6, 3, 3); }
      }
      // active marker
      if (this.active && !this.cursor && (this.t >> 3) % 2 === 0) this.drawBracket(ctx, this.active.x * T + this.active.ox - cx, this.active.y * T + this.active.oy - cy, '#fff');
      if (this.cursor) this.drawBracket(ctx, this.cursor.x * T - cx, this.cursor.y * T - cy, (this.t >> 2) % 2 ? '#ffe040' : '#fff');
      // HUD
      if (this.hud && G.top() === this) this.drawHUD(ctx);
      if (G.autoBattle && (this.t >> 4) % 4 !== 3) { G.win(ctx, G.W / 2 - 26, 4, 52, 18); G.textC(ctx, 'AUTO', G.W / 2, 9, '#80ff90'); }
    }
    drawBracket(ctx, x, y, col) {
      ctx.fillStyle = col; const T = G.TILE; x = Math.round(x); y = Math.round(y);
      const L = 6;
      ctx.fillRect(x, y, L, 2); ctx.fillRect(x, y, 2, L); ctx.fillRect(x + T - L, y, L, 2); ctx.fillRect(x + T - 2, y, 2, L);
      ctx.fillRect(x, y + T - 2, L, 2); ctx.fillRect(x, y + T - L, 2, L); ctx.fillRect(x + T - L, y + T - 2, L, 2); ctx.fillRect(x + T - 2, y + T - L, 2, L);
    }
    unitWin(ctx, u, x, y) {
      const w = 120, h = u.mmp > 0 ? 44 : 34;
      G.win(ctx, x, y, w, h);
      G.text(ctx, u.name, x + 8, y + 6, u.enemy ? '#ff9090' : '#fff');
      G.textR(ctx, (u.enemy ? '' : D().classes[u.cls].name.slice(0, 8) + ' ') + 'L' + u.lv, x + w - 8, y + 6, '#f8e060');
      G.text(ctx, 'HP', x + 8, y + 17, '#a0c0ff'); G.bar(ctx, x + 22, y + 18, 50, u.hp, u.mhp, u.hp / u.mhp < 0.3 ? '#f06040' : '#f8d030'); G.textR(ctx, u.hp + '/' + u.mhp, x + w - 7, y + 17);
      if (u.mmp > 0) { G.text(ctx, 'MP', x + 8, y + 27, '#a0c0ff'); G.bar(ctx, x + 22, y + 28, 50, u.mp, u.mmp, '#60a0ff'); G.textR(ctx, u.mp + '/' + u.mmp, x + w - 7, y + 27); }
      return h;
    }
    drawHUD(ctx) {
      const T = G.TILE;
      const u = this.active;
      if (!u || (u.enemy && !this.cursor && this.tasks.busy && this.infoTarget == null && false)) return;
      const focusU = u;
      if (focusU) {
        const sy = focusU.y * T - this.cam.y;
        const top = sy > G.H / 2;
        const y = top ? 4 : G.H - 50;
        this.unitWin(ctx, focusU, 4, y);
        // land effect
        const le = R().landEffect(focusU, this.map.get(focusU.x, focusU.y));
        G.win(ctx, G.W - 70, y, 66, 30);
        G.text(ctx, 'LAND', G.W - 62, y + 6, '#a0c0ff'); G.text(ctx, 'EFFECT', G.W - 62, y + 16, '#a0c0ff');
        G.textR(ctx, le + '%', G.W - 10, y + 11);
      }
      const it = this.infoTarget;
      if (it && it !== focusU) {
        const sy = it.y * T - this.cam.y; const top = sy > G.H / 2;
        this.unitWin(ctx, it, G.W - 124 - 70, top ? 4 : G.H - 50);
      }
    }
  }
  G.Battle = Battle;
  // ---------- Auto-battle toggle (T key) ----------
  G.autoBattle = !!G.store.get('embers_auto');
  G.toggleAuto = function () {
    G.autoBattle = !G.autoBattle;
    G.store.set('embers_auto', G.autoBattle);
    G.audio.sfx(G.autoBattle ? 'ok' : 'cancel');
    G.toast('Auto-battle: ' + (G.autoBattle ? 'ON' : 'OFF') + '   (T)');
    // close any open battle menus so the AI can take over this turn
    if (G.autoBattle && G.scenes[0] instanceof Battle) {
      let guard = 10;
      while (guard-- > 0 && G.top() !== G.scenes[0] && typeof G.top().cancel === 'function') G.top().cancel();
    }
  };
  G.battles = {};
  G.startBattle = function (id, opts) { const b = new Battle(id, opts); G.replace(b); return b; };
})();
