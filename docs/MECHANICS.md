# Battle & Progression Rules (modeled on Shining Force II's systems)

All names, characters, story, art and music in this project are original.
Only the *rules* below follow SF2's design, restated in plain language.

## Turn order (per round)
- Each living unit rolls: v = AGI + r(AGI/8) - r(AGI/8) + (r(3) - 1), where r(n) = random int 0..n-1.
- Units with AGI >= 128 get a second entry rolled from 5/6 of AGI.
- Sort descending; units act in that order, allies and enemies interleaved.

## Physical attack
1. Dodge check: base 1/32. If the attacker is confused: 1/2. If the target flies/hovers and the attacker is not an archer: 1/8. A sleeping or stunned target never dodges.
2. Base damage = ATT - DEF (min 1).
3. Land effect: 15% tile -> x230/256, 30% tile -> x205/256.
4. Archer vs flying/hovering target: +25%.
5. Critical: per-class chance (1/32, 1/16, 1/8, 1/4) with +25% or +50% damage.
6. Counterattacks deal 1/2 damage.
7. Variance: subtract r(dmg/8+1) twice. Min 1.
8. After the attack (hit or dodge): double-attack roll (attacker's class chance), then counter roll (target's class chance; needs the attacker in the target's weapon range).

## Spells
- Fixed power per spell level. Promoted caster: x5/4.
- Resistance: minor -25%, major -50%, weakness +25%.
- Same variance as attacks; land effect does not apply.

## EXP
- Effective level = level (+20 if promoted). Diff = actor's effective level - target's.
- Kill EXP: diff < 3 -> 50, 3 -> 40, 4 -> 30, 5 -> 20, 6 -> 10, >= 7 -> 0.
- Damage EXP = killExp x damage / targetMaxHP. Total per action capped at 49.
- Healing (healer classes only): 25 x healed / maxHP, min 10, cap 25.
- Status spells: 5 per target.
- Final: +1 (1/16), -1 (1/16), minimum 1. 100 EXP = level up (EXP resets).

## Leveling / promotion
- Stats grow toward a per-character projected curve (linear / early / late / middle) with random variance.
- Promotion at the church from level 20. Level resets to 1, stats are kept, and the class changes.
- Spells are learned at set levels.

## Land effect & movement
- Terrain gives a land effect of 0/15/30% and a per-movetype movement cost.
- Movement points = MOV. Blocked tiles, enemy-occupied tiles and zones are impassable.

## Defeat / retreat
- If the leader falls, the battle is lost: return to the last church with gold halved. EXP and levels are kept.
- Recall (the Egress spell equivalent) or a Recall Feather retreats the same way, but gold is kept.
- Fallen members must be revived at the church for a fee.
