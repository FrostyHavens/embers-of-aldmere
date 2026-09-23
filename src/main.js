// ===== Boot, title screen, battle results routing =====
'use strict';
(function () {
  // where the force appears after winning each battle
  const AFTER = {
    b1: { map: 'tallowmere', x: 16, y: 24, dir: 'up' },
    b2: { map: 'vale', x: 23, y: 18, dir: 'right' },
    b3: { map: 'vale', x: 31, y: 11, dir: 'right' },
  };
  G.onBattleEnd = function (id, res) {
    const S = G.st;
    if (res === 'win') {
      G.state.battlesWon[id] = true;
      S.roster().forEach(u => { if (!u.dead) { u.hp = u.mhp; u.mp = u.mmp; u.status = {}; } });
      if (id === 'b4') { const sc = new Blank(); G.replace(sc); G.fade.a = 1; sc.tasks.add(G.story.chapterEnd()); return; }
      const a = AFTER[id]; G.goto(a.map, a.x, a.y, a.dir);
      return;
    }
    // defeat or recall: back to the last church
    if (res === 'lose') G.state.gold = Math.floor(G.state.gold / 2);
    const L = S.leader(); if (L.dead) S.revive(L);
    S.roster().forEach(u => { if (!u.dead) { u.hp = u.mhp; u.mp = u.mmp; u.status = {}; } });
    const c = G.state.church;
    const f = G.goto(c.map, c.x, c.y, 'up');
    f.tasks.add((function* () {
      yield 30;
      if (res === 'lose') yield G.say('The force awakens in the chapel. Half of the gold was lost in the retreat.');
      else yield G.say('The force returns safely to the chapel.');
      const dead = S.roster().filter(u => u.dead);
      if (dead.length) yield G.say(dead.map(u => u.name).join(', ') + (dead.length > 1 ? ' have' : ' has') + ' fallen. Speak to the priest to raise them.');
    })());
  };

  class Blank { constructor() { this.tasks = new G.Tasks(); } update() { this.tasks.update(); } draw(ctx) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); } }

  // ---------- Title ----------
  class Title {
    constructor() {
      this.t = 0; this.i = 0; this.embers = [];
      this.hasSave = G.st.hasSave(1); this.hasClear = G.st.hasSave(2);
      this.opts = [{ l: 'New Game' }, { l: 'Continue', d: !this.hasSave }, { l: 'Controls' }];
      if (this.hasSave) this.i = 1;
      this.logo = this.makeLogo();
    }
    onEnter() { G.audio.play('title'); G.fade.a = 1; G.fadeTo(0, 0.03); }
    makeLogo() {
      // Big pixel title rendered from the bitmap font, scaled x3 with a flame gradient and outline
      const s1 = 'EMBERS', s2 = 'of ALDMERE';
      const w1 = G.textWidth(s1), w2 = G.textWidth(s2);
      const c = G.makeCanvas(260, 60), x = c.getContext('2d');
      const tmp = G.makeCanvas(w1 + 2, 9); G.text(tmp.getContext('2d'), s1, 0, 0, '#ffffff', null);
      const sc = 4, ox = Math.floor((260 - w1 * sc) / 2);
      // outline
      x.imageSmoothingEnabled = false;
      const outl = G.tinted(tmp, '#2a0808', 'logo1');
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [2, 2], [1, 2], [2, 1]]) x.drawImage(outl, ox + dx * 2, 2 + dy * 2, tmp.width * sc, tmp.height * sc);
      const fill = G.makeCanvas(tmp.width * sc, tmp.height * sc), fx = fill.getContext('2d');
      fx.imageSmoothingEnabled = false; fx.drawImage(tmp, 0, 0, fill.width, fill.height);
      fx.globalCompositeOperation = 'source-in';
      const gr = fx.createLinearGradient(0, 0, 0, fill.height);
      [['#fff8c0', 0], ['#ffd040', 0.3], ['#ff8a20', 0.6], ['#c02810', 1]].forEach(([col, p]) => gr.addColorStop(p, col));
      fx.fillStyle = gr; fx.fillRect(0, 0, fill.width, fill.height);
      // banded highlight line (16-bit style)
      fx.globalCompositeOperation = 'source-atop'; fx.fillStyle = 'rgba(255,255,255,0.45)'; fx.fillRect(0, 4, fill.width, 3); fx.fillStyle = 'rgba(120,0,0,0.35)'; fx.fillRect(0, fill.height - 8, fill.width, 4);
      x.drawImage(fill, ox, 2);
      const tmp2 = G.makeCanvas(w2 + 2, 9); G.text(tmp2.getContext('2d'), s2, 0, 0, '#e8e0ff', '#201040');
      x.drawImage(tmp2, Math.floor((260 - w2 * 2) / 2), 40, tmp2.width * 2, tmp2.height * 2);
      return c;
    }
    update() {
      this.t++;
      if (G.r(3) === 0) this.embers.push({ x: G.r(G.W), y: G.H + 4, vx: (G.rand() - 0.5) * 0.4, vy: -0.4 - G.rand() * 0.8, life: 200 + G.r(100) });
      this.embers.forEach(e => { e.x += e.vx + Math.sin((this.t + e.life) / 30) * 0.2; e.y += e.vy; e.life--; });
      this.embers = this.embers.filter(e => e.life > 0 && e.y > -5);
      if (this.t < 30) return;
      const d = G.input.repDir(14, 6);
      if (d === 'up' || d === 'down') { let n = this.i; do { n = (n + (d === 'up' ? -1 : 1) + this.opts.length) % this.opts.length; } while (this.opts[n].d); this.i = n; G.audio.sfx('cursor'); }
      if (G.input.p('A')) {
        const o = this.opts[this.i]; if (o.d) { G.audio.sfx('error'); return; }
        G.audio.sfx('ok');
        if (this.i === 0) this.newGame();
        else if (this.i === 1) this.cont();
        else G.push(new Controls());
      }
      if (G.input.p('M')) G.audio.toggleMute();
    }
    newGame() {
      const self = this;
      G.st.newGame();
      const sc = new Blank(); G.replace(sc);
      sc.tasks.add((function* () {
        G.audio.play('story');
        G.fade.a = 0;
        yield G.story.crawl(G.story.prologue);
        G.st.join('rowan');
        G.state.church = { map: 'chapel', x: 6, y: 9 };
        G.goto('forge', 8, 6, 'up');
      })());
    }
    cont() {
      if (!G.st.load(1)) { G.audio.sfx('error'); return; }
      const l = G.state.loc;
      const f = G.goto(G.state.church.map, G.state.church.x, G.state.church.y, 'down');
    }
    draw(ctx) {
      G.drawBattleBG(ctx, 'night', this.t);
      ctx.fillStyle = 'rgba(0,0,20,0.35)'; ctx.fillRect(0, 0, G.W, G.H);
      this.embers.forEach(e => { ctx.globalAlpha = Math.min(1, e.life / 60); ctx.fillStyle = e.life % 20 < 10 ? '#ffb040' : '#ff6020'; ctx.fillRect(Math.round(e.x), Math.round(e.y), 2, 2); });
      ctx.globalAlpha = 1;
      const bob = Math.round(Math.sin(this.t / 40) * 2);
      ctx.drawImage(this.logo, Math.floor((G.W - 260) / 2), 26 + bob);
      if (this.t > 30) {
        G.win(ctx, G.W / 2 - 50, 128, 100, 16 + this.opts.length * 13);
        this.opts.forEach((o, i) => {
          G.text(ctx, o.l, G.W / 2 - 30, 136 + i * 13, o.d ? '#6068a0' : '#fff');
          if (i === this.i && (this.t >> 3) % 4 !== 3) G.text(ctx, '\u0002', G.W / 2 - 40, 136 + i * 13, '#f8e060');
        });
      }
      G.textC(ctx, 'An original tactical RPG', G.W / 2, G.H - 22, '#9098c8');
      G.textC(ctx, 'Z/Enter: OK   X/Esc: Back   C/Shift: Menu   M: Mute', G.W / 2, G.H - 11, '#707aa8');
    }
  }
  class Controls {
    constructor() { this.transparent = true; }
    update() { if (G.input.p('A') || G.input.p('B')) { G.audio.sfx('cancel'); G.pop(); } }
    draw(ctx) {
      G.win(ctx, 20, 20, G.W - 40, G.H - 40);
      const L = [['CONTROLS', '#f8e060'], ['Arrow keys / WASD - move, choose', ''], ['Z, Space, Enter - A: confirm, talk, open battle menu', ''], ['X, Esc - B: cancel, undo a move in battle', ''], ['C, Shift - C: field menu; in battle, look at the map', ''], ['M - mute music & sound', ''], ['', ''],
      ['IN BATTLE', '#f8e060'], ['Each round, units act in order of agility.', ''], ['Walk your unit inside the flashing area, then', ''], ['press A for Attack, Magic, Item or Stay.', ''], ['Forests & hills give Land Effect: less damage taken.', ''], ['If Rowan falls, the force retreats to the church.', '']];
      L.forEach(([s, c], i) => G.text(ctx, s, 32, 30 + i * 12, c || '#fff'));
    }
  }
  G.Title = Title;
  G.toTitle = function () { G.audio.stop(); G.replace(new Title()); };

  // ---------- Boot ----------
  G.boot = function () {
    G.st.newGame();
    G.replace(new Title());
    G.start();
  };
  if (!window.NO_BOOT) G.boot();
})();
