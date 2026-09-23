// ===== Story scenes for Chapter 1 (original) =====
'use strict';
(function () {
  const F = () => G.state.flags;
  const ST = G.story = {};

  // ---------- Prologue text crawl ----------
  class Crawl {
    constructor(lines, w) { this.lines = lines; this.w = w; this.t = 0; this.y = G.H + 10; this.stars = Array.from({ length: 70 }, () => [G.r(G.W), G.r(G.H), G.r(3)]); }
    update() {
      this.t++; this.y -= G.input.h('A') ? 1.2 : 0.35;
      const end = this.y + this.lines.length * 14;
      if (end < -10 || G.input.p('B') || G.input.p('C')) { G.pop(); this.w.resolve(); }
    }
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, G.H); g.addColorStop(0, '#02030c'); g.addColorStop(1, '#1a0c18'); ctx.fillStyle = g; ctx.fillRect(0, 0, G.W, G.H);
      this.stars.forEach(([x, y, b]) => { ctx.fillStyle = (this.t + x) % 90 < 4 ? '#fff' : ['#50507a', '#8080b0', '#c0c0e0'][b]; ctx.fillRect(x, y, 1, 1); });
      // ember glow at bottom
      const r = 40 + Math.sin(this.t / 20) * 4;
      const eg = ctx.createRadialGradient(G.W / 2, G.H + 20, 4, G.W / 2, G.H + 20, r * 2);
      eg.addColorStop(0, 'rgba(255,160,60,0.5)'); eg.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = eg; ctx.fillRect(0, G.H - 90, G.W, 90);
      this.lines.forEach((l, i) => { const y = Math.round(this.y + i * 14); if (y > -10 && y < G.H + 4) G.textC(ctx, l, G.W / 2, y, i === 0 ? '#f8d060' : '#e0e0f0'); });
      G.textR(ctx, 'B: skip', G.W - 4, G.H - 10, '#606080', null);
    }
  }
  ST.crawl = function (lines) { const w = new G.Wait(); G.push(new Crawl(lines, w)); return w; };

  ST.prologue = [
    'EMBERS OF ALDMERE',
    '',
    'In the green valley of Aldmere,',
    'the village of Tallowmere keeps a single flame.',
    '',
    'The villagers call it the Ember: a stone',
    'that glows like a coal and never cools.',
    'For three hundred years it has kept the',
    'long winters from their doors.',
    '',
    'Kingdoms rose and fell beyond the hills.',
    'Tallowmere forgot to notice.',
    '',
    'Until the night the watch bell rang.',
  ];

  // ---------- Forge intro ----------
  ST.intro = function* (f) {
    F().intro = true; f.locked = true;
    const p = f.player; p.x = 8; p.y = 6; p.dir = 'up';
    f.snapCam();
    G.audio.play('headquarters');
    yield 40;
    yield G.say('CLANG... CLANG... CLANG...\nThe watch bell tolls in the dark.');
    const d = f.npc('dunmar');
    yield* f.walkNpc(d, 'rrd');
    d.dir = 'right'; p.dir = 'left';
    yield G.talk('dunmar', 'Rowan. Up. The bell has been going since moonset.');
    yield G.talk('dunmar', 'Watchman says goblins in the south fields. Elder Hobb wants you. Don\'t ask me why, you\'re only good at dropping tongs.');
    yield G.talk('dunmar', '...Take the short sword off the rack. I\'m coming too.');
    f.removeNpc('dunmar');
    yield* G.recruit('dunmar');
    yield G.say('Press C to open the field menu: Member, Magic, Item, Search. Press A to talk and to search what is in front of you.');
    f.locked = false;
  };

  // ---------- Elder ----------
  ST.elderScene = function* (f) {
    F().metElder = true;
    yield G.talk('elder', 'Rowan. Good. You came quickly, and armed. Your master taught you well.');
    yield G.talk('elder', 'Goblins have come down from the Crag. They are burning the south fields. The watch is three men and a dog.');
    yield G.talk('elder', 'Garrick rode with the border lancers before your mother was born. He has agreed to go with you.');
    const g = f.npc('garrick');
    if (g) { yield* f.walkNpc(g, 'l'); g.dir = 'up'; }
    yield G.talk('garrick', 'Still have my lance, and the horse still has most of her teeth. We\'ll manage, lad.');
    if (g) f.removeNpc('garrick');
    yield* G.recruit('garrick');
    yield G.talk('elder', 'Ask Liesl at the chapel to go with you. You will want her healing. Then leave by the south road.');
    yield G.talk('elder', 'And Rowan... you are the one the others will follow. If you fall, they will not stand long. Keep your head.');
    yield G.say('Rowan is the force leader. If Rowan is defeated in battle, the force retreats to the last church, losing half its gold.');
  };

  // ---------- Chapel after the raid ----------
  ST.chapelScene = function* (f) {
    F().chapelScene = true;
    yield G.talk('priest', 'Rowan... forgive me. They came while you were in the fields.');
    yield G.talk('priest', 'Men in grey robes, and a knight in black armour with horns on his helm. They pried the Ember from the altar.');
    if (G.state.members.liesl) yield G.talk('liesl', 'Father! You\'re bleeding. Hold still. Mend!');
    G.audio.sfx('heal');
    yield G.talk('priest', 'A chip broke away when they wrenched it free. Here. It is still warm.');
    G.state.members.rowan.items.length < 4 ? G.state.members.rowan.items.push({ id: 'emberstone', eq: false }) : G.state.depot.push('emberstone');
    G.audio.jingle('item');
    yield G.say('Rowan received the Ember Shard.');
    yield G.talk('priest', 'They called their captain "Draxis." They rode east, toward the ruins of Fort Bramble.');
    yield G.talk('priest', 'Without the Ember, the first frost will kill the valley. Bring it home, children. I will pray for you, and keep the chapel doors open.');
    yield G.say('The bridge east of the village is now open.');
  };

  // ---------- Chapter end ----------
  ST.chapterEnd = function* () {
    G.audio.play('title');
    yield G.fadeTo(0, 0.02);
    yield ST.crawl([
      'CHAPTER 1: THE EMBER\'S TRAIL',
      '',
      'Captain Draxis lay defeated in the ruins of Fort Bramble.',
      'But the Ember was gone, carried north',
      'toward a place called the Ashen Throne.',
      '',
      'Rowan closed his hand around the warm shard.',
      'It pulsed, faintly, like a second heartbeat,',
      'pointing the way.',
      '',
      'The force of Tallowmere would follow.',
      '',
      '',
      'END OF CHAPTER 1',
      '',
      'Thank you for playing!',
    ]);
    F().chapter1Clear = true;
    G.push(new ST.Roster());
  };
  ST.Roster = class {
    constructor() { this.t = 0; }
    update() { this.t++; if (this.t > 60 && (G.input.p('A') || G.input.p('B'))) { G.st.save(2); G.toTitle(); } }
    draw(ctx) {
      ctx.fillStyle = '#060818'; ctx.fillRect(0, 0, G.W, G.H);
      G.textC(ctx, 'THE FORCE OF TALLOWMERE', G.W / 2, 10, '#f8d060');
      const ros = G.st.roster();
      ros.forEach((u, i) => {
        const x = 12 + (i % 2) * 154, y = 28 + Math.floor(i / 2) * 44;
        G.win(ctx, x, y, 148, 40);
        ctx.drawImage(G.unitSprite(G.data.chars[u.id].map, 'down', Math.floor(this.t / 20) % 2), x + 6, y + 8);
        G.text(ctx, u.name, x + 34, y + 7); G.textR(ctx, 'L' + u.lv, x + 140, y + 7, '#f8e060');
        G.text(ctx, G.data.classes[u.cls].name, x + 34, y + 18, '#a0c0ff');
        G.text(ctx, 'Kills ' + (u.kills || 0), x + 34, y + 28, '#c0c8e8');
      });
      G.textC(ctx, 'Your progress is saved in slot 2.  Press A.', G.W / 2, G.H - 12, '#8090c0');
    }
  };
})();
