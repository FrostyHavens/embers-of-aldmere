// ===== Game data: classes, characters, items, spells, enemies (all original) =====
'use strict';
(function () {
  const D = G.data = {};

  // prowess: crit {n: 1-in-n, bonus: 0.25|0.5}, double: 1-in-n, counter: 1-in-n
  // move: foot | mounted | flying | hover ; archer: true gets +25% vs fliers & no airborne-dodge
  D.classes = {
    HERO: { name: 'Hero', move: 'foot', mov: 6, weapons: ['sword'], crit: [32, 0.5], dbl: 32, ctr: 16, promo: 'CHMP' },
    CHMP: { name: 'Champion', move: 'foot', mov: 6, weapons: ['sword'], crit: [16, 0.5], dbl: 16, ctr: 8, promoted: true },
    CAVL: { name: 'Cavalier', move: 'mounted', mov: 7, weapons: ['lance'], crit: [32, 0.25], dbl: 32, ctr: 16, promo: 'PALD' },
    PALD: { name: 'Paladin', move: 'mounted', mov: 7, weapons: ['lance'], crit: [16, 0.25], dbl: 16, ctr: 8, promoted: true },
    CLRC: { name: 'Cleric', move: 'foot', mov: 5, weapons: ['staff'], crit: [32, 0.25], dbl: 32, ctr: 32, promo: 'ORCL', healer: true },
    ORCL: { name: 'Oracle', move: 'foot', mov: 5, weapons: ['staff'], crit: [32, 0.25], dbl: 32, ctr: 32, promoted: true, healer: true },
    ADPT: { name: 'Adept', move: 'foot', mov: 5, weapons: ['staff'], crit: [32, 0.25], dbl: 32, ctr: 32, promo: 'ARCN' },
    ARCN: { name: 'Arcanist', move: 'foot', mov: 5, weapons: ['staff'], crit: [32, 0.25], dbl: 32, ctr: 32, promoted: true },
    ARCH: { name: 'Archer', move: 'foot', mov: 5, weapons: ['bow'], crit: [16, 0.25], dbl: 32, ctr: 32, archer: true, promo: 'MRKS' },
    MRKS: { name: 'Marksman', move: 'foot', mov: 5, weapons: ['bow'], crit: [8, 0.25], dbl: 16, ctr: 32, archer: true, promoted: true },
    AXMN: { name: 'Axeman', move: 'foot', mov: 5, weapons: ['axe'], crit: [16, 0.5], dbl: 32, ctr: 16, promo: 'VNGD' },
    VNGD: { name: 'Vanguard', move: 'foot', mov: 5, weapons: ['axe'], crit: [8, 0.5], dbl: 32, ctr: 8, promoted: true },
    WNDR: { name: 'Windrider', move: 'flying', mov: 7, weapons: ['spear'], crit: [32, 0.25], dbl: 16, ctr: 32, promo: 'TMPS' },
    TMPS: { name: 'Tempest', move: 'flying', mov: 7, weapons: ['spear'], crit: [16, 0.25], dbl: 8, ctr: 16, promoted: true },
    BRWL: { name: 'Brawler', move: 'foot', mov: 5, weapons: ['fist'], crit: [8, 0.25], dbl: 8, ctr: 16, promo: 'GMST' },
    GMST: { name: 'Grandmaster', move: 'foot', mov: 6, weapons: ['fist'], crit: [4, 0.25], dbl: 4, ctr: 8, promoted: true },
  };

  // Growth curves: fraction of (L20 - L1) reached at level L (1..20)
  D.curves = {
    linear: l => (l - 1) / 19,
    early: l => Math.sqrt((l - 1) / 19),
    late: l => Math.pow((l - 1) / 19, 1.6),
    middle: l => { const x = (l - 1) / 19; return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x); },
  };

  // Party members. stats: [L1, L20] for hp, mp, att, def, agi. promoted growth: pgrowth [gain over 20 promoted levels]
  // spells: [[spellId, levelLearned per spell level ...]]
  D.chars = {
    rowan: {
      name: 'Rowan', cls: 'HERO', lv: 1, leader: true,
      stats: { hp: [12, 48], mp: [0, 0], att: [6, 34], def: [5, 28], agi: [6, 30] }, curve: 'linear',
      pgrowth: { hp: 40, mp: 0, att: 30, def: 26, agi: 24 },
      items: ['shortsword', 'mendleaf'], equip: 'shortsword',
      spells: [['recall', 5]],
      map: { body: 'human', skin: '#f4c8a0', hair: '#d86a28', hairStyle: 'spiky', outfit: '#2f6ad0', trim: '#f0d060', cape: '#c02830', head: 'circlet', headColor: '#e8b030', weapon: 'sword', eyes: '#2860b0' },
      portrait: { skin: '#f4c8a0', hair: '#d86a28', hairStyle: 'spiky', eyes: '#2860b0', head: 'circlet', headColor: '#e8b030', outfit: '#2f6ad0', trim: '#f0d060', cape: '#c02830', age: 'young', face: 'soft', body: 'human' },
      bio: 'Apprentice smith of Tallowmere. Steady hands, stubborn heart.'
    },
    liesl: {
      name: 'Liesl', cls: 'CLRC', lv: 1,
      stats: { hp: [10, 36], mp: [9, 42], att: [4, 20], def: [4, 18], agi: [5, 24] }, curve: 'linear',
      pgrowth: { hp: 30, mp: 34, att: 16, def: 16, agi: 20 },
      items: ['oakstaff', 'mendleaf'], equip: 'oakstaff',
      spells: [['mend', 1, 8, 16, 24], ['purify', 4], ['quicken', 10, 22]],
      map: { body: 'human', skin: '#f8d4b4', hair: '#f0e0a0', hairStyle: 'long', outfit: '#f0ecf4', trim: '#4a80d0', robe: true, weapon: 'staff', gem: '#60c0ff', eyes: '#3a70c0' },
      portrait: { skin: '#f8d4b4', hair: '#f0e0a0', hairStyle: 'long', eyes: '#3a70c0', outfit: '#f0ecf4', trim: '#4a80d0', age: 'young', face: 'soft', body: 'human', robe: true, lashes: true },
      bio: 'Acolyte of the Tallowmere chapel. Gentle, and braver than she lets on.'
    },
    garrick: {
      name: 'Garrick', cls: 'CAVL', lv: 1,
      stats: { hp: [14, 52], mp: [0, 0], att: [7, 32], def: [7, 30], agi: [5, 22] }, curve: 'early',
      pgrowth: { hp: 36, mp: 0, att: 26, def: 26, agi: 18 },
      items: ['pike'], equip: 'pike', spells: [],
      map: { body: 'human', mount: 'horse', horse: '#8a5a36', mane: '#2a1a10', skin: '#e8b890', hair: '#3a2a20', hairStyle: 'short', outfit: '#2a8a50', trim: '#e8c040', armor: '#b8c4d4', head: 'helmet', weapon: 'lance', shield: true, eyes: '#306030' },
      portrait: { skin: '#e8b890', hair: '#3a2a20', hairStyle: 'short', eyes: '#306030', head: 'helmet', headColor: '#b8c4d4', outfit: '#2a8a50', trim: '#e8c040', armor: '#b8c4d4', age: 'adult', face: 'sharp', body: 'human', scar: true },
      bio: 'A retired lancer of the border watch who never quite retired.'
    },
    dunmar: {
      name: 'Dunmar', cls: 'AXMN', lv: 2,
      stats: { hp: [15, 54], mp: [0, 0], att: [8, 36], def: [6, 26], agi: [3, 18] }, curve: 'late',
      pgrowth: { hp: 40, mp: 0, att: 30, def: 22, agi: 14 },
      items: ['handaxe'], equip: 'handaxe', spells: [],
      map: { body: 'dwarf', skin: '#e8a880', hair: '#8a3a18', hairStyle: 'bald', beard: '#a8481e', outfit: '#8a5a2a', trim: '#c09040', armor: '#8a94a4', head: 'helmet', weapon: 'axe', eyes: '#4a3020' },
      portrait: { skin: '#e8a880', hair: '#8a3a18', hairStyle: 'bald', beard: '#a8481e', eyes: '#4a3020', head: 'helmet', headColor: '#8a94a4', outfit: '#8a5a2a', trim: '#c09040', armor: '#8a94a4', age: 'adult', face: 'round', body: 'dwarf' },
      bio: 'Rowan\'s master at the forge. Speaks rarely; swings hard.'
    },
    pip: {
      name: 'Pip', cls: 'ARCH', lv: 1,
      stats: { hp: [10, 38], mp: [0, 0], att: [6, 30], def: [4, 20], agi: [7, 32] }, curve: 'middle',
      pgrowth: { hp: 30, mp: 0, att: 26, def: 18, agi: 24 },
      items: ['shortbow', 'mendleaf'], equip: 'shortbow', spells: [],
      map: { body: 'halfling', skin: '#f0c8a0', hair: '#b87830', hairStyle: 'curly', outfit: '#4a8a38', trim: '#b08040', weapon: 'bow', eyes: '#407020' },
      portrait: { skin: '#f0c8a0', hair: '#b87830', hairStyle: 'curly', eyes: '#407020', outfit: '#4a8a38', trim: '#b08040', age: 'young', face: 'round', body: 'halfling' },
      bio: 'A halfling poacher. Claims the rabbits started it.'
    },
    mirelle: {
      name: 'Mirelle', cls: 'ADPT', lv: 1,
      stats: { hp: [9, 32], mp: [10, 46], att: [4, 18], def: [3, 16], agi: [6, 26] }, curve: 'linear',
      pgrowth: { hp: 26, mp: 40, att: 14, def: 14, agi: 20 },
      items: ['oakstaff'], equip: 'oakstaff',
      spells: [['kindle', 1, 7, 15, 25], ['rime', 12, 20], ['sap', 5]],
      map: { body: 'elf', skin: '#f2c8a8', hair: '#b0203a', hairStyle: 'ponytail', outfit: '#c03020', trim: '#f0a030', robe: true, head: 'wizardhat', headColor: '#6a2080', weapon: 'rod', gem: '#ff6020', glow: '#ff8030', eyes: '#c04020' },
      portrait: { skin: '#f2c8a8', hair: '#b0203a', hairStyle: 'ponytail', eyes: '#c04020', head: 'wizardhat', headColor: '#6a2080', outfit: '#c03020', trim: '#f0a030', age: 'young', face: 'sharp', body: 'elf', robe: true },
      bio: 'An elven student of flame who left her academy under a cloud of smoke.'
    },
    kestrel: {
      name: 'Kestrel', cls: 'WNDR', lv: 4,
      stats: { hp: [11, 40], mp: [0, 0], att: [6, 30], def: [5, 22], agi: [8, 34] }, curve: 'linear',
      pgrowth: { hp: 32, mp: 0, att: 26, def: 20, agi: 26 },
      items: ['javelin'], equip: 'javelin', spells: [],
      map: { body: 'birdfolk', wings: true, skin: '#e0b890', hair: '#8a5a30', wingColor: '#9a6a3a', outfit: '#3a7ab0', trim: '#f0f0e0', weapon: 'spear', eyes: '#f0a000' },
      portrait: { skin: '#e0b890', hair: '#8a5a30', hairStyle: 'spiky', eyes: '#f0a000', outfit: '#3a7ab0', trim: '#f0f0e0', age: 'young', face: 'sharp', body: 'birdfolk' },
      bio: 'A hawk-feathered courier from the cliffs of Aerie. Fast, proud, a little reckless.'
    },
    jun: {
      name: 'Jun', cls: 'BRWL', lv: 5,
      stats: { hp: [13, 46], mp: [0, 0], att: [7, 32], def: [6, 24], agi: [7, 30] }, curve: 'early',
      pgrowth: { hp: 36, mp: 0, att: 28, def: 22, agi: 24 },
      items: ['wraps', 'mendleaf'], equip: 'wraps', spells: [],
      map: { body: 'human', skin: '#c88a60', hair: '#202020', hairStyle: 'braid', outfit: '#e0a030', trim: '#a02828', head: 'bandana', headColor: '#c02828', weapon: 'fists', eyes: '#3a2a20' },
      portrait: { skin: '#c88a60', hair: '#202020', hairStyle: 'braid', eyes: '#3a2a20', head: 'bandana', headColor: '#c02828', outfit: '#e0a030', trim: '#a02828', age: 'young', face: 'sharp', body: 'human' },
      bio: 'A wandering pilgrim of the Open Hand. Fights barefoot, eats anything.'
    },
  };
  D.partyOrder = ['rowan', 'liesl', 'garrick', 'dunmar', 'pip', 'mirelle', 'kestrel', 'jun'];

  // ---------- Items ----------
  // type: weapon (wtype, att, range [min,max]) | ring (bonus) | use (effect)
  D.items = {
    // swords
    shortsword: { name: 'Short Sword', type: 'weapon', wtype: 'sword', att: 5, range: [1, 1], price: 80, desc: 'A plain, honest blade.' },
    broadsword: { name: 'Broadsword', type: 'weapon', wtype: 'sword', att: 9, range: [1, 1], price: 260, desc: 'Heavy and dependable.' },
    emberblade: { name: 'Ember Blade', type: 'weapon', wtype: 'sword', att: 14, range: [1, 1], price: 900, desc: 'Warm to the touch. May cast Kindle when used.', useSpell: ['kindle', 1] },
    // lances
    pike: { name: 'Pike', type: 'weapon', wtype: 'lance', att: 6, range: [1, 1], price: 100, desc: 'A long ash-wood pike.' },
    lance: { name: 'Steel Lance', type: 'weapon', wtype: 'lance', att: 10, range: [1, 1], price: 320, desc: 'A cavalry lance of good steel.' },
    // spears (fliers) - throwable
    javelin: { name: 'Javelin', type: 'weapon', wtype: 'spear', att: 5, range: [1, 2], price: 120, desc: 'Can strike from two squares away.' },
    wingspear: { name: 'Wing Spear', type: 'weapon', wtype: 'spear', att: 9, range: [1, 2], price: 420, desc: 'Light enough to throw on the wing.' },
    // bows
    shortbow: { name: 'Short Bow', type: 'weapon', wtype: 'bow', att: 4, range: [2, 3], price: 110, desc: 'Range 2-3. Cannot hit adjacent foes.' },
    longbow: { name: 'Long Bow', type: 'weapon', wtype: 'bow', att: 8, range: [2, 3], price: 380, desc: 'A yew longbow. Range 2-3.' },
    // axes
    handaxe: { name: 'Hand Axe', type: 'weapon', wtype: 'axe', att: 7, range: [1, 1], price: 120, desc: 'Good for wood and worse things.' },
    waraxe: { name: 'War Axe', type: 'weapon', wtype: 'axe', att: 11, range: [1, 1], price: 400, desc: 'A dwarven double-bit axe.' },
    // staffs
    oakstaff: { name: 'Oak Staff', type: 'weapon', wtype: 'staff', att: 2, range: [1, 1], price: 50, desc: 'A walking staff of stout oak.' },
    wardrod: { name: 'Ward Rod', type: 'weapon', wtype: 'staff', att: 5, range: [1, 1], price: 280, desc: 'Etched with warding runes.' },
    // fists
    wraps: { name: 'Hand Wraps', type: 'weapon', wtype: 'fist', att: 4, range: [1, 1], price: 60, desc: 'Linen wraps for a pilgrim\'s fists.' },
    ironknuckle: { name: 'Iron Knuckles', type: 'weapon', wtype: 'fist', att: 8, range: [1, 1], price: 300, desc: 'Leaves an impression.' },
    // rings
    swiftband: { name: 'Swift Band', type: 'ring', bonus: { agi: 5 }, price: 600, desc: 'AGI +5 while equipped.' },
    wardband: { name: 'Ward Band', type: 'ring', bonus: { def: 5 }, price: 600, desc: 'DEF +5 while equipped.' },
    mightband: { name: 'Might Band', type: 'ring', bonus: { att: 5 }, price: 800, desc: 'ATT +5 while equipped.' },
    // consumables
    mendleaf: { name: 'Mendleaf', type: 'use', effect: 'heal', power: 10, range: 1, price: 10, desc: 'Restores 10 HP.' },
    tonic: { name: 'Vital Tonic', type: 'use', effect: 'heal', power: 20, range: 1, price: 40, desc: 'Restores 20 HP.' },
    manadew: { name: 'Mana Dew', type: 'use', effect: 'mp', power: 10, range: 1, price: 150, desc: 'Restores 10 MP.' },
    purgebloom: { name: 'Purgebloom', type: 'use', effect: 'cure', range: 1, price: 20, desc: 'Cures poison.' },
    feather: { name: 'Recall Feather', type: 'use', effect: 'recall', range: 0, price: 40, desc: 'Return to the last church visited.', field: true },
    mightelixir: { name: 'Might Elixir', type: 'use', effect: 'stat', stat: 'att', power: 3, range: 0, price: 0, desc: 'Permanently raises ATT.' },
    guardelixir: { name: 'Guard Elixir', type: 'use', effect: 'stat', stat: 'def', power: 3, range: 0, price: 0, desc: 'Permanently raises DEF.' },
    vigorelixir: { name: 'Vigor Elixir', type: 'use', effect: 'stat', stat: 'hp', power: 4, range: 0, price: 0, desc: 'Permanently raises max HP.' },
    emberstone: { name: 'Ember Shard', type: 'key', price: 0, desc: 'A sliver of the chapel\'s sacred ember. It never cools.' },
  };

  // ---------- Spells ----------
  // levels: [{mp, range:[min,max], area: radius (0 = single), power}]
  D.spells = {
    mend: { name: 'Mend', kind: 'heal', target: 'ally', sfx: 'heal', levels: [
      { mp: 3, range: [0, 1], area: 0, power: 15 }, { mp: 5, range: [0, 2], area: 0, power: 15 },
      { mp: 10, range: [0, 3], area: 1, power: 15 }, { mp: 20, range: [0, 3], area: 0, power: 999 }] },
    purify: { name: 'Purify', kind: 'cure', target: 'ally', sfx: 'heal', levels: [{ mp: 3, range: [0, 1], area: 0 }] },
    quicken: { name: 'Quicken', kind: 'buff', target: 'ally', sfx: 'buff', levels: [
      { mp: 5, range: [0, 2], area: 0, power: 5 }, { mp: 10, range: [0, 2], area: 1, power: 5 }] },
    recall: { name: 'Recall', kind: 'recall', target: 'self', sfx: 'warp', levels: [{ mp: 8, range: [0, 0], area: 0 }], field: true },
    kindle: { name: 'Kindle', kind: 'damage', elem: 'fire', target: 'enemy', sfx: 'fire', levels: [
      { mp: 2, range: [1, 2], area: 0, power: 6 }, { mp: 5, range: [1, 2], area: 1, power: 8 },
      { mp: 8, range: [1, 2], area: 1, power: 12 }, { mp: 10, range: [1, 3], area: 0, power: 26 }] },
    rime: { name: 'Rime', kind: 'damage', elem: 'ice', target: 'enemy', sfx: 'ice', levels: [
      { mp: 3, range: [1, 2], area: 0, power: 10 }, { mp: 7, range: [1, 2], area: 1, power: 12 }] },
    sap: { name: 'Sap', kind: 'debuff', target: 'enemy', sfx: 'debuff', levels: [{ mp: 5, range: [1, 2], area: 1, power: 5 }] },
    // enemy-only
    shadowbolt: { name: 'Shade Bolt', kind: 'damage', elem: 'dark', target: 'enemy', sfx: 'bolt', levels: [
      { mp: 3, range: [1, 2], area: 0, power: 8 }, { mp: 6, range: [1, 2], area: 1, power: 9 }] },
    darkmend: { name: 'Dark Mend', kind: 'heal', target: 'ally', sfx: 'heal', levels: [{ mp: 3, range: [0, 1], area: 0, power: 12 }] },
    venom: { name: 'Venom Cloud', kind: 'poison', target: 'enemy', sfx: 'debuff', levels: [{ mp: 4, range: [1, 2], area: 1 }] },
  };

  // ---------- Enemies ----------
  // move: foot|mounted|flying|hover ; weapon: map-sprite weapon ; range [min,max]; resist {fire:'minor'|'major'|'weak', ...}
  // ai: 'aggressive' | 'wait' (holds until an ally comes within reach) | 'guard' (never moves) | 'healer' | 'caster'
  // prowess: crit[n,bonus], dbl, ctr ; crit ailment: poison (for rat)
  D.enemies = {
    goblin: { name: 'Goblin', lv: 1, hp: 9, mp: 0, att: 8, def: 4, agi: 5, mov: 5, move: 'foot', range: [1, 1], exp: 0, gold: 10,
      crit: [32, 0.25], dbl: 32, ctr: 32, battleBG: null,
      map: { body: 'goblin', outfit: '#7a5a3a', trim: '#5a4030', hair: '#2a2a20', hairStyle: 'spiky', weapon: 'dagger', eyes: '#f0e020' },
      portrait: { body: 'goblin', skin: '#78a040', hair: '#2a2a20', hairStyle: 'spiky', eyes: '#f0e020', outfit: '#7a5a3a', trim: '#5a4030', age: 'adult', face: 'sharp' } },
    goblinarcher: { name: 'Goblin Archer', lv: 2, hp: 9, mp: 0, att: 9, def: 3, agi: 6, mov: 4, move: 'foot', range: [2, 3], gold: 14, archer: true,
      crit: [16, 0.25], dbl: 32, ctr: 32,
      map: { body: 'goblin', skin: '#90a848', outfit: '#4a5a30', trim: '#6a4020', head: 'hood', headColor: '#5a6a38', weapon: 'bow', eyes: '#ff8020' } },
    rat: { name: 'Giant Rat', lv: 1, hp: 8, mp: 0, att: 7, def: 3, agi: 7, mov: 6, move: 'foot', range: [1, 1], gold: 6,
      crit: [16, 0.25], critPoison: true, dbl: 16, ctr: 32,
      map: { body: 'rat', outfit: '#7a6a60' } },
    bat: { name: 'Cave Bat', lv: 3, hp: 10, mp: 0, att: 10, def: 4, agi: 9, mov: 6, move: 'flying', range: [1, 1], gold: 12,
      crit: [32, 0.25], dbl: 16, ctr: 32,
      map: { body: 'bat', outfit: '#4a3060', wings: true } },
    wolf: { name: 'Dire Wolf', lv: 4, hp: 14, mp: 0, att: 12, def: 5, agi: 10, mov: 7, move: 'mounted', range: [1, 1], gold: 16,
      crit: [16, 0.5], dbl: 16, ctr: 16,
      map: { body: 'wolf', outfit: '#6a6878', trim: '#c8c4cc', eyes: '#f0c020' } },
    slime: { name: 'Bog Slime', lv: 4, hp: 16, mp: 0, att: 11, def: 9, agi: 3, mov: 4, move: 'foot', range: [1, 1], gold: 14,
      crit: [16, 0.25], critPoison: true, dbl: 32, ctr: 32, resist: { fire: 'weak', ice: 'major' },
      map: { body: 'slime', outfit: '#38b858' } },
    skeleton: { name: 'Skeleton', lv: 5, hp: 17, mp: 0, att: 14, def: 8, agi: 6, mov: 5, move: 'foot', range: [1, 1], gold: 22,
      crit: [32, 0.5], dbl: 32, ctr: 8, resist: { fire: 'weak', dark: 'major' },
      map: { body: 'skeleton', weapon: 'sword', shield: true, trim: '#6a2a2a', shieldColor: '#5a3030', eyes: '#ff3020' } },
    wraith: { name: 'Wraith', lv: 6, hp: 16, mp: 10, att: 13, def: 6, agi: 9, mov: 5, move: 'hover', range: [1, 1], gold: 30,
      crit: [32, 0.25], dbl: 32, ctr: 32, resist: { dark: 'major', ice: 'minor', fire: 'weak' }, spells: [['shadowbolt', 1]], ai: 'caster',
      map: { body: 'wraith', outfit: '#3a3050', trim: '#8870c0', eyes: '#60ffd0' } },
    acolyte: { name: 'Dark Acolyte', lv: 5, hp: 14, mp: 18, att: 9, def: 6, agi: 7, mov: 5, move: 'foot', range: [1, 1], gold: 26,
      crit: [32, 0.25], dbl: 32, ctr: 32, spells: [['darkmend', 1], ['shadowbolt', 1]], ai: 'healer',
      map: { body: 'human', skin: '#c8b0a8', hair: '#302030', outfit: '#2a1a3a', trim: '#a02850', robe: true, head: 'hood', headColor: '#3a2050', weapon: 'staff', gem: '#c040ff', glow: '#c060ff', eyes: '#ff40a0', glowEyes: true },
      portrait: { body: 'human', skin: '#c8b0a8', hair: '#302030', hairStyle: 'long', eyes: '#ff40a0', head: 'hood', headColor: '#3a2050', outfit: '#2a1a3a', trim: '#a02850', age: 'adult', face: 'sharp' } },
    orc: { name: 'Orc Brute', lv: 6, hp: 22, mp: 0, att: 16, def: 9, agi: 5, mov: 5, move: 'foot', range: [1, 1], gold: 34,
      crit: [16, 0.5], dbl: 32, ctr: 16,
      map: { body: 'orc', hair: '#1a1a1a', hairStyle: 'ponytail', outfit: '#6a4a3a', trim: '#a08050', weapon: 'axe', eyes: '#e03020' },
      portrait: { body: 'orc', skin: '#7a8a5a', hair: '#1a1a1a', hairStyle: 'ponytail', eyes: '#e03020', outfit: '#6a4a3a', trim: '#a08050', age: 'adult', face: 'round' } },
    orcarcher: { name: 'Orc Raider', lv: 6, hp: 18, mp: 0, att: 15, def: 7, agi: 7, mov: 5, move: 'foot', range: [2, 3], gold: 30, archer: true,
      crit: [16, 0.25], dbl: 32, ctr: 32,
      map: { body: 'orc', hair: '#2a1a10', hairStyle: 'short', outfit: '#5a5a3a', trim: '#806040', head: 'bandana', headColor: '#802020', weapon: 'bow', eyes: '#e03020' } },
    hexwright: { name: 'Hexwright Sorn', lv: 7, hp: 30, mp: 30, att: 12, def: 8, agi: 9, mov: 5, move: 'foot', range: [1, 1], gold: 120, boss: true,
      crit: [32, 0.25], dbl: 32, ctr: 32, spells: [['shadowbolt', 2], ['venom', 1], ['darkmend', 1]], ai: 'caster',
      map: { body: 'human', skin: '#b8a8a0', hair: '#e0e0e0', hairStyle: 'long', outfit: '#1a3a3a', trim: '#40c0a0', robe: true, head: 'hood', headColor: '#103030', weapon: 'rod', gem: '#40ffc0', glow: '#40ffc0', eyes: '#40ffc0', glowEyes: true, beard: '#e0e0e0' },
      portrait: { body: 'human', skin: '#b8a8a0', hair: '#e0e0e0', hairStyle: 'long', eyes: '#40ffc0', head: 'hood', headColor: '#103030', outfit: '#1a3a3a', trim: '#40c0a0', beard: '#e0e0e0', age: 'old', face: 'sharp' } },
    draxis: { name: 'Capt. Draxis', lv: 9, hp: 46, mp: 0, att: 22, def: 13, agi: 11, mov: 5, move: 'foot', range: [1, 1], gold: 300, boss: true,
      crit: [8, 0.5], dbl: 16, ctr: 8, ai: 'wait',
      map: { body: 'human', skin: '#d8a888', hair: '#1a1a1a', outfit: '#4a1a2a', trim: '#c8a040', armor: '#4a4a5a', cape: '#8a1020', head: 'horned', headColor: '#3a3a48', weapon: 'sword', eyes: '#ff3030', scale: 1.2 },
      portrait: { body: 'human', skin: '#d8a888', hair: '#1a1a1a', hairStyle: 'short', eyes: '#ff3030', head: 'horned', headColor: '#3a3a48', outfit: '#4a1a2a', trim: '#c8a040', armor: '#4a4a5a', cape: '#8a1020', age: 'adult', face: 'sharp', scar: true, fierce: true } },
  };

  // NPC portrait presets (for dialogue)
  D.npcs = {
    elder: { name: 'Elder Hobb', portrait: { skin: '#f0c8a8', hair: '#e8e8e8', hairStyle: 'bald', beard: '#f0f0f0', eyes: '#506080', outfit: '#6050a0', trim: '#e0c040', age: 'old', face: 'round', body: 'human' },
      map: { body: 'human', skin: '#f0c8a8', hair: '#e8e8e8', hairStyle: 'bald', beard: '#f0f0f0', outfit: '#6050a0', trim: '#e0c040', robe: true, weapon: 'staff', eyes: '#506080' } },
    priest: { name: 'Father Anselm', portrait: { skin: '#e8c0a0', hair: '#806040', hairStyle: 'short', eyes: '#405060', outfit: '#f0f0f0', trim: '#c09020', age: 'adult', face: 'round', body: 'human', robe: true },
      map: { body: 'human', skin: '#e8c0a0', hair: '#806040', hairStyle: 'short', outfit: '#f0f0f0', trim: '#c09020', robe: true, eyes: '#405060' } },
    smith: { name: 'Shopkeep', portrait: { skin: '#d8a078', hair: '#402010', hairStyle: 'short', beard: '#402010', eyes: '#302010', outfit: '#805030', trim: '#c0a060', age: 'adult', face: 'round', body: 'human' },
      map: { body: 'human', skin: '#d8a078', hair: '#402010', hairStyle: 'short', beard: '#402010', outfit: '#805030', trim: '#c0a060', eyes: '#302010' } },
    grocer: { name: 'Grocer', portrait: { skin: '#f0c8a0', hair: '#c05030', hairStyle: 'ponytail', eyes: '#305020', outfit: '#40a060', trim: '#f0e0a0', age: 'adult', face: 'soft', body: 'human', lashes: true },
      map: { body: 'human', skin: '#f0c8a0', hair: '#c05030', hairStyle: 'ponytail', outfit: '#40a060', trim: '#f0e0a0', eyes: '#305020' } },
    villagerM: { name: 'Villager', portrait: { skin: '#e8b890', hair: '#604020', hairStyle: 'short', eyes: '#403020', outfit: '#a07040', trim: '#604020', age: 'adult', face: 'round', body: 'human' },
      map: { body: 'human', skin: '#e8b890', hair: '#604020', hairStyle: 'short', outfit: '#a07040', trim: '#604020', eyes: '#403020' } },
    villagerF: { name: 'Villager', portrait: { skin: '#f8d0b0', hair: '#302020', hairStyle: 'braid', eyes: '#402030', outfit: '#c05070', trim: '#f0d0e0', age: 'young', face: 'soft', body: 'human', lashes: true },
      map: { body: 'human', skin: '#f8d0b0', hair: '#302020', hairStyle: 'braid', outfit: '#c05070', trim: '#f0d0e0', robe: true, eyes: '#402030' } },
    child: { name: 'Child', portrait: { skin: '#f8d0b0', hair: '#e0a040', hairStyle: 'curly', eyes: '#305080', outfit: '#50a0e0', trim: '#f0f0f0', age: 'young', face: 'round', body: 'halfling' },
      map: { body: 'halfling', skin: '#f8d0b0', hair: '#e0a040', hairStyle: 'curly', outfit: '#50a0e0', trim: '#f0f0f0', eyes: '#305080' } },
    oldwoman: { name: 'Granny Wren', portrait: { skin: '#e8c0a0', hair: '#c8c8d0', hairStyle: 'braid', eyes: '#504060', outfit: '#705080', trim: '#d0b0e0', age: 'old', face: 'soft', body: 'human' },
      map: { body: 'human', skin: '#e8c0a0', hair: '#c8c8d0', hairStyle: 'braid', outfit: '#705080', trim: '#d0b0e0', robe: true, eyes: '#504060' } },
    guard: { name: 'Watchman', portrait: { skin: '#e0b088', hair: '#503020', hairStyle: 'short', eyes: '#304050', head: 'helmet', headColor: '#a0a8b8', outfit: '#406090', trim: '#c0a040', armor: '#a0a8b8', age: 'adult', face: 'sharp', body: 'human' },
      map: { body: 'human', skin: '#e0b088', hair: '#503020', hairStyle: 'short', outfit: '#406090', trim: '#c0a040', armor: '#a0a8b8', head: 'helmet', headColor: '#a0a8b8', weapon: 'spear', eyes: '#304050' } },
    woodcutter: { name: 'Woodcutter Ebb', portrait: { skin: '#d8a078', hair: '#806030', hairStyle: 'short', beard: '#806030', eyes: '#403020', outfit: '#a03030', trim: '#402010', age: 'adult', face: 'round', body: 'human' },
      map: { body: 'human', skin: '#d8a078', hair: '#806030', hairStyle: 'short', beard: '#806030', outfit: '#a03030', trim: '#402010', weapon: 'axe', eyes: '#403020' } },
    hermit: { name: 'Hermit', portrait: { skin: '#e0b898', hair: '#909090', hairStyle: 'long', beard: '#a0a0a0', eyes: '#305030', outfit: '#607040', trim: '#a0a060', age: 'old', face: 'sharp', body: 'human' },
      map: { body: 'human', skin: '#e0b898', hair: '#909090', hairStyle: 'long', beard: '#a0a0a0', outfit: '#607040', trim: '#a0a060', robe: true, weapon: 'staff', eyes: '#305030' } },
  };
})();
