// ===== Menus: status screen, spell/item lists, give/equip, shops, church, caravan, field menu =====
'use strict';
(function () {
  const D = () => G.data, R = () => G.rules, S = () => G.st;

  // ---------- Status screen ----------
  class StatusScreen {
    constructor(u, w) { this.u = u; this.w = w; this.t = 0; this.transparent = false; }
    update() { this.t++; if (G.input.p('A') || G.input.p('B') || G.input.p('C')) { G.audio.sfx('cancel'); G.pop(); this.w.resolve(); } }
    draw(ctx) {
      const u = this.u;
      ctx.fillStyle = '#080c28'; ctx.fillRect(0, 0, G.W, G.H);
      const portrait = u.enemy ? (u.kind.portrait || null) : D().chars[u.id].portrait;
      G.win(ctx, 6, 6, 62, 62);
      if (portrait) G.drawPortrait(ctx, portrait, 11, 11, this.t);
      else { const img = G.battleSprite(u.kind.map, 'idle', 'right'); ctx.drawImage(img, 0, 0, 96, 96, 9, 9, 56, 56); }
      G.win(ctx, 72, 6, G.W - 78, 62);
      G.text(ctx, u.name, 82, 13, u.enemy ? '#ff9090' : '#fff');
      if (!u.enemy) {
        const c = D().classes[u.cls];
        G.text(ctx, c.name + (c.promoted ? ' *' : ''), 82, 25, '#a0c0ff');
        G.text(ctx, 'LEVEL ' + u.lv, 82, 37); G.text(ctx, 'EXP ' + u.exp + '/100', 150, 37);
        G.text(ctx, 'Kills ' + (u.kills || 0) + '  Defeats ' + (u.defeats || 0), 82, 49, '#c0c8e8');
        if (u.dead) G.textR(ctx, 'FALLEN', G.W - 14, 13, '#ff6060');
      } else { G.text(ctx, 'LEVEL ' + u.lv, 82, 25, '#a0c0ff'); }
      // stats
      G.win(ctx, 6, 72, 150, 88);
      G.text(ctx, 'HP', 16, 80, '#a0c0ff'); G.bar(ctx, 34, 81, 60, u.hp, u.mhp); G.textR(ctx, u.hp + '/' + u.mhp, 148, 80);
      G.text(ctx, 'MP', 16, 92, '#a0c0ff'); G.bar(ctx, 34, 93, 60, u.mp, u.mmp, '#60a0ff'); G.textR(ctx, u.mp + '/' + u.mmp, 148, 92);
      const rows = [['ATT', R().stat(u, 'att')], ['DEF', R().stat(u, 'def')], ['AGI', R().stat(u, 'agi')], ['MOV', R().mov(u)]];
      rows.forEach(([k, v], i) => { G.text(ctx, k, 16, 106 + i * 12, '#a0c0ff'); G.textR(ctx, String(v), 70, 106 + i * 12); });
      const st = [];
      if (u.status.poison) st.push(['Poison', '#60e060']); if (u.status.quick) st.push(['Quick', '#80c0ff']); if (u.status.sap) st.push(['Sapped', '#e080e0']);
      st.forEach(([s, c], i) => G.text(ctx, s, 90, 106 + i * 12, c));
      // items
      G.win(ctx, 160, 72, G.W - 166, 88);
      G.text(ctx, 'ITEMS', 170, 79, '#f8e060');
      const items = u.enemy ? [] : u.items;
      for (let i = 0; i < 4; i++) { const it = items[i]; G.text(ctx, it ? (it.eq ? 'E ' : '  ') + D().items[it.id].name : '  -', 170, 91 + i * 12, it && it.eq ? '#fff' : '#c0c8e8'); }
      if (!u.enemy) { const w = R().weapon(u); G.text(ctx, 'Range ' + (w ? w.range.join('-') : '1'), 170, 141, '#a0c0ff'); }
      // magic
      G.win(ctx, 6, 164, G.W - 12, 54);
      G.text(ctx, 'MAGIC', 16, 171, '#f8e060');
      const sp = R().spellLevelsKnown(u);
      if (!sp.length) G.text(ctx, 'None', 16, 184, '#8088b0');
      sp.forEach((s, i) => { const x = 16 + (i % 3) * 100, y = 184 + Math.floor(i / 3) * 12; G.text(ctx, D().spells[s.id].name + ' ' + s.lv, x, y); });
      if (!u.enemy) G.text(ctx, D().chars[u.id].bio, 16, 207, '#b0b8d8');
    }
  }
  G.statusScreen = function (u) { const w = new G.Wait(); G.push(new StatusScreen(u, w)); return w; };

  // ---------- Spell menu (list + level with left/right) ----------
  class SpellMenu {
    constructor(u, opts, w) {
      this.u = u; this.w = w; this.opts = opts || {}; this.transparent = true; this.t = 0;
      this.list = R().spellLevelsKnown(u).filter(s => !this.opts.field || D().spells[s.id].field || D().spells[s.id].kind === 'heal' || D().spells[s.id].kind === 'cure');
      this.i = 0; this.lv = this.list.map(s => s.lv);
    }
    update() {
      this.t++;
      if (!this.list.length) { if (G.input.p('A') || G.input.p('B')) { G.pop(); this.w.resolve(null); } return; }
      const d = G.input.repDir(14, 6);
      if (d === 'up' || d === 'down') { this.i = (this.i + (d === 'up' ? -1 : 1) + this.list.length) % this.list.length; G.audio.sfx('cursor'); }
      if (d === 'left' || d === 'right') { const s = this.list[this.i]; this.lv[this.i] = G.clamp(this.lv[this.i] + (d === 'left' ? -1 : 1), 1, s.lv); G.audio.sfx('cursor'); }
      if (G.input.p('A')) {
        const s = this.list[this.i], L = D().spells[s.id].levels[this.lv[this.i] - 1];
        if (this.u.mp < L.mp) { G.audio.sfx('error'); return; }
        G.audio.sfx('ok'); G.pop(); this.w.resolve({ id: s.id, lv: this.lv[this.i] });
      }
      if (G.input.p('B')) { G.audio.sfx('cancel'); G.pop(); this.w.resolve(null); }
    }
    draw(ctx) {
      const x = 8, y = 8, w = 200, h = 22 + Math.max(1, this.list.length) * 12;
      G.win(ctx, x, y, w, h);
      G.text(ctx, this.u.name + '  MP ' + this.u.mp + '/' + this.u.mmp, x + 10, y + 7, '#f8e060');
      if (!this.list.length) G.text(ctx, 'No usable spells.', x + 18, y + 20, '#8088b0');
      this.list.forEach((s, i) => {
        const sp = D().spells[s.id], L = sp.levels[this.lv[i] - 1];
        const ok = this.u.mp >= L.mp;
        const yy = y + 20 + i * 12;
        if (i === this.i && (this.t >> 3) % 4 !== 3) G.text(ctx, '\u0002', x + 8, yy, '#f8e060');
        G.text(ctx, sp.name, x + 18, yy, ok ? '#fff' : '#7078a0');
        let lx = x + 90;
        for (let k = 1; k <= s.lv; k++) { G.text(ctx, String(k), lx, yy, k === this.lv[i] ? (ok ? '#f8e060' : '#a08040') : '#6070a0'); lx += 10; }
        G.textR(ctx, L.mp + 'MP', x + w - 10, yy, ok ? '#a0c0ff' : '#7078a0');
      });
      if (this.list.length) {
        const s = this.list[this.i], sp = D().spells[s.id], L = sp.levels[this.lv[this.i] - 1];
        const info = { heal: 'Restores HP', cure: 'Cures ailments', buff: 'Raises AGI & DEF', debuff: 'Lowers AGI & DEF', recall: 'Return to the last church', damage: 'Damages foes', poison: 'Poisons foes' }[sp.kind];
        G.win(ctx, 8, y + h + 4, 200, 32);
        G.text(ctx, info + (L.power ? ' (' + (L.power >= 999 ? 'full' : L.power) + ')' : ''), 18, y + h + 10);
        G.text(ctx, 'Range ' + L.range.join('-') + '  Area ' + (L.area ? L.area * 2 + 1 + 'x' : 'single'), 18, y + h + 21, '#a0c0ff');
      }
    }
  }
  G.spellMenu = function (u, opts) { const w = new G.Wait(); G.push(new SpellMenu(u, opts, w)); return w; };

  // ---------- Item lists ----------
  G.itemLabel = it => (it.eq ? 'E ' : '') + D().items[it.id].name;
  G.itemList = function (u, opts = {}) {
    const items = u.items.map(it => ({ label: G.itemLabel(it), color: it.eq ? '#f8f0a0' : null }));
    return G.menu(items, Object.assign({ x: 8, y: 8, w: 150, title: opts.title, help: i => u.items[i] ? D().items[u.items[i].id].desc : '' }, opts));
  };
  G.giveItemFlow = function* (from, idx, to) {
    const it = from.items[idx];
    if (from === to) return;
    if (to.items.length < 4) {
      from.items.splice(idx, 1); it.eq = false; to.items.push(it); G.audio.sfx('item');
      yield G.say(from.name + ' gives the ' + D().items[it.id].name + ' to ' + to.name + '.');
      yield* G.offerEquip(to, to.items.length - 1);
      return;
    }
    yield G.say(to.name + '\'s hands are full. Swap for which item?');
    const w = yield G.itemList(to, { title: 'Swap with' });
    if (w.result < 0) return;
    const other = to.items[w.result];
    from.items[idx] = other; other.eq = false; to.items[w.result] = it; it.eq = false; G.audio.sfx('item');
    yield G.say(from.name + ' and ' + to.name + ' trade items.');
    yield* G.offerEquip(to, w.result);
  };
  G.offerEquip = function* (u, idx) {
    const id = u.items[idx].id; if (!S().canEquip(u, id)) return;
    yield G.say('Equip the ' + D().items[id].name + ' on ' + u.name + '?');
    const c = yield G.confirm(); if (c.result === 0) { S().equip(u, idx); G.audio.sfx('ok'); }
  };

  // ---------- Member picker ----------
  G.memberPick = function (opts = {}) {
    const list = opts.list || S().active();
    const items = list.map(u => ({ label: u.name, right: D().classes[u.cls].name.slice(0, 9) + ' L' + u.lv + (u.dead ? ' X' : ''), disabled: opts.filter ? !opts.filter(u) : false, color: u.dead ? '#ff8080' : null }));
    const w = G.menu(items, Object.assign({ x: 8, y: 8, w: 190, title: opts.title || 'Who?', maxRows: 9 }, opts));
    const out = new G.Wait();
    const chk = { done: () => { if (w.done() && !out.fin) out.resolve(w.result >= 0 ? list[w.result] : null); return w.done(); } };
    out.done = () => { chk.done(); return out.fin; };
    return out;
  };

  // ---------- Field menu (Member / Magic / Item / Search) ----------
  G.fieldMenu = function* (field) {
    while (true) {
      const c = yield G.cross({ up: { label: 'Member', icon: 'member' }, left: { label: 'Magic', icon: 'magic' }, right: { label: 'Item', icon: 'item' }, down: { label: 'Search', icon: 'search' } }, { x: G.W / 2 - 40, y: G.H / 2 + 20 });
      const op = c.result; if (!op) return;
      if (op === 'up') {
        while (true) { const m = yield G.memberPick({ title: 'Member' }); if (!m.result) break; yield G.statusScreen(m.result); }
      } else if (op === 'left') {
        const m = yield G.memberPick({ title: 'Cast with', filter: u => !u.dead && R().spellLevelsKnown(u).some(s => ['heal', 'cure', 'recall'].includes(D().spells[s.id].kind)) });
        if (!m.result) continue;
        const u = m.result;
        const s = yield G.spellMenu(u, { field: true }); if (!s.result) continue;
        yield* G.fieldCast(u, s.result.id, s.result.lv);
      } else if (op === 'right') {
        const m = yield G.memberPick({ title: 'Whose items?' }); if (!m.result) continue;
        yield* G.fieldItems(m.result);
      } else if (op === 'down') {
        yield* field.search(); return;
      }
    }
  };
  G.fieldCast = function* (u, id, lv) {
    const sp = D().spells[id], L = sp.levels[lv - 1];
    if (sp.kind === 'recall') {
      yield G.say('Return to the last church visited?'); const c = yield G.confirm(); if (c.result !== 0) return;
      u.mp -= L.mp; G.audio.sfx('warp'); G.fx.flash = 20; yield 30; G.recallToChurch(); return;
    }
    const t = yield G.memberPick({ title: 'Cast on', filter: x => !x.dead }); if (!t.result) return;
    const x = t.result; u.mp -= L.mp;
    if (sp.kind === 'heal') { const amt = Math.min(x.mhp - x.hp, R().spellPower(u, id, lv, x).amount); x.hp += amt; G.audio.sfx('heal'); yield G.say(x.name + ' recovers ' + amt + ' HP.'); }
    else if (sp.kind === 'cure') { x.status = {}; G.audio.sfx('heal'); yield G.say(x.name + ' is cured.'); }
  };
  G.fieldItems = function* (u) {
    while (true) {
      if (!u.items.length) { yield G.say(u.name + ' has no items.'); return; }
      const w = yield G.itemList(u, { title: u.name }); if (w.result < 0) return;
      const idx = w.result, it = D().items[u.items[idx].id];
      const c = yield G.cross({ up: { label: 'Use', icon: 'use', disabled: it.type !== 'use' }, left: { label: 'Give', icon: 'give' }, right: { label: 'Equip', icon: 'equip', disabled: !S().canEquip(u, u.items[idx].id) }, down: { label: 'Drop', icon: 'drop', disabled: it.type === 'key' } }, { x: G.W / 2 - 40, y: G.H / 2 + 20 });
      if (!c.result) continue;
      if (c.result === 'up') {
        if (it.effect === 'recall') { yield G.say('Return to the last church visited?'); const k = yield G.confirm(); if (k.result !== 0) continue; u.items.splice(idx, 1); G.audio.sfx('warp'); G.fx.flash = 20; yield 30; G.recallToChurch(); return; }
        const t = yield G.memberPick({ title: 'Use on', filter: x => !x.dead }); if (!t.result) continue;
        const x = t.result; u.items.splice(idx, 1);
        if (it.effect === 'heal') { const a = Math.min(x.mhp - x.hp, it.power); x.hp += a; G.audio.sfx('heal'); yield G.say(x.name + ' recovers ' + a + ' HP.'); }
        else if (it.effect === 'mp') { const a = Math.min(x.mmp - x.mp, it.power); x.mp += a; G.audio.sfx('heal'); yield G.say(x.name + ' recovers ' + a + ' MP.'); }
        else if (it.effect === 'cure') { x.status = {}; G.audio.sfx('heal'); yield G.say(x.name + ' is cured.'); }
        else if (it.effect === 'stat') { const k = it.stat === 'hp' ? 'mhp' : it.stat; x[k] += it.power; if (it.stat === 'hp') x.hp += it.power; G.audio.sfx('buff'); yield G.say(x.name + '\'s ' + it.stat.toUpperCase() + ' rises by ' + it.power + '!'); }
      } else if (c.result === 'left') {
        const t = yield G.memberPick({ title: 'Give to' }); if (!t.result) continue;
        yield* G.giveItemFlow(u, idx, t.result);
      } else if (c.result === 'right') {
        S().equip(u, idx); G.audio.sfx('ok'); yield G.say(u.name + ' equips the ' + it.name + '.');
      } else if (c.result === 'down') {
        yield G.say('Throw away the ' + it.name + '?'); const k = yield G.confirm(); if (k.result === 0) { u.items.splice(idx, 1); G.audio.sfx('cancel'); }
      }
    }
  };

  // ---------- Shop ----------
  // stock: [itemIds], opts: {name, portrait, deals: [itemIds]}
  G.shop = function* (stock, opts = {}) {
    const P = opts.portrait;
    yield G.say(opts.greet || 'Welcome! What can I do for you?', { portrait: P });
    while (true) {
      G.showGold = true;
      const c = yield G.cross({ up: { label: 'Buy', icon: 'item' }, left: { label: 'Sell', icon: 'give' }, right: { label: 'Deals', icon: 'equip', disabled: !(opts.deals && opts.deals.length) }, down: { label: 'Leave', icon: 'quit' } }, { x: G.W / 2 - 40, y: G.H / 2 });
      const op = c.result;
      if (!op || op === 'down') { G.showGold = false; yield G.say(opts.bye || 'Come again!', { portrait: P }); return; }
      if (op === 'up' || op === 'right') {
        const list = op === 'up' ? stock : opts.deals;
        while (true) {
          const items = list.map(id => ({ label: D().items[id].name, right: D().items[id].price + 'G', disabled: D().items[id].price > G.state.gold }));
          const w = yield G.menu(items, { x: 8, y: 8, w: 170, title: 'Buy what?', maxRows: 9, help: i => { const it = D().items[list[i]]; const can = S().active().filter(u => S().canEquip(u, list[i])).map(u => u.name); return it.desc + (it.type === 'weapon' || it.type === 'ring' ? ' Can equip: ' + (can.join(', ') || 'nobody') : ''); } });
          if (w.result < 0) break;
          const id = list[w.result], it = D().items[id];
          const who = yield G.memberPick({ title: 'Who gets the ' + it.name + '?', filter: u => u.items.length < 4 });
          if (!who.result) continue;
          G.state.gold -= it.price; who.result.items.push({ id, eq: false }); G.audio.sfx('coin');
          yield G.say('Thank you!', { portrait: P });
          yield* G.offerEquip(who.result, who.result.items.length - 1);
        }
      } else if (op === 'left') {
        while (true) {
          const who = yield G.memberPick({ title: 'Whose item?', filter: u => u.items.length > 0 }); if (!who.result) break;
          const u = who.result;
          const w = yield G.menu(u.items.map(x => ({ label: G.itemLabel(x), right: Math.floor(D().items[x.id].price * 3 / 4) + 'G', disabled: D().items[x.id].type === 'key' || !D().items[x.id].price })), { x: 8, y: 8, w: 170, title: 'Sell what?' });
          if (w.result < 0) continue;
          const it = D().items[u.items[w.result].id]; const price = Math.floor(it.price * 3 / 4);
          yield G.say('I can give you ' + price + ' gold for the ' + it.name + '. Deal?', { portrait: P });
          const k = yield G.confirm(); if (k.result !== 0) continue;
          u.items.splice(w.result, 1); G.state.gold += price; G.audio.sfx('coin');
        }
      }
    }
  };

  // ---------- Church (Raise / Cure / Promote / Save) ----------
  G.church = function* (npc) {
    const P = npc && npc.portrait;
    G.state.church = { map: G.field.mapId, x: G.field.player.x, y: G.field.player.y + 1 };
    yield G.say('Welcome, children of Aldmere. May the Ember light your path. How may I help you?', { portrait: P });
    while (true) {
      G.showGold = true;
      const c = yield G.cross({ up: { label: 'Raise', icon: 'join' }, left: { label: 'Cure', icon: 'use' }, right: { label: 'Promote', icon: 'equip' }, down: { label: 'Save', icon: 'depot' } }, { x: G.W / 2 - 40, y: G.H / 2 });
      const op = c.result;
      if (!op) { G.showGold = false; yield G.say('Go in peace.', { portrait: P }); return; }
      if (op === 'up') {
        const dead = S().roster().filter(u => u.dead);
        if (!dead.length) { yield G.say('No one needs to be raised. The Ember is kind today.', { portrait: P }); continue; }
        for (const u of dead) {
          const cost = S().reviveCost(u);
          yield G.say(u.name + ' has fallen. Raising them will cost ' + cost + ' gold. Shall I?', { portrait: P });
          const k = yield G.confirm();
          if (k.result === 0) { if (G.state.gold < cost) { yield G.say('Alas, you have not enough gold.', { portrait: P }); continue; } G.state.gold -= cost; S().revive(u); G.audio.sfx('heal'); G.fx.flash = 10; yield G.say('Rise, ' + u.name + '! Breathe again.', { portrait: P }); }
        }
      } else if (op === 'left') {
        const sick = S().roster().filter(u => !u.dead && u.status && u.status.poison);
        if (!sick.length) { yield G.say('No one here is poisoned.', { portrait: P }); continue; }
        for (const u of sick) {
          yield G.say(u.name + ' is poisoned. The cure costs ' + S().cureCost(u) + ' gold. Shall I?', { portrait: P });
          const k = yield G.confirm();
          if (k.result === 0 && G.state.gold >= S().cureCost(u)) { G.state.gold -= S().cureCost(u); u.status = {}; G.audio.sfx('heal'); yield G.say(u.name + ' is cured.', { portrait: P }); }
        }
      } else if (op === 'right') {
        const can = S().roster().filter(u => !u.dead && S().canPromote(u));
        if (!can.length) { yield G.say('No one is ready. A warrior may be promoted from level 20.', { portrait: P }); continue; }
        for (const u of can) {
          const to = D().classes[D().classes[u.cls].promo].name;
          yield G.say(u.name + ' may become a ' + to + '. Their level returns to 1, but their strength remains. Promote?', { portrait: P });
          const k = yield G.confirm();
          if (k.result === 0) { S().promote(u); G.audio.jingle('promote'); G.fx.flash = 16; yield G.say(u.name + ' is now a ' + to + '!', { portrait: P }); }
        }
      } else if (op === 'down') {
        yield G.say('Shall I record your journey in the book of deeds?', { portrait: P });
        const k = yield G.confirm();
        if (k.result === 0) { const ok = S().save(1); G.audio.sfx(ok ? 'item' : 'error'); yield G.say(ok ? 'Your deeds are recorded.' : 'The book will not take the ink... (saving is unavailable in this browser)', { portrait: P }); yield G.say('Will you continue your journey?', { portrait: P }); const q = yield G.confirm(); if (q.result === 1) { G.showGold = false; G.toTitle(); return; } }
      }
    }
  };

  // ---------- Caravan / HQ: Join, Depot, Item, Quit ----------
  G.caravan = function* () {
    while (true) {
      const c = yield G.cross({ up: { label: 'Join', icon: 'join' }, left: { label: 'Depot', icon: 'depot' }, right: { label: 'Item', icon: 'item' }, down: { label: 'Quit', icon: 'quit' } }, { x: G.W / 2 - 40, y: G.H / 2 });
      const op = c.result; if (!op || op === 'down') return;
      if (op === 'up') {
        const all = S().roster();
        const reserve = all.filter(u => !G.state.party.includes(u.id));
        if (!reserve.length) { yield G.say('Every member is already in the active force.'); continue; }
        const w = yield G.memberPick({ list: reserve, title: 'Bring in' }); if (!w.result) continue;
        if (G.state.party.length >= 12) {
          const out = yield G.memberPick({ list: S().active().filter(u => u.id !== 'rowan'), title: 'Swap out' }); if (!out.result) continue;
          G.state.party[G.state.party.indexOf(out.result.id)] = w.result.id;
        } else G.state.party.push(w.result.id);
        G.audio.sfx('ok');
      } else if (op === 'left') {
        const d = yield G.cross({ up: { label: 'Look', icon: 'search' }, left: { label: 'Deposit', icon: 'give' }, right: { label: 'Withdraw', icon: 'item' }, down: { label: 'Quit', icon: 'quit' } }, { x: G.W / 2 - 40, y: G.H / 2 });
        if (d.result === 'up') { if (!G.state.depot.length) yield G.say('The depot is empty.'); else yield G.menu(G.state.depot.map(id => D().items[id].name), { title: 'Depot', maxRows: 10 }); }
        else if (d.result === 'left') {
          const m = yield G.memberPick({ title: 'Whose item?', filter: u => u.items.length > 0 }); if (!m.result) continue;
          const w = yield G.itemList(m.result); if (w.result < 0) continue;
          const it = m.result.items.splice(w.result, 1)[0]; G.state.depot.push(it.id); G.audio.sfx('ok');
        } else if (d.result === 'right') {
          if (!G.state.depot.length) { yield G.say('The depot is empty.'); continue; }
          const w = yield G.menu(G.state.depot.map(id => D().items[id].name), { title: 'Withdraw', maxRows: 10 }); if (w.result < 0) continue;
          const m = yield G.memberPick({ title: 'Give to', filter: u => u.items.length < 4 }); if (!m.result) continue;
          const id = G.state.depot.splice(w.result, 1)[0]; m.result.items.push({ id, eq: false }); G.audio.sfx('item');
          yield* G.offerEquip(m.result, m.result.items.length - 1);
        }
      } else if (op === 'right') {
        const m = yield G.memberPick({ title: 'Whose items?' }); if (!m.result) continue;
        yield* G.fieldItems(m.result);
      }
    }
  };
})();
