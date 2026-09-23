// ===== Game state: party roster, inventory, flags, save/load =====
'use strict';
(function () {
  const D = () => G.data;
  const S = G.st = {};

  S.newGame = function () {
    G.state = {
      gold: 60, members: {}, party: [], depot: [], flags: {}, chapter: 1,
      loc: { map: 'tallowmere', x: 0, y: 0, dir: 'down' },
      church: { map: 'tallowmere', x: 0, y: 0 }, battlesWon: {}, playTime: 0, searched: {},
    };
  };
  S.makeMember = function (id) {
    const c = D().chars[id];
    const u = { id, name: c.name, cls: c.cls, lv: 1, exp: 0, items: [], spells: {}, status: {}, dead: false, kills: 0, defeats: 0 };
    u.mhp = c.stats.hp[0]; u.mmp = c.stats.mp[0]; u.att = c.stats.att[0]; u.def = c.stats.def[0]; u.agi = c.stats.agi[0];
    (c.spells || []).forEach(([sid, ...lv]) => { u.spells[sid] = 0; lv.forEach((L, i) => { if (L <= 1) u.spells[sid] = i + 1; }); });
    u.hp = u.mhp; u.mp = u.mmp;
    // grow to starting level
    const saveR = G.rngState; G.rngState = (id.length * 7919 + 17) >>> 0;
    while (u.lv < c.lv) G.rules.levelUp(u);
    G.rngState = saveR;
    u.hp = u.mhp; u.mp = u.mmp;
    c.items.forEach(iid => u.items.push({ id: iid, eq: iid === c.equip }));
    return u;
  };
  S.join = function (id) {
    if (G.state.members[id]) return G.state.members[id];
    const u = S.makeMember(id); G.state.members[id] = u;
    if (G.state.party.length < 12) G.state.party.push(id); // active force (max 12 in battle)
    return u;
  };
  S.member = id => G.state.members[id];
  S.roster = () => Object.keys(G.state.members).map(S.member);
  S.active = () => G.state.party.map(S.member);
  S.leader = () => S.member('rowan');

  // ---------- Inventory ----------
  S.giveItem = function (id, preferred) {
    // put into first member with a free slot (preferred first); else depot
    const list = (preferred ? [S.member(preferred)] : []).concat(S.active()).filter(Boolean);
    for (const u of list) if (u.items.length < 4) { u.items.push({ id, eq: false }); return u; }
    G.state.depot.push(id); return null;
  };
  S.canEquip = function (u, itemId) {
    const it = D().items[itemId]; if (!it) return false;
    if (it.type === 'ring') return true;
    if (it.type !== 'weapon') return false;
    return D().classes[u.cls].weapons.includes(it.wtype);
  };
  S.equip = function (u, idx) {
    const it = D().items[u.items[idx].id];
    u.items.forEach((x, i) => { if (D().items[x.id].type === it.type) x.eq = false; });
    u.items[idx].eq = true;
  };

  // ---------- Healing, death, promotion ----------
  S.healAll = function () { S.roster().forEach(u => { if (!u.dead) { u.hp = u.mhp; u.mp = u.mmp; } u.status = {}; }); };
  S.revive = u => { u.dead = false; u.hp = u.mhp; u.mp = u.mmp; u.status = {}; };
  S.reviveCost = u => Math.max(10, u.lv * 10 * (D().classes[u.cls].promoted ? 3 : 1));
  S.cureCost = u => 10;
  S.canPromote = u => { const c = D().classes[u.cls]; return !c.promoted && c.promo && u.lv >= 20; };
  S.promote = function (u) {
    const c = D().classes[u.cls];
    u.promoLv = u.lv; u.cls = c.promo; u.lv = 1; u.exp = 0;
    u.promoBase = { hp: u.mhp, mp: u.mmp, att: u.att, def: u.def, agi: u.agi };
  };

  // ---------- Save / load (3 slots, like a church journal) ----------
  S.save = function (slot = 1) {
    G.state.savedAt = Date.now();
    return G.store.set('embers_save_' + slot, G.state);
  };
  S.load = function (slot = 1) {
    const s = G.store.get('embers_save_' + slot); if (!s) return false;
    G.state = s; return true;
  };
  S.hasSave = slot => !!G.store.get('embers_save_' + slot);
  S.saveInfo = function (slot) {
    const s = G.store.get('embers_save_' + slot); if (!s) return null;
    const r = s.members.rowan;
    return { lv: r ? r.lv : 1, gold: s.gold, where: s.loc.map, time: s.playTime };
  };
})();
