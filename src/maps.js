// ===== Map & battle definitions for Chapter 1 (original content) =====
'use strict';
(function () {
  const MD = G.MAPDATA, F = () => G.state.flags;
  const P = (m, tag) => MD[m].pos[tag];
  const say = (who, text, opts) => G.talk(who, text, opts);

  // ---------------- helpers ----------------
  G.talk = function (who, text, opts = {}) {
    let portrait = null;
    if (who && G.data.chars[who]) portrait = G.data.chars[who].portrait;
    else if (who && G.data.npcs[who]) portrait = G.data.npcs[who].portrait;
    else if (who && G.data.enemies[who]) portrait = G.data.enemies[who].portrait;
    return G.say(text, Object.assign({ portrait }, opts));
  };
  G.recruit = function* (id) {
    if (G.state.members[id]) return;
    G.st.join(id);
    G.audio.jingle('join');
    yield G.say(G.data.chars[id].name + ' joined the force!', { portrait: G.data.chars[id].portrait });
    yield 20;
  };

  // ================= TALLOWMERE =================
  const tm = MD.tallowmere;
  G.maps.tallowmere = {
    name: 'Tallowmere', rows: tm.rows, music: 'town',
    exits: [
      { x: P('tallowmere', 'chapelDoor')[0], y: 4, to: 'chapel', tx: 6, ty: 10, dir: 'up' },
      { x: 5, y: 7, to: 'elderhouse', tx: 5, ty: 7, dir: 'up' },
      { x: 25, y: 8, to: 'weaponshop', tx: 5, ty: 6, dir: 'up' },
      { x: 5, y: 16, to: 'forge', tx: 3, ty: 7, dir: 'up' },
      { x: 23, y: 17, to: 'itemshop', tx: 5, ty: 6, dir: 'up' },
      { x: 12, y: 21, to: 'house', tx: 3, ty: 5, dir: 'up' },
      { x: 16, y: 25, run: function* (f) {
          if (G.state.battlesWon.b1) { yield G.talk('dunmar', 'The south fields are quiet now. The thieves went east, lad.'); f.player.dir = 'up'; return false; }
          if (!F().metElder) { yield G.talk('dunmar', 'Not so fast. The Elder sent for you. His house is up the west lane.'); f.player.dir = 'up'; return false; }
          yield G.say('Smoke rises over the south fields...');
          yield G.fadeTo(1, 0.05); G.startBattle('b1'); return false;
        } },
      { x: 33, y: 10, cond: () => true, run: function* (f) {
          if (!G.state.battlesWon.b1) { yield G.talk('guard', 'Nobody crosses the bridge tonight. Elder\'s orders.'); f.player.dir = 'left'; return false; }
          if (!F().chapelScene) { yield G.talk('liesl', 'Rowan, wait! Something is wrong at the chapel!'); f.player.dir = 'left'; return false; }
          return true;
        }, to: 'vale', tx: 6, ty: 14, dir: 'right' },
    ],
    npcs: [
      { id: 'pip', char: 'pip', x: 18, y: 11, dir: 'left', cond: () => !G.state.members.pip, talk: function* (f) {
          yield G.talk('pip', 'Oi! You\'re the smith\'s boy. I saw them, goblins with torches, sneaking round the south fields!');
          yield G.talk('pip', 'Old Tamsy feeds me bread when the rabbits are clever. I owe her. Take me along? I shoot straighter than I lie.');
          f.removeNpc('pip'); yield* G.recruit('pip');
        } },
      { id: 'guard', npc: 'guard', x: 31, y: 9, dir: 'left', fixed: true, talk: function* () {
          if (!G.state.battlesWon.b1) yield G.talk('guard', 'Goblins, at harvest! In my day they stayed up in the hills where they belong.');
          else yield G.talk('guard', 'The bridge is open. Mind the old mill road: they say something nests in the rafters now.');
        } },
      { id: 'v1', npc: 'villagerF', x: 9, y: 10, wander: 2, talk: function* () {
          if (!G.state.battlesWon.b1) yield G.talk('villagerF', 'The watch bell woke the whole village. My husband took the pitchfork and went to stand by the fence. The fool.');
          else yield G.talk('villagerF', 'You drove them off! But the chapel... who would steal from Father Anselm?');
        } },
      { id: 'v2', npc: 'villagerM', x: 20, y: 13, wander: 2, talk: function* () {
          if (!G.state.battlesWon.b1) yield G.talk('villagerM', 'Tip for a young fighter: stand in the woods or on the hills. The land shields you, and the blows land softer.');
          else yield G.talk('villagerM', 'Level up, they say, and you grow stronger. Train hard! At level twenty the chapel can promote you to a better class.');
        } },
      { id: 'kid', npc: 'child', x: 14, y: 14, wander: 3, talk: ['Rowan! Rowan! Is it true you can swing a hammer AND a sword?', 'Press C to open your menu. Search things with A! The old barrels by the weapon shop always have something...'] },
      { id: 'granny', npc: 'oldwoman', x: 26, y: 19, dir: 'left', wander: 1, talk: function* () {
          if (!F().grannyGift && G.state.battlesWon.b1) { F().grannyGift = true; yield G.talk('oldwoman', 'You saved my wheat, dear. Take this, it\'s what my late husband carried to war.'); const w = G.st.giveItem('swiftband'); G.audio.jingle('item'); yield G.say((w ? w.name : 'The depot') + ' received the Swift Band!'); }
          else yield G.talk('oldwoman', 'My wheat! Those horrid little goblins! Oh, if I were forty years younger...');
        } },
      { id: 'v3', npc: 'villagerM', x: 7, y: 20, wander: 2, talk: 'The Ember in the chapel has burned since before the kingdom had a name. Keeps the winter off us, my mother said.' },
    ],
    searches: {
      '22,8': { item: 'mendleaf', text: 'Rowan looks inside the barrel...' },
      '28,8': { gold: 20, text: 'Rowan looks inside the barrel...' },
      '16,10': { gold: 10, text: 'Rowan peers into the well. Something glints on the ledge.' },
      '13,10': { text: 'A stone statue of Saint Elowen, holding up a flame. The plaque reads: "Carry the light."', emptyText: 'Saint Elowen gazes eastward.' },
      '26,13': { item: 'purgebloom', text: 'A purple flower grows in the shadow of the rock.' },
    },
    events: [],
    onEnter: function* (f) {
      if (G.state.battlesWon.b1 && !F().chapelScene && !F().alarmScene) {
        F().alarmScene = true; f.locked = true;
        yield 20;
        const v = f.addNpc({ id: 'runner', npc: 'villagerM', x: 16, y: 13, dir: 'down' });
        yield G.talk('villagerM', 'Rowan! Thank the Ember you\'re back! The chapel... there were robed men... Father Anselm is hurt!');
        f.removeNpc('runner');
        f.locked = false;
      }
    }
  };

  // ---------- Chapel ----------
  G.maps.chapel = {
    name: 'Chapel of the Ember', rows: MD.chapel.rows, music: 'church',
    exits: [{ x: 6, y: 11, to: 'tallowmere', tx: 16, ty: 5, dir: 'down' }],
    npcs: [
      { id: 'priest', npc: 'priest', x: 6, y: 3, fixed: true, talk: function* () {
          if (G.state.battlesWon.b1 && !F().chapelScene) { yield* G.story.chapelScene(G.field); return; }
          yield* G.church(G.data.npcs.priest);
        } },
      { id: 'liesl', char: 'liesl', x: 4, y: 4, cond: () => !G.state.members.liesl, talk: function* (f) {
          if (!F().metElder) { yield G.talk('liesl', 'Rowan? You look like you slept in the forge again. The Elder was asking for you, you know.'); return; }
          yield G.talk('liesl', 'You\'re going to the fields? Then I\'m coming with you. Don\'t argue, someone has to keep you from bleeding on things.');
          yield G.talk('priest', 'Go with the Ember\'s blessing, child. Remember your Mend prayers.');
          f.removeNpc('liesl'); yield* G.recruit('liesl');
        } },
      { id: 'mirelle', char: 'mirelle', x: 9, y: 4, dir: 'up', cond: () => !G.state.members.mirelle, talk: function* (f) {
          if (!F().metElder) { yield G.talk('mirelle', 'Shh. I\'m studying the Ember. Three hundred years without fuel. Fascinating, isn\'t it? Wood burns. This... listens.'); return; }
          yield G.talk('mirelle', 'Goblins burning fields? How crude. Fire deserves better handlers.');
          yield G.talk('mirelle', 'I\'ll come. Consider it field research. Try not to stand where I\'m aiming.');
          f.removeNpc('mirelle'); yield* G.recruit('mirelle');
        } },
      { id: 'nun', npc: 'villagerF', x: 10, y: 8, wander: 1, talk: 'Father Anselm can raise the fallen, cure poison, promote seasoned warriors, and record your deeds. Speak to him whenever you pass through.' },
    ],
    searches: { '2,1': { item: 'mendleaf', text: 'Among the hymnals is a pressed leaf, still green.' }, '6,2': { text: 'The altar holds the sacred Ember, a stone that glows like a coal and hums softly.', cond: () => !G.state.battlesWon.b1, emptyText: 'The altar is empty...' } },
  };

  // ---------- Elder's house ----------
  G.maps.elderhouse = {
    name: 'Elder Hobb\'s House', rows: MD.elderhouse.rows, music: 'headquarters',
    exits: [{ x: 5, y: 8, to: 'tallowmere', tx: 5, ty: 8, dir: 'down' }],
    npcs: [
      { id: 'elder', npc: 'elder', x: 4, y: 3, fixed: true, talk: function* (f) {
          if (!F().metElder) { yield* G.story.elderScene(f); return; }
          if (G.state.battlesWon.b1 && F().chapelScene) { yield G.talk('elder', 'Fort Bramble lies east, past the mill and the Wraithwood. Bring the Ember home, Rowan.'); return; }
          yield G.talk('elder', 'The south road, Rowan. Quickly!');
        } },
      { id: 'garrick', char: 'garrick', x: 7, y: 5, dir: 'left', cond: () => !G.state.members.garrick, talk: function* (f) {
          if (!F().metElder) { yield G.talk('garrick', 'Go on, talk to the Elder. I\'m just here for the tea.'); return; }
          yield G.talk('garrick', 'Ready when you are, lad. My horse is saddled out back.');
        } },
    ],
    searches: { '9,6': { item: 'purgebloom', text: 'A jar of dried flowers.' }, '2,1': { text: 'Dusty ledgers of harvests past.' } },
  };

  // ---------- Shops ----------
  G.maps.weaponshop = {
    name: 'Brask\'s Arms', rows: MD.weaponshop.rows, music: 'town',
    exits: [{ x: 5, y: 7, to: 'tallowmere', tx: 25, ty: 9, dir: 'down' }],
    npcs: [{ id: 'clerk', npc: 'smith', x: 4, y: 2, fixed: true, talk: function* () {
      yield* G.shop(['shortsword', 'broadsword', 'pike', 'javelin', 'shortbow', 'handaxe', 'oakstaff', 'wraps'], { portrait: G.data.npcs.smith.portrait, deals: G.state.battlesWon.b1 ? ['lance', 'longbow'] : [], greet: 'Blades, pikes, bows. Dunmar forged half of these, so treat them kindly.' });
    } }],
    searches: { '1,5': { item: 'mendleaf' } },
  };
  G.maps.itemshop = {
    name: 'Tamsy\'s Sundries', rows: MD.itemshop.rows, music: 'town',
    exits: [{ x: 5, y: 7, to: 'tallowmere', tx: 23, ty: 18, dir: 'down' }],
    npcs: [{ id: 'clerk', npc: 'grocer', x: 5, y: 2, fixed: true, talk: function* () {
      yield* G.shop(['mendleaf', 'tonic', 'purgebloom', 'feather'], { portrait: G.data.npcs.grocer.portrait, greet: 'Herbs and sundries! A Recall Feather will bring you straight home, you know.' });
    } }],
    searches: { '1,5': { gold: 15, text: 'A dropped coin purse behind the crate!' } },
  };
  G.maps.forge = {
    name: 'Dunmar\'s Forge', rows: MD.forge.rows, music: 'headquarters',
    exits: [{ x: 3, y: 8, to: 'tallowmere', tx: 5, ty: 17, dir: 'down' }],
    npcs: [
      { id: 'dunmar', char: 'dunmar', x: 5, y: 4, dir: 'down', cond: () => !G.state.members.dunmar, talk: function* () { yield G.talk('dunmar', 'Hmph.'); } },
      { id: 'hq', npc: 'villagerF', x: 2, y: 6, fixed: true, spec: Object.assign({}, G.data.npcs.villagerF.map, { outfit: '#806040' }), talk: function* () {
          yield G.say('This is the force\'s headquarters. Here you can swap members, store items in the depot, and sort your gear.', { portrait: G.data.npcs.villagerF.portrait });
          yield* G.caravan();
        } },
    ],
    searches: { '1,2': { gold: 20, text: 'Rowan checks the scrap crate. Some coins he forgot about!' }, '8,4': { item: 'tonic', text: 'A flask on the workbench.' } },
    onEnter: function* (f) { if (!F().intro) yield* G.story.intro(f); },
  };
  G.maps.house = {
    name: 'Tamsy\'s Cottage', rows: MD.house.rows, music: 'town',
    exits: [{ x: 3, y: 6, to: 'tallowmere', tx: 12, ty: 22, dir: 'down' }],
    npcs: [{ id: 'tamsy', npc: 'oldwoman', x: 5, y: 3, dir: 'left', talk: 'My daughter runs the sundries shop. Me, I just knit and worry.' }],
    searches: { '1,1': { item: 'mendleaf', text: 'An herb book, with a sprig tucked inside.' } },
  };

  // ================= ALDMERE VALE (overworld) =================
  G.maps.vale = {
    name: 'Aldmere Vale', rows: MD.vale.rows, music: 'field',
    exits: [
      { x: 5, y: 14, to: 'tallowmere', tx: 32, ty: 10, dir: 'left' },
      { x: 20, y: 18, battle: 'b2', cond: () => !G.state.battlesWon.b2 },
      { x: 27, y: 10, to: 'camp', tx: 1, ty: 11, dir: 'right' },
      { x: 29, y: 11, battle: 'b3', cond: () => !G.state.battlesWon.b3 },
      { x: 40, y: 22, battle: 'b4', cond: () => !G.state.battlesWon.b4 },
    ],
    npcs: [
      { id: 'trav', npc: 'villagerM', x: 12, y: 15, wander: 2, talk: 'Mill Bridge is crawling with goblins. They took the old mill for a lookout.' },
    ],
    searches: { '18,10': { item: 'mightelixir', text: 'Something is wedged beneath the boulder...' }, '12,12': { gold: 30, text: 'A traveller\'s cache hidden under the stone!' } },
    events: [
      { x: 25, y: 18, once: true, cond: () => G.state.battlesWon.b2, run: function* () { yield G.talk('kestrel', 'The camp is north of here. Woodcutters, and a hermit who knows the old prayers.'); } },
    ],
  };

  // ================= WOODCUTTER CAMP =================
  G.maps.camp = {
    name: 'Woodcutter Camp', rows: MD.camp.rows, music: 'headquarters',
    exits: [
      { x: 0, y: 11, to: 'vale', tx: 27, ty: 11, dir: 'down' },
      { x: 19, y: 11, to: 'vale', tx: 28, ty: 10, dir: 'right' },
      { x: 5, y: 5, to: 'cabin', tx: 5, ty: 6, dir: 'up' },
    ],
    npcs: [
      { id: 'hermit', npc: 'hermit', x: 11, y: 9, fixed: true, dir: 'down', talk: function* () {
          G.state.church = { map: 'camp', x: 11, y: 10 };
          yield G.talk('hermit', 'I keep this old shrine. The Ember\'s light reaches even here, if faintly.');
          yield* G.church(G.data.npcs.hermit);
        } },
      { id: 'jun', char: 'jun', x: 15, y: 9, dir: 'left', cond: () => !G.state.members.jun, talk: function* (f) {
          yield G.talk('jun', 'You carry a warm thing. An Ember Shard? Then the Legion took the rest. I have seen their fires in the Wraithwood.');
          yield G.talk('jun', 'The Open Hand teaches: a fist that does not close for others is only a hand. I will walk with you.');
          f.removeNpc('jun'); yield* G.recruit('jun');
        } },
      { id: 'cutter', npc: 'woodcutter', x: 8, y: 7, wander: 2, talk: 'The Wraithwood used to be good timber. Now the dead walk in it. Bring fire. They hate fire.' },
      { id: 'cutter2', npc: 'villagerM', x: 14, y: 5, wander: 1, talk: 'Fort Bramble? It\'s been a ruin since the border wars. Whoever holds it now brought orcs.' },
    ],
    searches: { '12,4': { item: 'tonic', text: 'A crate of supplies.' }, '4,9': { item: 'manadew', text: 'A stack of firewood hides a little blue vial.' } },
  };
  G.maps.cabin = {
    name: 'Ebb\'s Cabin', rows: MD.weaponshop.rows, music: 'headquarters',
    exits: [{ x: 5, y: 7, to: 'camp', tx: 5, ty: 6, dir: 'down' }],
    npcs: [{ id: 'ebb', npc: 'woodcutter', x: 4, y: 2, fixed: true, talk: function* () {
      yield* G.shop(['broadsword', 'lance', 'wingspear', 'longbow', 'waraxe', 'wardrod', 'ironknuckle', 'mendleaf', 'tonic', 'purgebloom', 'manadew', 'feather'], { portrait: G.data.npcs.woodcutter.portrait, deals: ['mightband', 'wardband'], greet: 'Supplies from the capital. Pricey, but they\'ll keep you breathing.' });
    } }],
    searches: {},
  };

  // ================= BATTLES =================
  G.battles.b1 = {
    name: 'Tallowmere Fields', map: MD.b1.rows, music: 'battle', win: 'all',
    allies: [[11, 16], [10, 16], [12, 17], [9, 17], [10, 17], [11, 17], [13, 17], [9, 16]],
    enemies: [
      { t: 'goblin', x: 5, y: 9 }, { t: 'goblin', x: 8, y: 8 }, { t: 'goblin', x: 13, y: 6 }, { t: 'goblin', x: 16, y: 8 },
      { t: 'rat', x: 3, y: 12 }, { t: 'rat', x: 6, y: 11 }, { t: 'rat', x: 17, y: 11 },
      { t: 'goblinarcher', x: 15, y: 3 }, { t: 'goblinarcher', x: 7, y: 4 },
      { t: 'goblin', name: 'Grub-boss', x: 11, y: 1, lv: 3, ai: 'wait', drop: { item: 'tonic', chance: 100 } },
    ],
    intro: function* (b) {
      yield* b.focus(11, 3);
      yield G.talk('goblin', 'Burn it! Burn it all! Keep them looking south, the boss said!', { pos: 'top' });
      yield* b.focus(11, 16);
      yield G.talk('garrick', 'Goblins, a dozen at least. Stay together and let them come to us.');
      yield G.say('Tip: move with the arrow keys, then press A for the action menu. Press B to undo a move, and C to look around the map.', { pos: 'top' });
    },
    outro: function* (b) {
      yield G.talk('goblin', 'Enough! Enough! We done our part, run!', { pos: 'top' });
      yield G.talk('garrick', '"Done our part"? That was a diversion... The village!');
    },
    onLose: 'tallowmere',
  };
  G.battles.b2 = {
    name: 'Mill Bridge', map: MD.b2.rows, music: 'battle', win: 'all', allyDir: 'right',
    allies: [[2, 8], [1, 7], [1, 9], [2, 7], [2, 9], [0, 8], [0, 7], [0, 9], [1, 8], [3, 8]],
    enemies: [
      { t: 'rat', x: 7, y: 11 }, { t: 'goblin', x: 8, y: 5 },
      { t: 'bat', x: 12, y: 5 }, { t: 'bat', x: 12, y: 12 },
      { t: 'goblinarcher', x: 15, y: 6 }, { t: 'goblinarcher', x: 15, y: 10 },
      { t: 'goblin', x: 15, y: 8, lv: 3 }, { t: 'goblin', x: 18, y: 7, lv: 3 }, { t: 'wolf', x: 20, y: 9 }, { t: 'wolf', x: 17, y: 11 },
      { t: 'goblin', name: 'Skarn', x: 22, y: 8, lv: 5, ai: 'wait', drop: { item: 'broadsword', chance: 100 } },
    ],
    intro: function* (b) {
      yield* b.focus(20, 6);
      yield G.say('A voice cries out from the mill: "Help! Anyone! They\'ve got me tied to the grain wheel!"', { pos: 'top' });
      yield* b.focus(18, 8);
      yield G.talk('goblin', 'More villagers? Shoot them off the bridge, lads! Nobody follows the robed ones!', { pos: 'top' });
      yield* b.focus(2, 8);
      yield G.talk('pip', 'Archers on the far bank. Careful: arrows can\'t hit someone standing right beside them, but everything else is fair game.');
    },
    outro: function* () {
      yield G.say('The goblins scatter into the reeds.');
      yield G.talk('kestrel', 'About time! Untie me, groundling. Carefully! Those are my good feathers.');
      yield G.talk('kestrel', 'I\'m Kestrel, courier out of Aerie. I saw hooded men carrying a burning stone east. The goblins caught me watching.');
      yield G.talk('kestrel', 'You\'re chasing them? Then you need eyes in the sky. Lucky you.');
      yield* G.recruit('kestrel');
    },
  };
  G.battles.b3 = {
    name: 'The Wraithwood', map: MD.b3.rows, music: 'story', win: 'all', bgOverride: null,
    allies: [[2, 17], [1, 17], [3, 17], [2, 16], [1, 16], [3, 16], [4, 17], [1, 18], [2, 18], [3, 18], [4, 16], [5, 17]],
    enemies: [
      { t: 'skeleton', x: 11, y: 11 }, { t: 'skeleton', x: 3, y: 8 }, { t: 'skeleton', x: 13, y: 8 },
      { t: 'slime', x: 13, y: 12 }, { t: 'slime', x: 15, y: 16 },
      { t: 'wraith', x: 19, y: 7 }, { t: 'wraith', x: 5, y: 11 },
      { t: 'acolyte', x: 14, y: 9 }, { t: 'acolyte', x: 20, y: 8 },
      { t: 'bat', x: 8, y: 5 }, { t: 'rat', x: 7, y: 13, lv: 4 },
      { t: 'hexwright', x: 19, y: 5, ai: 'wait', drop: { item: 'wardrod', chance: 100 } },
    ],
    intro: function* (b) {
      yield* b.focus(19, 5);
      yield G.talk('hexwright', 'The villagers follow! Rise, my pretties. Let the Ember\'s thieves be buried with its keepers.', { pos: 'top' });
      yield* b.focus(3, 17);
      yield G.talk('mirelle', 'The dead are weak to fire. Keep me alive and I\'ll light them up.');
      yield G.talk('liesl', 'Dark acolytes heal each other. Strike them first if you can!');
    },
    outro: function* () {
      yield G.talk('hexwright', 'You... cannot stop the Ashen Legion... Draxis will wake the Old Flame...', { pos: 'top' });
      yield G.say('The Hexwright crumbles to ash. The mist in the Wraithwood begins to lift.');
    },
  };
  G.battles.b4 = {
    name: 'Fort Bramble', map: MD.b4.rows, music: 'boss', win: 'boss',
    allies: [[11, 20], [12, 20], [10, 20], [13, 20], [11, 21], [12, 21], [10, 21], [13, 21], [9, 21], [14, 21], [9, 20], [14, 20]],
    enemies: [
      { t: 'orc', x: 10, y: 11 }, { t: 'orc', x: 13, y: 11 },
      { t: 'orcarcher', x: 6, y: 9 }, { t: 'orcarcher', x: 17, y: 9 },
      { t: 'wolf', x: 3, y: 13, lv: 6 }, { t: 'wolf', x: 20, y: 15, lv: 6 },
      { t: 'goblinarcher', x: 7, y: 13, lv: 5 }, { t: 'goblinarcher', x: 16, y: 13, lv: 5 },
      { t: 'acolyte', x: 12, y: 6, lv: 6 }, { t: 'acolyte', x: 9, y: 3, lv: 6 },
      { t: 'skeleton', x: 6, y: 4, lv: 6 }, { t: 'skeleton', x: 17, y: 4, lv: 6 },
      { t: 'draxis', x: 12, y: 3, ai: 'wait', boss: true, drop: { item: 'emberblade', chance: 100 } },
    ],
    intro: function* (b) {
      yield* b.focus(12, 3);
      yield G.talk('draxis', 'So these are the heroes of Tallowmere. A smith\'s boy, a cleric, an old soldier and their pets.', { pos: 'top' });
      yield G.talk('draxis', 'The Ember is already on the road to the Ashen Throne. But I will enjoy this. Legion, hold the gate!', { pos: 'top' });
      yield* b.focus(12, 20);
      yield G.talk('garrick', 'The Captain is the key. Bring him down and the rest will break.');
    },
    outro: function* () {
      yield G.talk('draxis', 'Ghh... a smith\'s boy... Laugh while you can. The Ember is already beyond your reach...', { pos: 'top' });
      yield G.say('Captain Draxis falls. The Legion soldiers flee into the hills.');
    },
  };
})();
