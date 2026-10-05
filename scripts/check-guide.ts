/**
 * Guide check (v26, Part C · T-C7; v27 Part D · T-D6: eggs/pity/Den/Stones).
 *
 *   1. No hand-typed numbers: every string / template text in
 *      `src/play/guide-content.ts` is scanned (code inside `${…}` is skipped);
 *      a digit there fails — every number must come from a code constant.
 *   2. The rendered Guide shows the live constants (spot values: stage cuts,
 *      the bust table, the Power ceiling, medal bars, buffs, the pounce cap).
 *   3. Every section exists and has text; every "?" link in the app points at
 *      a real section; the old scattered "How it works" text is gone.
 *   4. The room nameplate: stars AND the word for every grade (never colour
 *      alone), shiny or not.
 *
 * Run: npm run check:guide
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { DEN_MAX_SLOTS, DEN_SLOT_PRICES, DEN_START_SLOTS } from '../src/play/den';
import { DIVECORE_POWERS_PER_DAY, POWER_OVERFLOW_SHELLS, SHELLS_PER_CLEAR } from '../src/play/dive-loot';
import { EXPEDITION_STONE_CHANCE } from '../src/play/expedition-ladder';
import { MEDAL_SCORES } from '../src/play/game-records';
import { GUIDE_SECTIONS, guideSections } from '../src/play/guide-content';
import { PET_BUST_CUT_PP, PET_POUNCE_BASE } from '../src/play/pet';
import {
  COLLECT_TIMELINES,
  DAILY_EGG_BONUS,
  EGGS_PER_DAY_MAX,
  EXTRA_EGG_PRICES,
  FREE_EGGS_PER_DAY,
  GLIMMER_PITY,
  GRADES,
  GRADE_LABEL,
  GRADE_STARS,
  PITY_HARD,
  PITY_SOFT_FROM,
  PRISM_STYLES,
  PRISM_STYLE_COST,
  SHINY_STYLE_LABEL,
  STONE_EVERY_DAYS,
  STONE_ODDS,
  nameplateText,
} from '../src/play/pet-eggs';
import { BUFF_USES, PET_POUNCE_CAP } from '../src/play/play-buffs';
import { DIVE_BUST_TABLE } from '../src/play/playStore';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const ROOT = path.join(__dirname, '..');

/* ---------------------------------------------- 1. no hand-typed numbers --- */

/** The literal text of every string / template in a TS source (code in
 * `${…}` replaced by a space). Comments are skipped. */
function stringTexts(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i += 1;
    } else if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2) + 2;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      let text = '';
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j += 1;
        text += src[j];
        j += 1;
      }
      out.push(text);
      i = j + 1;
    } else if (c === '`') {
      let j = i + 1;
      let text = '';
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') {
          text += src[j + 1];
          j += 2;
          continue;
        }
        if (src[j] === '$' && src[j + 1] === '{') {
          // skip the expression (balanced braces; nested templates are rare here)
          let depth = 1;
          j += 2;
          while (j < n && depth > 0) {
            if (src[j] === '{') depth += 1;
            else if (src[j] === '}') depth -= 1;
            j += 1;
          }
          text += ' ';
          continue;
        }
        text += src[j];
        j += 1;
      }
      out.push(text);
      i = j + 1;
    } else i += 1;
  }
  return out;
}

{
  const src = fs.readFileSync(path.join(ROOT, 'src/play/guide-content.ts'), 'utf8');
  const texts = stringTexts(src);
  // Module paths and padding helpers are code, not prose.
  const prose = texts.filter((t) => !t.startsWith('@/') && t !== '0');
  const bad = prose.filter((t) => /\d/.test(t));
  assert.deepEqual(bad, [], `hand-typed numbers in the Guide: ${JSON.stringify(bad)}`);
  assert.ok(prose.length > 40, 'the scan found the Guide text');
  // And the scanner itself catches one.
  assert.deepEqual(stringTexts('const a = `Lamp costs 60 ${x} shells`; const b = "5 min";').filter((t) => /\d/.test(t)).length, 2);
}
ok('no hand-typed numbers: every number in the Guide comes from a code constant');

/* -------------------------------------------- 2. live constants shown --- */

{
  const all = guideSections();
  const text = (id: string) => all.find((s) => s.id === id)!.lines.join('\n');
  const dive = text('dive');
  for (const st of ['child', 'teen', 'adult', 'god'] as const) assert.ok(dive.includes(`−${PET_BUST_CUT_PP[st]}`), `dive: stage cut ${st}`);
  assert.ok(dive.includes(DIVE_BUST_TABLE.map((x) => `${Math.round(x * 100)}%`).join(', ')), 'dive: the bust table');
  assert.ok(dive.includes(`at most ${DIVECORE_POWERS_PER_DAY} Powers a day`) && dive.includes(`${POWER_OVERFLOW_SHELLS} shells`), 'dive: the Power ceiling');
  assert.ok(dive.includes('Powers today'), 'dive: names the "Powers today" line');
  const games = text('tend');
  assert.ok(games.includes(MEDAL_SCORES.catch.insane.join('/')) && games.includes(MEDAL_SCORES.train.hard.join('/')), 'games: medal bars');
  assert.ok(games.includes('Get Silver on Normal to unlock') && games.includes('Get Gold on Hard to unlock'), 'games: unlock rules');
  const buffs = text('odds');
  assert.ok(buffs.includes('Maxed aura') && buffs.includes(String(PET_POUNCE_CAP)) && buffs.includes(String(BUFF_USES.pumped)), 'buffs: Maxed aura');
  const td = text('defend');
  assert.ok(td.includes(String(PET_POUNCE_BASE.god)) && td.includes('3%') && td.includes('8%'), 'td: pounce + the band');
  assert.ok(td.includes(`at most ${DIVECORE_POWERS_PER_DAY} a day`), 'td: the Power ceiling');
  // v27 (Part D): egg pacing, pity, the Den, Stones, styles, timelines.
  const eggs = text('odds');
  assert.ok(eggs.includes(`first ${FREE_EGGS_PER_DAY} are free`) && eggs.includes(`${EXTRA_EGG_PRICES.join(', ')} shells`), 'eggs: free eggs + prices');
  assert.ok(eggs.includes(`${EGGS_PER_DAY_MAX} at most`) && eggs.includes(`adds ${DAILY_EGG_BONUS} free egg`), 'eggs: the most a day + the daily egg');
  assert.ok(eggs.includes(`From egg ${PITY_SOFT_FROM}`) && eggs.includes(`egg ${PITY_HARD} is always Legendary`), 'eggs: soft + hard pity');
  assert.ok(eggs.includes(`within ${COLLECT_TIMELINES.legendaryCertainDays} days`) && /about (a|two|three|four|five) weeks?/.test(eggs), 'eggs: plain-word timelines');
  const den = text('tend');
  assert.ok(den.includes(`${DEN_START_SLOTS} slots to start`) && den.includes(`${DEN_MAX_SLOTS} at most`), 'den: slots');
  for (const p of DEN_SLOT_PRICES) assert.ok(den.includes(` ${p}`), `den: slot price ${p}`);
  assert.ok(den.includes('frozen') && den.includes('during a dive') && den.includes('expedition') && den.includes('mini-game'), 'den: freeze + swap blocks');
  const stones = text('odds');
  assert.ok(stones.includes(`${Math.round(STONE_ODDS * 100)}% chance`) && stones.includes(`With ${GLIMMER_PITY} glimmers`), 'stones: odds + glimmer pity');
  assert.ok(stones.includes('never sold') && stones.includes('Tide Pass & Shop'), 'stones: Classic is never sold; Prism points at Tide');
  assert.ok(!stones.includes('24%'), 'stones: no random Prism odds');
  const tide = text('shop');
  assert.ok(tide.includes('Tide Pass') && tide.includes('not for sale yet'), 'tide: what it is, and not for sale');
  for (const s of PRISM_STYLES) assert.ok(tide.includes(`${SHINY_STYLE_LABEL[s]} ${PRISM_STYLE_COST[s]}`), `tide: ${s} cost`);
  assert.ok(eggs.includes('Tide Pass & Shop'), 'eggs: one line points at Tide');
  assert.ok(stones.includes(`${Math.round(EXPEDITION_STONE_CHANCE * 100)}%`) && stones.includes(`every ${STONE_EVERY_DAYS}th day`), 'stones: sources');
  assert.ok(stones.includes('Abyss 2%') && stones.includes('Hadal 5%'), 'stones: Abyss/Hadal shares from the loot table');
  assert.ok(text('currencies').includes(`${SHELLS_PER_CLEAR}`), 'currencies: shell pay is still listed');
}
ok('the Guide shows the live constants (stage cuts, bust table, Power ceiling, medals, unlocks, Maxed aura, the TD band, Part D eggs/pity/Den/Stones)');

/* -------------------------------------- 3. sections + "?" + old text gone --- */

{
  const all = guideSections();
  assert.deepEqual(all.map((s) => s.id), [...GUIDE_SECTIONS]);
  assert.equal(GUIDE_SECTIONS.length, 7, 'the Guide index is seven cards');
  for (const s of all) {
    assert.ok(s.lines.length >= 3 && s.lines.every((l) => l.length > 20), `${s.id}: has real text`);
    assert.ok(s.face.length >= 1 && s.face.length <= 2, `${s.id}: face is one or two lines`);
    assert.ok(s.face.every((l) => l.length < 90 && !/\d/.test(l)), `${s.id}: face stays short and has no odds`);
  }
  const files = [
    'pet-screen.tsx',
    'pet-sheets.tsx',
    'dive-screen.tsx',
    'divecore-settings.tsx',
    'divecore-tutorial.tsx',
    'den-sheet.tsx',
    'stone-sheet.tsx',
    'shop-screen.tsx',
  ].map((f) => fs.readFileSync(path.join(ROOT, 'src/play', f), 'utf8'));
  const linked = new Set<string>();
  for (const src of files) {
    for (const m of src.matchAll(/section="([a-z]+)"|openGuide\('([a-z]+)'\)|initial="([a-z]+)"/g)) linked.add(m[1] ?? m[2] ?? m[3]);
  }
  for (const id of linked) assert.ok((GUIDE_SECTIONS as readonly string[]).includes(id), `"?" link to a real section: ${id}`);
  for (const want of ['tend', 'dive', 'shop', 'odds', 'settings']) assert.ok(linked.has(want), `a "?" opens ${want}`);
  // v27: the "?" sits on the Den, the egg picker and the Stone sheet themselves.
  const screen = files[0];
  for (const [sheet, section] of [['den', 'tend'], ['stone', 'odds'], ['eggs', 'odds'], ['prism', 'shop']] as const) {
    assert.ok(new RegExp(`sheet === '${sheet}'[\\s\\S]{0,1200}?section="${section}"`).test(screen), `the ${sheet} sheet has a "?" to ${section}`);
  }
  assert.ok(files[files.length - 1].includes('initial="shop"'), 'the Shop Tide shelf and pass card open the Shop & Dress card');
  const guideUi = fs.readFileSync(path.join(ROOT, 'src/play/guide-sheet.tsx'), 'utf8');
  assert.ok(guideUi.includes('More') && guideUi.includes('card.face') && guideUi.includes('openId === card.id'), 'the face shows first; More opens the tables');
  const all3 = files.join('\n') + fs.readFileSync(path.join(ROOT, 'src/play/pet-egg-sheets.tsx'), 'utf8');
  assert.ok(!/How it works|how it works"|EggHelp/.test(all3), 'the old scattered "How it works" text is gone');
  assert.ok(files[3].includes('Open the Guide') && files[4].includes('Open the Guide'), 'linked from ⚙ Settings and the tutorial');
}
ok('every section has text; every "?" opens a real section; Settings + tutorial link it; the old "How it works" text is gone');

/* --------------------------------------------------------- 4. nameplate --- */

{
  for (const g of GRADES) {
    for (const shiny of [false, true]) {
      const t = nameplateText(g, shiny);
      assert.ok(t.includes('★'.repeat(GRADE_STARS[g])) && t.includes(GRADE_LABEL[g]), `${g}${shiny ? ' shiny' : ''}: stars + word`);
    }
  }
  const room = fs.readFileSync(path.join(ROOT, 'src/play/pet-room.tsx'), 'utf8');
  assert.ok(room.includes('nameplateText(grade, pet.shiny)'), 'the room draws the nameplate text');
  assert.ok(!/bubbleRow[\s\S]{0,400}gradeTag\(grade\)/.test(room), 'the grade is no longer in the bubble row');
  // The plate hangs BELOW the feet (the floor ring ends at feet+6): a plate at
  // feet-4 covered the sprite's feet (Crimson Oni, Child).
  const below = /const PLATE_BELOW_FEET = (\d+);/.exec(room);
  assert.ok(below && Number(below[1]) >= 6, 'PLATE_BELOW_FEET clears the floor ring (feet+6)');
  assert.ok(room.includes('top: footAt * box + PLATE_BELOW_FEET'), 'the plate is positioned below the feet line');
  assert.ok(!room.includes('top: footAt * box - 4'), 'the plate no longer straddles the feet');
}
ok('nameplate: stars AND the word for every grade (never colour alone); the bubble keeps only name + mood');

console.log(`\ncheck:guide — ${passed} groups passed.`);
