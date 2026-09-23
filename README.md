# Embers of Aldmere

An original 16-bit-style tactical RPG. It plays by Shining Force II's battle rules (turn order, land effect, damage, criticals, double attacks and counters, EXP, promotion), with an all-original cast, story, art and music.

## Play
- Open `dist/embers-of-aldmere.html` in any modern browser. It's a single file that works offline.
- Or open `index.html`, which loads the scripts from `src/` (use this when editing).

**Controls:**
- Arrows / WASD: move
- Z / Enter / Space: A (confirm, talk, battle menu)
- X / Esc: B (cancel, undo move)
- C / Shift: menu, or look around the map in battle
- T: auto-battle on/off (your units are controlled by the AI; press again to take back control)
- M: mute

## Chapter 1 contents
- **Tallowmere:** a town with a chapel (raise, cure, promote, save), weapon and item shops, the forge HQ (swap members, depot), and hidden items to find with Search.
- **Aldmere Vale:** the overworld, plus the Woodcutter Camp with a shrine, a shop and a recruit.
- **Four battles:**
  - Tallowmere Fields
  - Mill Bridge
  - The Wraithwood (sub-boss)
  - Fort Bramble (boss)
- **Party:** eight recruitable members, with classes that promote at level 20.

## Project layout
- **Engine:** `src/core.js`, `src/gfx.js`, `src/ui.js`, `src/audio.js`
- **Assets drawn in code:** `src/tiles.js` (tiles and battle backdrops), `src/sprites.js` (map sprites, battle sprites, portraits)
- **Music:** `src/music.js` (MML scores for the built-in FM synth)
- **Game data:** `src/data.js` (classes, characters, items, spells, enemies)
- **Formulas:** `src/rules.js` (explained in `docs/MECHANICS.md`)
- **Battle:** `src/battle.js` (map battle and enemy AI), `src/battlescene.js` (side-view attack scenes)
- **Field:** `src/field.js` (exploration), `src/menus.js` (menus, shops, church, caravan)
- **Story:** `src/maps.js` (map, NPC and battle scripts), `src/story.js` (cutscenes)
- **Map layouts:** `tools/mapgen.py` generates `src/mapdata.js`
- **Build:** `python3 tools/build.py` rebuilds the single-file `dist/` version.
