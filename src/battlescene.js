// ===== Side-view battle cutscene: plays one action (attack / spell / item) and applies results =====
'use strict';
(function () {
  const D = () => G.data, R = () => G.rules;

  // action: {actor, targets:[unit], kind:'attack'|'spell'|'item', spell, lvl, itemIdx, bg}
  // env: {tileOf(u), dist(a,b), onKill(u,killer)}
  class BattleScene {
    constructor(action, env, w) {
      this.a = action; this.env = env; this.w = w; this.t = 0;
      this.tasks = new G.Tasks();
      this.msgLines = []; this.msgShown = 0; this.msgWait = null;
      this.left = null; this.right = null; // {u, pose, x, y, alpha, flash, off}
      this.fxList = [];
      this.exp = 0; this.gold = 0; this.expCap = 49; this.killed = [];
      this.bgKey = action.bg || 'grass';
      this.slide = 1;
      this.tasks.add(this.run());
    }
    // ---------- message box ----------
    msg(text, hold = 30) {
      this.msgLines.push(text); if (this.msgLines.length > 3) this.msgLines.shift();
      this.msgChars = 0; this.msgTarget = text.length; this.msgHold = hold;
      const self = this; return { done: () => self.msgChars >= self.msgTarget && --self.msgHold <= 0 };
    }
    clearMsg() { this.msgLines = []; }
    // ---------- actors ----------
    specOf(u) { return u.enemy ? u.kind.map : D().chars[u.id].map; }
    actor(u, side) {
      return { u, side, pose: 'idle', x: side === 'left' ? 44 : 180, y: 98, off: 0, alpha: 1, flash: 0, shake: 0,
        facing: side === 'left' ? 'right' : 'left', hpShown: u.hp, mpShown: u.mp };
    }
    sideOf(u) { return u.enemy ? 'left' : 'right'; }
    setupPair(actor, target) {
      // enemies on left facing right, allies on right facing left. Two allies (healing): target on left facing right.
      if (actor.enemy === target.enemy) {
        if (actor === target) { this.right = actor.enemy ? null : this.actor(actor, 'right'); this.left = actor.enemy ? this.actor(actor, 'left') : null; }
        else if (actor.enemy) { this.left = this.actor(actor, 'left'); this.right = this.actor(target, 'right'); this.right.facing = 'left'; }
        else { this.right = this.actor(actor, 'right'); this.left = this.actor(target, 'left'); }
      } else {
        this.left = this.actor(actor.enemy ? actor : target, 'left');
        this.right = this.actor(actor.enemy ? target : actor, 'right');
      }
    }
    view(u) { if (this.left && this.left.u === u) return this.left; if (this.right && this.right.u === u) return this.right; return null; }
    showTarget(target, actor) {
      // swap the non-actor slot to a new target
      const av = this.view(actor);
      const side = av && av.side === 'left' ? 'right' : 'left';
      const v = this.actor(target, side); if (side === 'left') v.facing = 'right';
      if (side === 'left') this.left = v; else this.right = v;
      return v;
    }
    *wait(n) { yield n; }
    // ---------- main flow ----------
    *run() {
      const a = this.a, actor = a.actor;
      const first = a.targets[0];
      this.setupPair(actor, first);
      this.startExp = actor.exp;
      G.audio.sfx('select');
      // slide in
      for (let i = 0; i <= 12; i++) { this.slide = 1 - i / 12; yield 1; }
      this.slide = 0;
      if (a.kind === 'attack') yield* this.doAttack(actor, first, false);
      else if (a.kind === 'spell') yield* this.doSpell(actor, a.spell, a.lvl, a.targets, false);
      else if (a.kind === 'item') yield* this.doItem(actor, a.itemIdx, a.targets[0]);
      // EXP & gold (allies only)
      if (!actor.enemy && actor.hp > 0 && this.exp > 0) {
        const gained = R().finalizeExp(Math.min(this.exp, this.expCap));
        yield this.msg(actor.name + ' gains ' + gained + ' EXP.', 40);
        actor.exp += gained;
        while (actor.exp >= 100 && actor.lv < R().maxLevel(actor)) {
          actor.exp -= 100;
          const lu = R().levelUp(actor);
          G.audio.jingle('levelup');
          yield this.msg(actor.name + ' is now level ' + actor.lv + '!', 50);
          const names = { hp: 'HP', mp: 'MP', att: 'ATT', def: 'DEF', agi: 'AGI' };
          const parts = [];
          for (const k of ['att', 'def', 'agi', 'hp', 'mp']) if (lu.gains[k] > 0) parts.push(names[k] + ' +' + lu.gains[k]);
          for (let i = 0; i < parts.length; i += 3) yield this.msg(parts.slice(i, i + 3).join('  '), 36);
          for (const l of lu.learned) yield this.msg('Learned ' + D().spells[l.id].name + ' ' + l.lv + '!', 44);
          const v = this.view(actor); if (v) { v.hpShown = actor.hp; v.mpShown = actor.mp; }
        }
      }
      if (this.gold > 0) { G.state.gold += this.gold; G.audio.sfx('coin'); yield this.msg('Found ' + this.gold + ' gold coins.', 40); }
      if (this.drops && this.drops.length) {
        for (const id of this.drops) { const who = G.st.giveItem(id); G.audio.sfx('item'); yield this.msg((who ? who.name + ' picks up ' : 'Sent to the depot: ') + D().items[id].name + '.', 44); }
      }
      yield 20;
      for (let i = 0; i <= 10; i++) { this.fadeOut = i / 10; yield 1; }
      G.pop(); this.w.resolve({ killed: this.killed });
    }

    // physical attack sequence including double/counter
    *doAttack(att, tgt, isCounter) {
      const av = this.view(att), tv = this.view(tgt);
      const ranged = this.env.dist(att, tgt) > 1 || (R().range(att)[0] > 1);
      if (isCounter) yield this.msg(att.name + ' counterattacks!', 16);
      else yield this.msg(att.name + ' attacks!', 12);
      // wind up
      av.pose = 'ready'; G.audio.sfx(ranged ? 'swing' : 'swing'); yield 14;
      const res = R().rollAttack(att, tgt, this.env.tileOf(tgt), isCounter);
      if (ranged) {
        av.pose = 'attack'; G.audio.sfx('arrow');
        yield* this.projectile(av, tv, this.projKind(att));
      } else {
        // lunge
        for (let i = 1; i <= 6; i++) { av.off = (av.side === 'left' ? 1 : -1) * i * 7; if (i === 3) av.pose = 'attack'; yield 1; }
      }
      if (res.dodge) {
        G.audio.sfx('miss');
        for (let i = 1; i <= 6; i++) { tv.off = (tv.side === 'left' ? -1 : 1) * i * 4; yield 1; }
        yield this.msg(tgt.name + ' dodges!', 24);
        for (let i = 5; i >= 0; i--) { tv.off = (tv.side === 'left' ? -1 : 1) * i * 4; yield 1; }
      } else {
        yield* this.hit(att, tgt, res.dmg, res.crit, res.poison);
      }
      // return to place
      for (let i = 5; i >= 0; i--) { av.off = (av.side === 'left' ? 1 : -1) * i * 7; yield 1; }
      av.pose = 'idle';
      if (tgt.hp <= 0 || att.hp <= 0 || isCounter) return;
      // double attack, then counter (target's prowess)
      const p = R().prowess(att), q = R().prowess(tgt);
      const dbl = G.chance(p.dbl);
      const ctr = G.chance(q.ctr);
      if (dbl) {
        yield this.msg(att.name + ' strikes again!', 12);
        av.pose = 'ready'; yield 10;
        const r2 = R().rollAttack(att, tgt, this.env.tileOf(tgt), false);
        if (ranged) { av.pose = 'attack'; G.audio.sfx('arrow'); yield* this.projectile(av, tv, this.projKind(att)); }
        else for (let i = 1; i <= 6; i++) { av.off = (av.side === 'left' ? 1 : -1) * i * 7; if (i === 3) av.pose = 'attack'; yield 1; }
        if (r2.dodge) { G.audio.sfx('miss'); yield this.msg(tgt.name + ' dodges!', 24); }
        else yield* this.hit(att, tgt, r2.dmg, r2.crit, r2.poison);
        for (let i = 5; i >= 0; i--) { av.off = (av.side === 'left' ? 1 : -1) * i * 7; yield 1; }
        av.pose = 'idle';
        if (tgt.hp <= 0) return;
      }
      if (ctr && !(tgt.status.sleep || tgt.status.stun)) {
        const rg = R().range(tgt), d = this.env.dist(att, tgt);
        if (d >= rg[0] && d <= rg[1]) yield* this.doAttack(tgt, att, true);
      }
    }
    projKind(u) {
      const w = u.enemy ? u.kind.map.weapon : D().chars[u.id].map.weapon;
      return w === 'bow' ? 'arrow' : w === 'spear' || w === 'lance' ? 'javelin' : 'rock';
    }
    *projectile(from, to, kind) {
      const tip = G.weaponTip(this.specOf(from.u), 'attack', from.facing);
      const sx = from.x + from.off + tip.x, sy = from.y + tip.y;
      const ex = to.x + 48, ey = to.y + 58;
      const p = { kind, x: sx, y: sy, dir: ex > sx ? 1 : -1, life: 999 };
      this.fxList.push(p);
      const n = 12;
      for (let i = 1; i <= n; i++) { p.x = sx + (ex - sx) * i / n; p.y = sy + (ey - sy) * i / n - Math.sin(i / n * Math.PI) * 10; yield 1; }
      p.life = 0;
    }
    *hit(att, tgt, dmg, crit, poison) {
      const tv = this.view(tgt);
      if (crit) {
        G.fx.flash = 6; G.fx.flashColor = '#fff'; G.fx.shake = 14; G.audio.sfx('crit');
        yield this.msg(att.enemy ? 'A savage blow!' : 'Critical hit!', 8);
      } else { G.audio.sfx('hit'); G.fx.shake = 6; }
      tv.pose = 'hurt'; tv.flash = 10;
      this.spark(tv);
      tgt.hp = Math.max(0, tgt.hp - dmg);
      if (!att.enemy) this.addDamageExp(att, tgt, dmg);
      if (poison && tgt.hp > 0) { tgt.status.poison = true; }
      yield* this.animHP(tv);
      yield this.msg(tgt.name + ' takes ' + dmg + ' damage.', 20);
      if (poison && tgt.hp > 0) { G.audio.sfx('debuff'); yield this.msg(tgt.name + ' is poisoned!', 24); }
      tv.pose = 'idle';
      if (tgt.hp <= 0) yield* this.die(tgt, att);
    }
    addDamageExp(att, tgt, dmg) {
      if (tgt.enemy === att.enemy) return;
      const k = R().killExp(att, tgt);
      this.exp += Math.floor(k * Math.min(dmg, tgt.mhp) / Math.max(1, tgt.mhp));
      if (this.exp > 49) this.exp = 49;
    }
    *die(u, killer) {
      const v = this.view(u);
      G.audio.sfx('die');
      for (let i = 0; i < 24; i++) { v.flash = i % 4 < 2 ? 2 : 0; v.alpha = 1 - i / 24; yield 1; }
      v.alpha = 0;
      if (u.enemy) {
        yield this.msg(u.name + ' is defeated!', 24);
        if (killer && !killer.enemy) {
          this.exp += R().killExp(killer, u); if (this.exp > 49) this.exp = 49; killer.kills = (killer.kills || 0) + 1;
          this.gold += u.kind.gold || 0;
          if (u.drop && G.r(100) < (u.drop.chance || 100)) { (this.drops = this.drops || []).push(u.drop.item); }
        }
      } else {
        yield this.msg(u.name + ' has fallen!', 30);
      }
      this.killed.push(u);
      this.env.onKill && this.env.onKill(u, killer);
    }
    *animHP(v) {
      const u = v.u;
      for (let i = 0; i < 40 && (Math.round(v.hpShown) !== u.hp); i++) {
        const d = u.hp - v.hpShown; v.hpShown += Math.sign(d) * Math.max(0.5, Math.abs(d) / 6); yield 1;
        if (Math.abs(u.hp - v.hpShown) < 0.6) v.hpShown = u.hp;
      }
      v.hpShown = u.hp;
    }
    spark(v) { for (let i = 0; i < 10; i++) this.fxList.push({ kind: 'spark', x: v.x + 48 + G.r(20) - 10, y: v.y + 50 + G.r(20) - 10, vx: (G.rand() - 0.5) * 4, vy: (G.rand() - 0.9) * 3, life: 16 + G.r(8) }); }

    // ---------- spells ----------
    *doSpell(caster, spellId, lvl, targets) {
      const sp = D().spells[spellId], L = sp.levels[lvl - 1];
      const cv = this.view(caster);
      caster.mp = Math.max(0, caster.mp - L.mp);
      cv.pose = 'cast';
      yield this.msg(caster.name + ' casts ' + sp.name + (sp.levels.length > 1 ? ' ' + lvl : '') + '!', 10);
      G.audio.sfx('select');
      for (let i = 0; i < 20; i++) { if (i % 3 === 0) this.fxList.push({ kind: 'glow', x: cv.x + 48 + (G.rand() - 0.5) * 30, y: cv.y + 40 + (G.rand() - 0.5) * 30, life: 20, col: this.spellColor(sp) }); yield 1; }
      if (sp.kind === 'recall') {
        G.audio.sfx('warp'); G.fx.flash = 20; G.fx.flashColor = '#fff';
        yield this.msg('A bright light surrounds the force...', 30);
        this.recall = true; cv.pose = 'idle'; return;
      }
      if (sp.kind === 'healers' || sp.kind === 'heal') this.expCap = 25;
      for (let ti = 0; ti < targets.length; ti++) {
        const tgt = targets[ti];
        if (tgt.hp <= 0) continue;
        let tv = this.view(tgt);
        if (!tv || (tgt === caster && sp.kind !== 'heal' && sp.kind !== 'buff' && sp.kind !== 'cure')) tv = this.showTarget(tgt, caster);
        if (!tv) tv = this.showTarget(tgt, caster);
        if (ti > 0) yield 8;
        yield* this.spellFx(sp, tv);
        if (sp.kind === 'damage') {
          const r = R().spellPower(caster, spellId, lvl, tgt);
          if (r.crit) { G.fx.shake = 10; yield this.msg('A surge of power!', 8); }
          tv.pose = 'hurt'; tv.flash = 10;
          tgt.hp = Math.max(0, tgt.hp - r.dmg);
          if (!caster.enemy) this.addDamageExp(caster, tgt, r.dmg);
          yield* this.animHP(tv);
          yield this.msg(tgt.name + ' takes ' + r.dmg + ' damage.', 20);
          tv.pose = 'idle';
          if (tgt.hp <= 0) yield* this.die(tgt, caster);
        } else if (sp.kind === 'heal') {
          const amt = Math.min(tgt.mhp - tgt.hp, R().spellPower(caster, spellId, lvl, tgt).amount);
          tgt.hp += amt; yield* this.animHP(tv);
          yield this.msg(tgt.name + ' recovers ' + amt + ' HP.', 20);
          if (!caster.enemy && R().cls(caster).healer) { this.exp += Math.max(10, Math.floor(25 * amt / tgt.mhp)); if (this.exp > 25) this.exp = 25; }
        } else if (sp.kind === 'cure') {
          const had = tgt.status.poison || tgt.status.sleep || tgt.status.muddle;
          tgt.status.poison = false; tgt.status.sleep = false; tgt.status.muddle = false;
          yield this.msg(had ? tgt.name + ' is cured.' : 'Nothing happens.', 24);
          if (!caster.enemy && had) { this.exp += 10; if (this.exp > 25) this.exp = 25; }
        } else if (sp.kind === 'buff') {
          tgt.status.quick = 3; tgt.status.quickPow = L.power;
          yield this.msg(tgt.name + ' feels lighter! AGI & DEF up.', 24);
          if (!caster.enemy) { this.exp += 5; }
        } else if (sp.kind === 'debuff') {
          if (G.chance(4) && tgt.kind.boss) { yield this.msg(tgt.name + ' resists!', 24); continue; }
          tgt.status.sap = 3; tgt.status.sapPow = L.power;
          yield this.msg(tgt.name + ' is sapped! AGI & DEF down.', 24);
          if (!caster.enemy) { this.exp += 5; }
        } else if (sp.kind === 'poison') {
          if (G.chance(3)) { yield this.msg(tgt.name + ' resists!', 24); continue; }
          tgt.status.poison = true; yield this.msg(tgt.name + ' is poisoned!', 24);
        }
      }
      cv.pose = 'idle';
    }
    spellColor(sp) { return { fire: '#ff8020', ice: '#a0e0ff', dark: '#b060ff' }[sp.elem] || (sp.kind === 'heal' || sp.kind === 'cure' ? '#80ffa0' : sp.kind === 'debuff' || sp.kind === 'poison' ? '#c040c0' : '#ffffa0'); }
    *spellFx(sp, tv) {
      const cx = tv.x + 48, cy = tv.y + 60;
      G.audio.sfx(sp.sfx);
      const col = this.spellColor(sp);
      for (let i = 0; i < 36; i++) {
        if (sp.elem === 'fire') { for (let k = 0; k < 3; k++) this.fxList.push({ kind: 'flame', x: cx + (G.rand() - 0.5) * 50, y: cy + 20, vy: -1.5 - G.rand() * 2, vx: (G.rand() - 0.5), life: 20 + G.r(10) }); }
        else if (sp.elem === 'ice') { if (i % 2 === 0) this.fxList.push({ kind: 'shard', x: cx + (G.rand() - 0.5) * 60, y: cy - 60, vy: 4 + G.rand() * 2, vx: (G.rand() - 0.5), life: 18 }); }
        else if (sp.elem === 'dark') { if (i % 2 === 0) this.fxList.push({ kind: 'orb', x: cx + Math.cos(i / 3) * 30, y: cy + Math.sin(i / 3) * 20 - 10, vx: -Math.cos(i / 3) * 1.5, vy: -Math.sin(i / 3), life: 20, col }); if (i === 28) { G.fx.flash = 4; G.fx.flashColor = '#b060ff'; } }
        else if (sp.kind === 'heal' || sp.kind === 'cure' || sp.kind === 'buff') { if (i % 2 === 0) this.fxList.push({ kind: 'sparkle', x: cx + (G.rand() - 0.5) * 40, y: cy + 20, vy: -1.2 - G.rand(), vx: 0, life: 30, col }); }
        else { if (i % 2 === 0) this.fxList.push({ kind: 'ring', x: cx, y: cy - 30 + i, r: 20, life: 12, col }); }
        yield 1;
      }
    }

    // ---------- items ----------
    *doItem(user, idx, tgt) {
      const itId = user.items[idx].id, it = D().items[itId];
      const uv = this.view(user);
      yield this.msg(user.name + ' uses ' + it.name + '.', 16);
      let tv = this.view(tgt) || this.showTarget(tgt, user);
      user.items.splice(idx, 1);
      if (it.effect === 'heal') {
        yield* this.spellFx({ kind: 'heal', sfx: 'heal' }, tv);
        const amt = Math.min(tgt.mhp - tgt.hp, it.power); tgt.hp += amt; yield* this.animHP(tv);
        yield this.msg(tgt.name + ' recovers ' + amt + ' HP.', 24);
      } else if (it.effect === 'mp') {
        yield* this.spellFx({ kind: 'heal', sfx: 'heal' }, tv);
        const amt = Math.min(tgt.mmp - tgt.mp, it.power); tgt.mp += amt; tv.mpShown = tgt.mp;
        yield this.msg(tgt.name + ' recovers ' + amt + ' MP.', 24);
      } else if (it.effect === 'cure') {
        yield* this.spellFx({ kind: 'cure', sfx: 'heal' }, tv);
        tgt.status.poison = false; yield this.msg(tgt.name + ' is cured.', 24);
      } else if (it.effect === 'recall') {
        G.audio.sfx('warp'); G.fx.flash = 20; this.recall = true;
        yield this.msg('A bright light surrounds the force...', 30);
      } else if (it.effect === 'stat') {
        yield* this.spellFx({ kind: 'buff', sfx: 'buff' }, tv);
        const k = it.stat === 'hp' ? 'mhp' : it.stat; tgt[k] += it.power; if (it.stat === 'hp') tgt.hp += it.power;
        yield this.msg(tgt.name + '\'s ' + it.stat.toUpperCase() + ' rises by ' + it.power + '!', 30);
      }
    }

    // ---------- loop ----------
    update() {
      this.t++;
      this.tasks.update();
      if (this.msgChars < this.msgTarget) this.msgChars += (G.input.h('A') ? 4 : 2);
      // speed up by holding A
      if (G.input.h('A') && this.tasks.busy && this.t % 2 === 0) this.tasks.update();
      [this.left, this.right].forEach(v => { if (v && v.flash > 0) v.flash--; });
      this.fxList.forEach(p => { if (p.vx) p.x += p.vx; if (p.vy) p.y += p.vy; if (p.kind === 'spark') p.vy += 0.25; p.life--; });
      this.fxList = this.fxList.filter(p => p.life > 0);
    }
    drawUnit(ctx, v) {
      if (!v || v.alpha <= 0) return;
      const spec = this.specOf(v.u);
      const img = G.battleSprite(spec, v.pose, v.facing);
      const slideX = (v.side === 'left' ? -1 : 1) * this.slide * 180;
      const bob = v.pose === 'idle' ? Math.round(Math.sin((this.t + (v.side === 'left' ? 20 : 0)) / 18)) : 0;
      const x = Math.round(v.x + v.off + slideX), y = v.y + bob;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 48, v.y + 91, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = v.alpha;
      ctx.drawImage(img, x, y);
      if (v.flash > 0 && v.flash % 4 < 2) ctx.drawImage(G.tinted(img, '#ffffff', JSON.stringify(spec) + v.pose + v.facing), x, y);
      ctx.globalAlpha = 1;
    }
    drawStatus(ctx, v, x) {
      if (!v) return;
      const u = v.u;
      G.win(ctx, x, 4, 120, u.mmp > 0 ? 40 : 30);
      G.text(ctx, u.name, x + 8, 9, u.enemy ? '#ff9090' : '#fff');
      if (!u.enemy) G.textR(ctx, 'L' + u.lv, x + 112, 9, '#f8e060');
      G.text(ctx, 'HP', x + 8, 20, '#a0c0ff');
      G.bar(ctx, x + 22, 21, 56, v.hpShown, u.mhp, v.hpShown / u.mhp < 0.3 ? '#f06040' : '#f8d030');
      G.textR(ctx, Math.round(v.hpShown) + '/' + u.mhp, x + 114, 20);
      if (u.mmp > 0) { G.text(ctx, 'MP', x + 8, 30, '#a0c0ff'); G.bar(ctx, x + 22, 31, 56, u.mp, u.mmp, '#60a0ff'); G.textR(ctx, u.mp + '/' + u.mmp, x + 114, 30); }
    }
    draw(ctx) {
      G.drawBattleBG(ctx, this.bgKey, this.t);
      this.drawUnit(ctx, this.left); this.drawUnit(ctx, this.right);
      // effects
      this.fxList.forEach(p => {
        if (p.kind === 'arrow' || p.kind === 'javelin') {
          ctx.fillStyle = '#6a4020'; const len = p.kind === 'arrow' ? 12 : 18;
          ctx.fillRect(Math.round(p.x - (p.dir > 0 ? len : 0)), Math.round(p.y), len, 1);
          ctx.fillStyle = '#e0e0f0'; ctx.fillRect(Math.round(p.x + (p.dir > 0 ? 0 : -2)), Math.round(p.y) - 1, 3, 3);
          ctx.fillStyle = '#f0f0f0'; ctx.fillRect(Math.round(p.x - (p.dir > 0 ? len : -len + 2)), Math.round(p.y) - 1, 2, 3);
        } else if (p.kind === 'rock') { ctx.fillStyle = '#c0c0c0'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
        else if (p.kind === 'spark') { ctx.fillStyle = p.life % 4 < 2 ? '#fff8c0' : '#ffb040'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
        else if (p.kind === 'flame') {
          const s = Math.max(1, Math.round(p.life / 6)); ctx.fillStyle = p.life > 18 ? '#fff0a0' : p.life > 10 ? '#ff9020' : '#c02010';
          ctx.fillRect(Math.round(p.x - s), Math.round(p.y - s), s * 2, s * 2 + 1);
        } else if (p.kind === 'shard') { ctx.fillStyle = '#e0f8ff'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 6); ctx.fillStyle = '#80c0ff'; ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y) + 1, 1, 4); }
        else if (p.kind === 'orb' || p.kind === 'glow' || p.kind === 'sparkle') {
          ctx.globalAlpha = Math.min(1, p.life / 10); ctx.fillStyle = p.col || '#fff';
          const s = p.kind === 'orb' ? 3 : 2; ctx.fillRect(Math.round(p.x) - s / 2, Math.round(p.y) - s / 2, s, s);
          if (p.kind === 'sparkle' && p.life % 6 < 3) { ctx.fillRect(Math.round(p.x) - 3, Math.round(p.y), 7, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y) - 3, 1, 7); }
          ctx.globalAlpha = 1;
        } else if (p.kind === 'ring') { ctx.strokeStyle = p.col; ctx.globalAlpha = p.life / 12; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r + (12 - p.life) * 2, 5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      });
      if (this.slide < 1) { this.drawStatus(ctx, this.left, 6); this.drawStatus(ctx, this.right, G.W - 126); }
      // message box
      if (this.msgLines.length) {
        G.win(ctx, 8, G.H - 48, G.W - 16, 44);
        const n = this.msgLines.length;
        this.msgLines.forEach((l, i) => {
          const s = i === n - 1 ? l.slice(0, this.msgChars) : l;
          G.text(ctx, s, 18, G.H - 42 + i * 12);
        });
      }
      if (this.fadeOut) { ctx.globalAlpha = this.fadeOut; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
    }
  }
  G.playAction = function (action, env) { const w = new G.Wait(); const s = new BattleScene(action, env, w); w.scene = s; G.push(s); return w; };
})();
