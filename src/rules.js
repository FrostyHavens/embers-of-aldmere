// ===== Rules: stats, land effect, turn order, combat resolution, EXP (SF2-style formulas) =====
'use strict';
(function () {
  const R = G.rules = {};
  const D = () => G.data;

  // ---------- Stat helpers (work for both party members and enemies) ----------
  R.cls = u => u.enemy ? null : D().classes[u.cls];
  R.moveType = u => u.enemy ? u.kind.move : R.cls(u).move;
  R.isArcher = u => u.enemy ? !!u.kind.archer : !!R.cls(u).archer;
  R.isFlyer = u => { const m = R.moveType(u); return m === 'flying' || m === 'hover'; };
  R.weapon = u => { const it = (u.items || []).find(i => i.eq && D().items[i.id].type === 'weapon'); return it ? D().items[it.id] : null; };
  R.ring = u => { const it = (u.items || []).find(i => i.eq && D().items[i.id].type === 'ring'); return it ? D().items[it.id] : null; };
  R.stat = function (u, s) {
    let v = u[s] || 0;
    if (!u.enemy) {
      if (s === 'att') { const w = R.weapon(u); if (w) v += w.att; }
      const r = R.ring(u); if (r && r.bonus[s]) v += r.bonus[s];
    }
    if (u.status) {
      if (u.status.quick && (s === 'agi' || s === 'def')) v += u.status.quickPow || 5;
      if (u.status.sap && (s === 'agi' || s === 'def')) v -= u.status.sapPow || 5;
    }
    return Math.max(0, v);
  };
  R.range = function (u) {
    if (u.enemy) return u.kind.range;
    const w = R.weapon(u); return w ? w.range : [1, 1];
  };
  R.prowess = function (u) {
    const src = u.enemy ? u.kind : R.cls(u);
    return { crit: src.crit || [32, 0.25], dbl: src.dbl || 32, ctr: src.ctr || 32, critPoison: !!src.critPoison };
  };
  R.effLevel = u => u.lv + (!u.enemy && R.cls(u).promoted ? 20 : 0);
  R.mov = function (u) {
    if (u.enemy) return u.kind.mov;
    let m = R.cls(u).mov; if (u.status && u.status.sap) m = Math.max(1, m - 1); return m;
  };

  // ---------- Terrain ----------
  R.terrain = code => G.TERRAIN[code] || G.TERRAIN['.'];
  R.moveCost = function (u, code) {
    const t = R.terrain(code); const m = R.moveType(u);
    const key = m === 'flying' ? 'flying' : m === 'hover' ? 'hover' : m === 'mounted' ? 'mounted' : 'foot';
    const c = t.cost[key]; return c == null ? Infinity : c;
  };
  R.landEffect = function (u, code) {
    if (R.moveType(u) === 'flying') return 0; // fliers never benefit from terrain
    return R.terrain(code).le || 0;
  };

  // ---------- Turn order ----------
  R.turnOrder = function (units) {
    const list = [];
    units.forEach(u => {
      if (u.hp <= 0 || u.gone) return;
      const agi = R.stat(u, 'agi');
      const base = agi & 127; // cap before variance
      let v = base + G.r(Math.floor(base / 8) + 1) - G.r(Math.floor(base / 8) + 1) + (G.r(3) - 1);
      list.push({ u, v });
      if (agi >= 128) { const a2 = Math.floor(base * 5 / 6); list.push({ u, v: a2 + G.r(Math.floor(a2 / 8) + 1) - G.r(Math.floor(a2 / 8) + 1) }); }
    });
    list.sort((a, b) => b.v - a.v);
    return list.map(e => e.u);
  };

  // ---------- EXP ----------
  R.killExp = function (actor, target) {
    const diff = R.effLevel(actor) - R.effLevel(target);
    if (diff < 3) return 50; if (diff === 3) return 40; if (diff === 4) return 30; if (diff === 5) return 20; if (diff === 6) return 10; return 0;
  };
  R.finalizeExp = function (x) {
    if (G.chance(16)) x++; if (G.chance(16)) x--; return Math.max(1, x);
  };

  // ---------- Physical attack ----------
  // returns {dodge, dmg, crit, poison}
  R.rollAttack = function (att, tgt, tgtTile, isCounter) {
    const res = { dodge: false, dmg: 0, crit: false, poison: false };
    const asleep = tgt.status && (tgt.status.sleep || tgt.status.stun);
    if (!asleep) {
      let n = 32;
      if (att.status && att.status.muddle) n = 2;
      else if (R.isFlyer(tgt) && !R.isArcher(att)) n = 8;
      if (G.chance(n)) { res.dodge = true; return res; }
    }
    let d = R.stat(att, 'att') - R.stat(tgt, 'def');
    if (d <= 0) d = 1;
    const le = R.landEffect(tgt, tgtTile);
    if (le === 15) d = Math.floor(d * 230 / 256); else if (le >= 30) d = Math.floor(d * 205 / 256);
    if (R.isFlyer(tgt) && R.isArcher(att)) d += Math.floor(d / 4);
    const p = R.prowess(att);
    if (G.chance(p.crit[0])) {
      res.crit = true;
      if (p.critPoison) res.poison = true; else d += Math.floor(d * p.crit[1]);
    }
    if (isCounter) d = Math.floor(d / 2);
    d = R.variance(d);
    res.dmg = d;
    return res;
  };
  R.variance = function (d) {
    const k = Math.floor(d / 8) + 1;
    d -= G.r(k); d -= G.r(k);
    return Math.max(1, d);
  };

  // ---------- Spells ----------
  R.spellPower = function (caster, spellId, lvl, target) {
    const sp = D().spells[spellId], L = sp.levels[lvl - 1];
    let p = L.power;
    if (!caster.enemy && R.cls(caster).promoted) p = Math.floor(p * 5 / 4);
    if (sp.kind === 'damage') {
      const res = target.enemy ? (target.kind.resist || {})[sp.elem] : null;
      const q = Math.floor(p / 4);
      if (res === 'minor') p -= q; else if (res === 'major') p = Math.floor(p / 2); else if (res === 'weak') p += q;
      let crit = false;
      if (G.chance(32)) { p += q; crit = true; }
      return { dmg: R.variance(p), crit, resist: res };
    }
    return { amount: p };
  };
  R.spellLevelsKnown = function (u) {
    // returns [{id, lv}] highest level learned for each
    if (u.enemy) return (u.kind.spells || []).map(([id, lv]) => ({ id, lv }));
    return Object.keys(u.spells || {}).map(id => ({ id, lv: u.spells[id] })).filter(s => s.lv > 0);
  };

  // ---------- Leveling ----------
  const STATS = ['hp', 'mp', 'att', 'def', 'agi'];
  R.targetStat = function (u, s) {
    const c = D().chars[u.id]; const curve = D().curves[c.curve] || D().curves.linear;
    if (R.cls(u).promoted) {
      const base = u.promoBase[s], g = c.pgrowth[s];
      const L = Math.min(u.lv, 20); let t = base + g * curve(L);
      if (u.lv > 20) t += (u.lv - 20) * g / 40;
      return t;
    }
    const [a, b] = c.stats[s];
    if (u.lv <= 20) return a + (b - a) * curve(u.lv);
    return b + (u.lv - 20) * (b - a) / 38;
  };
  // apply one level up; returns gains object
  R.levelUp = function (u) {
    u.lv++;
    const gains = {};
    STATS.forEach(s => {
      const key = s === 'hp' ? 'mhp' : s === 'mp' ? 'mmp' : s;
      const cur = u[key];
      const t = R.targetStat(u, s);
      if (t <= 0 && cur <= 0) { gains[s] = 0; return; }
      let g = t - cur;
      // random variance around the projected curve: -1..+2 (rare), never negative
      const rv = G.r(8); g += rv === 0 ? -1 : rv >= 6 ? 1 : 0; if (G.chance(24)) g += 2;
      g = Math.max(0, Math.round(g));
      if (s === 'hp' || s === 'mp' || s === 'att' || s === 'def' || s === 'agi') { if (g === 0 && t > cur + 0.3 && G.chance(2)) g = 1; }
      u[key] = cur + g; gains[s] = g;
      if (s === 'hp') u.hp += g; if (s === 'mp') u.mp += g;
    });
    // spells learned
    const learned = [];
    const c = D().chars[u.id];
    (c.spells || []).forEach(([id, ...lvls]) => {
      if (R.cls(u).promoted) return; // spells are learned during base-class levels in this model; promoted: handled by promoLearn
      lvls.forEach((L, i) => { if (u.lv === L && (u.spells[id] || 0) < i + 1) { u.spells[id] = i + 1; learned.push({ id, lv: i + 1 }); } });
    });
    if (R.cls(u).promoted) {
      (c.spells || []).forEach(([id, ...lvls]) => {
        lvls.forEach((L, i) => { const eff = u.lv + 20; if ((u.spells[id] || 0) < i + 1 && eff >= L && L > u.promoLv) { u.spells[id] = i + 1; learned.push({ id, lv: i + 1 }); } });
      });
    }
    return { gains, learned };
  };
  R.maxLevel = u => R.cls(u).promoted ? 99 : 40;
})();
