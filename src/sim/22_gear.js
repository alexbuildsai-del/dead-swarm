'use strict';
/* ==========================================================================
   sim/22_gear.js — gear definitions (DESIGN §6). Data only: the stat effects
   are applied by the core in Player.recalc (sim/11_player.js); these texts
   mirror those formulas exactly. levelText[i] describes reaching level i+1.
   ========================================================================== */
(function () {
  const G = (id, name, desc, levelText) => { DS.GEAR[id] = { id, name, desc, levelText }; };
  G('hollowpoints', 'Hollow Points', 'Soft-nosed rounds: every weapon hits harder.',
    ['Damage +10%', 'Damage +10% (total +20%)', 'Damage +10% (total +30%)', 'Damage +10% (total +40%)', 'Damage +10% (total +50%)']);
  G('adrenaline', 'Adrenaline', 'A jittery shot in the arm: every weapon cycles faster.',
    ['Cooldowns −8%', 'Cooldowns −8% (total −16%)', 'Cooldowns −8% (total −24%)', 'Cooldowns −8% (total −32%)', 'Cooldowns −8% (total −40%)']);
  G('blastradius', 'Blast Radius', 'Extra powder and longer reach: every area grows.',
    ['Area +10%', 'Area +10% (total +20%)', 'Area +10% (total +30%)', 'Area +10% (total +40%)', 'Area +10% (total +50%)']);
  G('ducttape', 'Duct Tape', 'Holds it all together: effects last longer.',
    ['Duration +12%', 'Duration +12% (total +24%)', 'Duration +12% (total +36%)', 'Duration +12% (total +48%)', 'Duration +12% (total +60%)']);
  G('extmag', 'Extended Mag', 'Bigger magazines: weapons fire extra projectiles.',
    ['+1 projectile for every weapon', 'Sturdier mag (next level: +1 projectile)', '+1 projectile (total +2)', 'Sturdier mag (next level: +1 projectile)', '+1 projectile (total +3)']);
  G('firstaid', 'First Aid Kit', 'Bandages and grit: more max HP, and a quick patch-up.',
    ['Max HP +20, heal 20', 'Max HP +20 (total +40), heal 20', 'Max HP +20 (total +60), heal 20', 'Max HP +20 (total +80), heal 20', 'Max HP +20 (total +100), heal 20']);
  G('kevlar', 'Kevlar Vest', 'Stops a bite or two: flat damage reduction on every hit.',
    ['Armor +1', 'Armor +1 (total +2)', 'Armor +1 (total +3)', 'Armor +1 (total +4)', 'Armor +1 (total +5)']);
  G('scavbag', "Scavenger's Bag", 'Deep pockets: grab pickups from further away.',
    ['Pickup radius +25%', 'Pickup radius +25% (total +50%)', 'Pickup radius +25% (total +75%)', 'Pickup radius +25% (total +100%)', 'Pickup radius +25% (total +125%)']);
  G('rabbitfoot', "Rabbit's Foot", 'Someone else\'s bad luck: more luck and more crits.',
    ['Luck +10%, crit chance +3%', 'Luck +10%, crit +3% (total +20% / +6%)', 'Luck +10%, crit +3% (total +30% / +9%)', 'Luck +10%, crit +3% (total +40% / +12%)', 'Luck +10%, crit +3% (total +50% / +15%)']);
  G('shoes', 'Running Shoes', 'Fresh soles: you move faster.',
    ['Move speed +8%', 'Move speed +8% (total +16%)', 'Move speed +8% (total +24%)', 'Move speed +8% (total +32%)', 'Move speed +8% (total +40%)']);
  G('guide', 'Survival Guide', 'Dog-eared tips from the zine: learn faster from every kill.',
    ['XP gained +10%', 'XP gained +10% (total +20%)', 'XP gained +10% (total +30%)', 'XP gained +10% (total +40%)', 'XP gained +10% (total +50%)']);
  G('medic', 'Field Medic', 'Patch up between kills: each kill heals 1 HP, up to a rate cap.',
    ['Kills heal 1 HP (max 0.6 HP/s)', 'Heal cap +0.6 (max 1.2 HP/s)', 'Heal cap +0.6 (max 1.8 HP/s)', 'Heal cap +0.6 (max 2.4 HP/s)', 'Heal cap +0.6 (max 3 HP/s)']);
})();
