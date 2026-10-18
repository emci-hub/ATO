/**
 * One pet status badge everywhere (pet team roadmap P2, emci 2026-10-18).
 * Run: npm run check:pet-status-badge
 *
 * - `petStatusView` is the single source: stars = the hero's copies (0–5), always 5 glyphs, grade word + colour,
 *   shiny mark, a spoken label; no grade (egg / baby) = no badge.
 * - The 3★ dye rule is untouched (DYE_STARS = 3, dyeApplies).
 * - Wired: the Den tile + card, and the Hideout name tag (StreetStatusStrip, fed by both PetRoom and the
 *   Pet screen) draw `PetStatusBadge`; no screen builds its own star row from GRADE_STARS any more.
 * - Fixed regions: the strip keeps its one 36 px row, the badge never wraps, the Den tile reserves its line.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DYE_STARS, GRADE_COLOR, GRADES, STAR_MAX, dyeApplies } from '../src/play/pet-eggs';
import { petStatusView } from '../src/play/pet-status-view';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');

{
  assert.equal(petStatusView({ grade: null, copies: 3, shiny: true }), null, 'no grade, no badge');
  for (const copies of [0, 1, 2, 3, 4, 5, 9, -2, 2.9]) {
    const s = petStatusView({ grade: 'epic', copies, shiny: false });
    assert.ok(s);
    assert.equal([...s.starText].length, STAR_MAX, `${copies} copies: always ${STAR_MAX} glyphs`);
    assert.equal([...s.starText].filter((c) => c === '★').length, s.stars);
    assert.ok(s.stars >= 0 && s.stars <= STAR_MAX);
  }
  assert.equal(petStatusView({ grade: 'rare', copies: 3, shiny: false })?.starText, '★★★☆☆');
  assert.equal(petStatusView({ grade: 'rare', copies: 9, shiny: false })?.stars, STAR_MAX, 'capped at 5');
  ok('petStatusView: stars from copies, capped, always five glyphs, null without a grade');
}

{
  for (const g of GRADES) {
    const s = petStatusView({ grade: g, copies: 2, shiny: false });
    assert.ok(s);
    assert.equal(s.color, GRADE_COLOR[g]);
    assert.ok(s.gradeLabel.length > 0 && s.label.startsWith(s.gradeLabel), 'the word rides with the colour');
    assert.ok(!s.label.includes('shiny'));
  }
  const shiny = petStatusView({ grade: 'legendary', copies: 5, shiny: true });
  assert.equal(shiny?.shiny, true);
  assert.equal(shiny?.label, 'Legendary, 5 of 5 stars, shiny');
  ok('grade colour + word, shiny mark, spoken label');
}

{
  assert.equal(DYE_STARS, 3);
  assert.equal(dyeApplies(2, true, false), false);
  assert.equal(dyeApplies(3, true, false), true);
  assert.equal(dyeApplies(5, true, true), false, 'never on a shiny');
  ok('3★ dye rule kept');
}

{
  const badge = read('src/play/pet-status-badge.tsx');
  assert.match(badge, /import type \{ PetStatusView \} from '@\/play\/pet-status-view'/, 'the badge draws a PetStatusView');
  assert.doesNotMatch(badge, /GRADE_STARS/, 'no second star source');
  assert.match(badge, /numberOfLines=\{1\}/, 'the badge never wraps');

  const den = read('src/play/den-sheet.tsx');
  assert.match(den, /petStatusView\(/, 'Den reads petStatusView');
  assert.match(den, /variant="mini"/, 'Den tile draws the mini badge');
  assert.match(den, /variant="detail"/, 'Den card draws the detail badge');
  assert.match(den, /miniSpacer/, 'a Den tile without a badge reserves its line');

  const room = read('src/play/street-room.tsx');
  assert.match(room, /<PetStatusBadge status=\{status\} variant="strip"/, 'Hideout name tag draws the strip badge');
  assert.doesNotMatch(room, /GRADE_LABEL/, 'the strip no longer builds its own grade text');
  assert.match(room, /flexWrap: 'nowrap',\s*height: 36,/, 'strip is still one fixed 36 px row');

  const roomTsx = read('src/play/pet-room.tsx');
  assert.match(roomTsx, /copies=\{copies\}/, 'PetRoom feeds the strip its copies');
  const screen = read('src/play/pet-screen.tsx');
  assert.equal((screen.match(/copies=\{pet\.hero \? pv\.heroes\[pet\.hero\]\?\.copies \?\? 0 : 0\}/g) ?? []).length, 2, 'Pet screen feeds copies to the strip and the room');
  ok('wired in the Den tile + card and the Hideout name tag; fixed rows held');
}

console.log(`\ncheck:pet-status-badge — ${passed} groups passed`);
