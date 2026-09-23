// ===== UI: dialogue boxes, list menus, 4-way icon menus, number/confirm prompts =====
'use strict';
(function () {
  // Awaitable handle returned by UI calls; generators can `yield` it.
  class Wait { constructor() { this.fin = false; this.result = undefined; } done() { return this.fin; } resolve(v) { this.result = v; this.fin = true; } }
  G.Wait = Wait;

  // ---------- Dialogue ----------
  // G.say(text | [texts], {name, portrait, pos:'bottom'|'top', auto}) -> Wait
  class TextBox {
    constructor(pages, opts, w) {
      this.transparent = true; this.opts = opts || {}; this.w = w;
      this.pages = (Array.isArray(pages) ? pages : [pages]).map(p => String(p));
      this.pi = 0; this.setPage();
    }
    setPage() {
      const hasP = !!this.opts.portrait;
      this.boxX = hasP ? 70 : 8; this.boxW = G.W - this.boxX - 8;
      this.lines = G.wrap(this.pages[this.pi], this.boxW - 18);
      this.shown = 0; this.total = this.lines.join('').length; this.scroll = 0; this.t = 0;
    }
    update() {
      this.t++;
      const maxLines = 3;
      const visibleChars = this.lines.slice(this.scroll, this.scroll + maxLines).join('').length;
      const prevChars = this.lines.slice(0, this.scroll).join('').length;
      const target = prevChars + visibleChars;
      if (this.shown < target) {
        const sp = G.input.h('A') || G.input.h('B') ? 4 : 1;
        for (let k = 0; k < sp && this.shown < target; k++) { this.shown++; }
        if (this.t % 3 === 0 && !this.opts.silent) G.audio.sfx('text');
        if ((G.input.p('A') || G.input.p('B')) && this.t > 4) this.shown = target;
        return;
      }
      if (this.opts.auto) { if (this.t > this.opts.auto) this.next(); return; }
      if (G.input.p('A') || G.input.p('B') || G.input.p('C')) this.next();
    }
    next() {
      if (this.scroll + 3 < this.lines.length) { this.scroll += 3; this.t = 0; return; }
      this.pi++;
      if (this.pi >= this.pages.length) { G.pop(); this.w.resolve(); return; }
      this.setPage();
    }
    draw(ctx) {
      const top = this.opts.pos === 'top';
      const h = 50, y = top ? 6 : G.H - h - 6;
      if (this.opts.portrait) {
        const py = top ? 6 : G.H - 60 - 6;
        G.win(ctx, 6, py, 60, 60);
        G.drawPortrait(ctx, this.opts.portrait, 10, py + 4, this.t);
      }
      G.win(ctx, this.boxX, y, this.boxW, h);
      let chars = this.shown - this.lines.slice(0, this.scroll).join('').length;
      for (let i = 0; i < 3; i++) {
        const ln = this.lines[this.scroll + i]; if (ln === undefined) break;
        const part = ln.slice(0, Math.max(0, chars)); chars -= ln.length;
        G.text(ctx, part, this.boxX + 9, y + 9 + i * 12);
      }
      const done = this.shown >= this.lines.slice(0, this.scroll + 3).join('').length;
      if (done && !this.opts.auto && (this.t >> 4) % 2 === 0) G.text(ctx, '\u0001', this.boxX + this.boxW - 14, y + h - 12, '#f8e060');
    }
  }
  G.say = function (pages, opts) { const w = new Wait(); G.push(new TextBox(pages, opts, w)); return w; };

  // ---------- List menu ----------
  // items: [{label, right?, disabled?, color?}] or strings. opts: {x,y,w,title,cols,onMove(i),maxRows,cancel:true,help(i)->str}
  class ListMenu {
    constructor(items, opts, w) {
      this.transparent = true; this.w = w; this.opts = opts || {};
      this.items = items.map(it => typeof it === 'string' ? { label: it } : it);
      this.i = G.clamp(this.opts.start || 0, 0, Math.max(0, this.items.length - 1)); this.top = 0; this.t = 0;
      this.rows = Math.min(this.items.length, this.opts.maxRows || 8);
      const iw = Math.max(...this.items.map(it => G.textWidth(it.label) + (it.right ? G.textWidth(it.right) + 14 : 0)), this.opts.title ? G.textWidth(this.opts.title) : 0);
      this.wd = this.opts.w || iw + 30;
      this.ht = this.rows * 12 + 14 + (this.opts.title ? 12 : 0);
      this.x = this.opts.x != null ? this.opts.x : Math.floor((G.W - this.wd) / 2);
      this.y = this.opts.y != null ? this.opts.y : Math.floor((G.H - this.ht) / 2);
      this.opts.onMove && this.opts.onMove(this.i);
    }
    update() {
      this.t++;
      const n = this.items.length; if (!n) { if (G.input.p('B') || G.input.p('A')) { G.pop(); this.w.resolve(-1); } return; }
      const d = G.input.repDir(14, 4);
      if (d === 'up' || d === 'down') {
        this.i = (this.i + (d === 'up' ? -1 : 1) + n) % n; G.audio.sfx('cursor');
        this.opts.onMove && this.opts.onMove(this.i);
      }
      if (this.i < this.top) this.top = this.i; if (this.i >= this.top + this.rows) this.top = this.i - this.rows + 1;
      if (G.input.p('A')) {
        const it = this.items[this.i];
        if (it.disabled) { G.audio.sfx('error'); return; }
        G.audio.sfx('ok'); if (!this.opts.keep) G.pop(); this.w.resolve(this.i);
      } else if (G.input.p('B') && this.opts.cancel !== false) { G.audio.sfx('cancel'); G.pop(); this.w.resolve(-1); }
    }
    draw(ctx) {
      G.win(ctx, this.x, this.y, this.wd, this.ht);
      let y = this.y + 8;
      if (this.opts.title) { G.text(ctx, this.opts.title, this.x + 9, y, '#f8e060'); y += 12; }
      for (let r = 0; r < this.rows; r++) {
        const idx = this.top + r, it = this.items[idx]; if (!it) break;
        const col = it.disabled ? '#7078a0' : (it.color || '#fff');
        G.text(ctx, it.label, this.x + 17, y + r * 12, col);
        if (it.right) G.textR(ctx, it.right, this.x + this.wd - 9, y + r * 12, col);
        if (idx === this.i && (this.t >> 3) % 4 !== 3) G.text(ctx, '\u0002', this.x + 8, y + r * 12, '#f8e060');
      }
      if (this.top > 0) G.textC(ctx, '^', this.x + this.wd / 2, this.y + 2, '#f8e060');
      if (this.top + this.rows < this.items.length) G.textC(ctx, '\u0001', this.x + this.wd / 2, this.y + this.ht - 8, '#f8e060');
      if (this.opts.help) {
        const hs = this.opts.help(this.i); if (hs) { const lines = G.wrap(hs, G.W - 34); const hh = lines.length * 11 + 12; G.win(ctx, 8, G.H - hh - 6, G.W - 16, hh); lines.forEach((l, k) => G.text(ctx, l, 17, G.H - hh + 1 + k * 11)); }
      }
    }
  }
  G.menu = function (items, opts) { const w = new Wait(); G.push(new ListMenu(items, opts, w)); return w; };

  // ---------- Yes/No ----------
  G.confirm = function (opts = {}) { return G.menu([{ label: 'Yes' }, { label: 'No' }], Object.assign({ x: G.W - 70, y: G.H - 110 }, opts)); };

  // ---------- 4-way icon menu (SF-style cross) ----------
  // entries: {up:{label, icon}, left:..., right:..., down:...}; returns 'up'/'left'/... or null
  class CrossMenu {
    constructor(entries, opts, w) { this.transparent = true; this.e = entries; this.opts = opts || {}; this.w = w; this.sel = 'up'; this.t = 0; }
    update() {
      this.t++;
      const d = G.input.repDir(20, 10);
      if (d && this.e[d]) { if (d !== this.sel) G.audio.sfx('cursor'); this.sel = d; }
      if (G.input.p('A')) {
        const en = this.e[this.sel];
        if (en.disabled) { G.audio.sfx('error'); return; }
        G.audio.sfx('ok'); G.pop(); this.w.resolve(this.sel);
      } else if (G.input.p('B')) { G.audio.sfx('cancel'); G.pop(); this.w.resolve(null); }
    }
    draw(ctx) {
      const cx = this.opts.x != null ? this.opts.x : G.W / 2, cy = this.opts.y != null ? this.opts.y : G.H - 52;
      const pos = { up: [0, -22], left: [-30, 0], right: [30, 0], down: [0, 22] };
      for (const d of ['up', 'left', 'right', 'down']) {
        const en = this.e[d]; if (!en) continue;
        const [dx, dy] = pos[d]; const s = d === this.sel;
        const bob = s ? Math.round(Math.sin(this.t / 5) * 1.5) : 0;
        G.drawIcon(ctx, en.icon, cx + dx - 12, cy + dy - 10 + bob, s, en.disabled);
      }
      const lab = this.e[this.sel].label;
      const lw = G.textWidth(lab) + 18;
      G.win(ctx, cx + 48, cy - 8, Math.max(56, lw), 20);
      G.text(ctx, lab, cx + 57, cy - 2, this.e[this.sel].disabled ? '#7078a0' : '#fff');
    }
  }
  G.cross = function (entries, opts) { const w = new Wait(); G.push(new CrossMenu(entries, opts, w)); return w; };

  // ---------- Icons (procedural 24x20 framed tiles) ----------
  const ICON_ART = {
    attack: ['.........ww', '........wWw', '.......wWw.', '......wWw..', '.....wWw...', '.y..wWw....', '.yyWWw.....', '..yyy......', '.bybyy.....', 'bb...y.....', 'b..........'],
    magic: ['....s.....', '...sSs....', '....s.....', '...ooo....', '...oOo....', '....b.....', '....b.....', '....b.....', '....b.....', '....b.....', '...bbb....'],
    item: ['...bbbb...', '..b....b..', '.rrrrrrrr.', 'rRRRRRRRRr', 'rRRyyRRRRr', 'rRRyyRRRRr', 'rRRRRRRRRr', 'rRRRRRRRRr', '.rrrrrrrr.'],
    stay: ['....hh....', '...hssh...', '...ssss...', '....ss....', '..bbbbbb..', '.bbbbbbbb.', '.s.bbbb.s.', '...bbbb...', '...b..b...', '...b..b...', '..bb..bb..'],
    member: ['...hhhh...', '..hhhhhh..', '..hssssh..', '..sesses..', '..ssssss..', '...smms...', '....ss....', '..bbbbbb..', '.bbbbbbbb.', 'bbbbbbbbbb'],
    search: ['..gggg....', '.gWWWWg...', 'gWwwwwWg..', 'gWwwwwWg..', 'gWwwwwWg..', '.gWWWWg...', '..ggggbb..', '......bbb.', '.......bbb', '........bb'],
    talk: ['.wwwwwwww.', 'wwwwwwwwww', 'ww.w.w.www', 'wwwwwwwwww', '.wwwwwwww.', '...ww.....', '..w.......'],
    give: ['..rr......', '.rRRr.....', '.rRRr.....', '..rr.ss...', '....sssss.', '...ssssss.', '...sssss..'],
    equip: ['.gg....gg.', 'gWWg..gWWg', 'gWWWggWWWg', '.gWWWWWWg.', '..gWWWWg..', '..gWWWWg..', '.gWWggWWg.', '.gWg..gWg.'],
    drop: ['....b.....', '....b.....', '....b.....', '..bbbbb...', '...bbb....', '....b.....', '..........', '.rrrrrrr..'],
    use: ['...gg.....', '..gggg....', '..gGGg....', '.gGGGGg...', '.gGGGGg...', '.gGGGGg...', '..gggg....'],
    depot: ['rrrrrrrrrr', 'rRRRRRRRRr', 'rryyyyyyrr', 'rRRRRRRRRr', 'rRRRRRRRRr', 'rrrrrrrrrr'],
    join: ['..h....h..', '.hsh..hsh.', '.sss..sss.', '..s....s..', '.bbb..ccc.', 'bbbbbcccccc', '.bb....cc.'],
    quit: ['w........w', '.w......w.', '..w....w..', '...w..w...', '....ww....', '...w..w...', '..w....w..', '.w......w.', 'w........w'],
  };
  const ICON_PAL = { w: '#e8e8f8', W: '#a8b0d0', y: '#e8b830', b: '#8a5a30', s: '#f0c8a0', S: '#fff8a0', o: '#58a8f8', O: '#b8e0ff', r: '#a83828', R: '#d86040', h: '#704018', e: '#202040', m: '#c05050', g: '#b0b8c8', G: '#50e080', c: '#3868c8' };
  G.drawIcon = function (ctx, name, x, y, sel, disabled) {
    const frame = G.cached('iconframe' + (sel ? 1 : 0) + (disabled ? 1 : 0), 24, 20, (c) => {
      c.fillStyle = '#000010'; c.fillRect(1, 0, 22, 20); c.fillRect(0, 1, 24, 18);
      c.fillStyle = sel ? '#f0d060' : '#8898e0'; c.fillRect(1, 1, 22, 18);
      c.fillStyle = disabled ? '#303858' : (sel ? '#304cc0' : '#1c2c8c'); c.fillRect(2, 2, 20, 16);
    });
    ctx.drawImage(frame, Math.round(x), Math.round(y));
    const art = ICON_ART[name]; if (!art) return;
    const spr = G.sprite('icon_' + name, art, ICON_PAL);
    ctx.globalAlpha = disabled ? 0.45 : 1;
    ctx.drawImage(spr, Math.round(x + 12 - spr.width / 2), Math.round(y + 10 - spr.height / 2));
    ctx.globalAlpha = 1;
  };

  // ---------- Simple "gold" window ----------
  G.goldWin = function (ctx, x, y) { G.win(ctx, x, y, 76, 20); G.text(ctx, '\u0004', x + 8, y + 6, '#f8d030'); G.textR(ctx, G.state.gold + 'G', x + 68, y + 6); };
})();
