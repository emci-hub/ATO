/**
 * gen-copy-reading: parses the nine copy-review reports in docs/copy-review-agent/
 * into items.json and builds one self-contained reading-helper.html (phone friendly).
 *
 * Run: npm run gen:copy-reading
 * Docs/tooling only. Reads reports, writes only under docs/copy-review-agent/.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'docs', 'copy-review-agent');
const TEMPLATE = path.join(process.cwd(), 'scripts', 'copy-reading-template.html');

type Verdict = 'FIX' | 'REMOVE' | 'UNSURE' | 'WRONG' | 'NOTE' | 'OK';
type Tier = 'decide' | 'polish' | 'spot';

interface Item {
  key: string;
  set: number;
  setLabel: string;
  flag: string;
  id: string;
  field: string;
  original: string;
  suggested: string;
  verdict: Verdict;
  reason: string;
  tier: Tier;
  honesty: Honesty;
  honestyNote: string;
}

type Honesty = 'conflict' | 'resolved' | 'ok';

interface Source {
  file: string;
  prefix: string;
  set: number;
  flag: string;
}

const SET_LABELS: Record<number, string> = {
  1: 'Intake, polish, daily pick, profile card, team names',
  2: 'Questions: sensitive traits',
  3: 'Questions: batch A',
  4: 'Questions: batch B',
  5: 'Category cards',
  6: 'Insight bank',
  7: 'Legends',
  8: 'Deep dive and Story',
};

const SOURCES: Source[] = [
  { file: 'set1-3-5-7-small-sets.md', prefix: 's1', set: 1, flag: 'Small sets' },
  { file: 'set4a-questions-sensitive.md', prefix: 'q4a', set: 2, flag: 'Questions' },
  { file: 'set4b-questions-batch-a.md', prefix: 'q4b', set: 3, flag: 'Questions' },
  { file: 'set4c-questions-batch-b.md', prefix: 'q4c', set: 4, flag: 'Questions' },
  { file: 'set5-category-bank.md', prefix: 'cat', set: 5, flag: 'Category bank' },
  { file: 'set6a-insight-bank-1.md', prefix: 'ins6a', set: 6, flag: 'Insight bank' },
  { file: 'set6b-insight-bank-2.md', prefix: 'ins6b', set: 6, flag: 'Insight bank' },
  { file: 'set8-legends.md', prefix: 'leg', set: 7, flag: 'Legends' },
  { file: 'set9-10-deepdive-story.md', prefix: 'dd', set: 8, flag: 'Deep dive' },
];

const SET1_FLAGS: Record<string, string> = {
  PROFILE_CARD: 'Profile card',
  DAILY_PICK: 'Daily pick',
  STAGED_INTAKE: 'Intake',
  POLISH: 'Polish',
  TEAM: 'Team names',
};

const unparsed: string[] = [];
const items: Item[] = [];
const usedKeys = new Set<string>();

// ---------- helpers ----------

function clean(s: string): string {
  let t = s.trim().replace(/\*\*/g, '').replace(/`/g, '');
  t = t.replace(/\\\|/g, '|');
  // strip one pair of wrapping straight quotes when there are no inner ones
  if (t.length > 1 && t.startsWith('"') && t.endsWith('"') && t.indexOf('"', 1) === t.length - 1) {
    t = t.slice(1, -1);
  }
  return t.trim();
}

function emptyish(s: string): boolean {
  return s === '' || /^[—–-]+$/.test(s);
}

function makeKey(prefix: string, id: string, field: string): string {
  let base = (prefix + '.' + id + (field ? '.' + field : ''))
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
  let k = base;
  let n = 2;
  while (usedKeys.has(k)) k = base + '-' + n++;
  usedKeys.add(k);
  return k;
}

function normVerdict(raw: string): Verdict | null {
  const v = raw.toUpperCase();
  if (/^\s*OK\b/.test(v)) return 'OK';
  if (v.includes('REMOVE')) return 'REMOVE';
  if (v.includes('WRONG')) return 'WRONG';
  if (v.includes('UNSURE')) return 'UNSURE';
  if (v.includes('FIX')) return 'FIX';
  return null;
}

const SENSITIVE_RE =
  /sensitiv|safety|unsafe|clinical|shame|shaming|guilt|alcohol|drink|16\+|diagnos|mental-health|mood-disorder|pop-psych|shift risk|insensitive|death imagery|violen|scold|unkind|victim-blam|self-blame|symptom|panic|crisis|age-shaming|bleak|hopeless|depress|loaded|real person|racism|sexism/i;

function tierFor(it: Omit<Item, 'tier' | 'key' | 'honesty' | 'honestyNote'>): Tier {
  if (it.verdict === 'REMOVE' || it.verdict === 'UNSURE' || it.verdict === 'WRONG' || it.verdict === 'NOTE') return 'decide';
  if (it.set === 7) return 'decide'; // Legends facts and real-people tags
  if (it.set === 1 && (it.flag === 'Profile card' || it.flag === 'Team names')) return 'decide';
  if (it.flag === 'Deep dive') return 'decide'; // prompt / validator changes
  const hay = it.reason + ' ' + it.original + ' ' + it.suggested;
  if (SENSITIVE_RE.test(hay)) return 'decide';
  return 'polish';
}

function add(src: Source, p: Omit<Item, 'tier' | 'key' | 'set' | 'setLabel' | 'honesty' | 'honestyNote'>): void {
  const base = { ...p, set: src.set, setLabel: SET_LABELS[src.set] };
  const tier = p.verdict === 'OK' ? 'spot' : tierFor(base);
  items.push({ ...base, tier, honesty: 'ok', honestyNote: '', key: makeKey(src.prefix, p.id, p.field) });
}

function splitRow(line: string): string[] {
  const t = line.trim();
  const inner = t.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((c) => c.trim());
}

// ---------- tables ----------

function parseTables(src: Source, lines: string[]): void {
  let i = 0;
  let curFlag = src.flag;
  const isSet9 = src.prefix === 'dd';
  while (i < lines.length) {
    const line = lines[i];
    if (isSet9) {
      if (/^## A\b/.test(line)) curFlag = 'Deep dive';
      if (/^\*\*A5/.test(line)) curFlag = 'Deep-dive screen text';
      if (/^## B2/.test(line)) curFlag = 'Story templates';
      else if (/^## B\b/.test(line)) curFlag = 'Story bank';
    }
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = splitRow(line).map((h) => h.toLowerCase());
      const col = (re: RegExp) => header.findIndex((h) => re.test(h));
      const cId = col(/^(id|legend|where|const)\b/);
      const cField = col(/^field/);
      const cOrig = col(/^original/);
      const cVerd = col(/^verdict/);
      const cSug = col(/^(replacement|suggested)/);
      const cReason = col(/^reason/);
      i += 2;
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      if (cId < 0 || cOrig < 0 || cVerd < 0 || cSug < 0) {
        unparsed.push(`${src.file}: table with header [${header.join(', ')}] not recognised (${rows.length} rows)`);
        continue;
      }
      for (const r of rows) {
        const cells = splitRow(r);
        if (cells.length !== header.length) {
          unparsed.push(`${src.file}: wrong cell count (${cells.length} vs ${header.length}): ${r.slice(0, 90)}`);
          continue;
        }
        const verdict = normVerdict(cells[cVerd]);
        if (verdict === null) {
          unparsed.push(`${src.file}: unknown verdict "${cells[cVerd]}": ${r.slice(0, 90)}`);
          continue;
        }
        if (verdict === 'OK') continue; // an explicit "OK" row is not something to decide
        let id = clean(cells[cId]);
        let field = cField >= 0 ? clean(cells[cField]) : '';
        let flag = curFlag;
        if (src.prefix === 's1') {
          const m = id.match(/^(PROFILE_CARD|DAILY_PICK|STAGED_INTAKE|POLISH|TEAM)\s+(.*)$/);
          if (m) {
            flag = SET1_FLAGS[m[1]];
            id = m[2];
          } else if (/^STAGED vs POLISH/.test(id)) {
            flag = 'Intake and Polish';
          } else {
            unparsed.push(`${src.file}: could not read flag from id "${id}" (kept as Small sets)`);
          }
        } else if (src.prefix === 'cat' && !field) {
          const idx = id.indexOf(' / ');
          if (idx > 0) {
            field = id.slice(idx + 3);
            id = id.slice(0, idx);
          }
        } else if (src.prefix === 'dd' && curFlag === 'Story bank') {
          const idx = id.indexOf(' / ');
          if (idx > 0) {
            field = id.slice(idx + 3);
            id = id.slice(0, idx);
          }
        }
        let suggested = clean(cells[cSug]);
        if (emptyish(suggested)) suggested = '';
        add(src, {
          flag,
          id,
          field,
          original: clean(cells[cOrig]),
          suggested,
          verdict,
          reason: cReason >= 0 ? clean(cells[cReason]) : '',
        });
      }
      continue;
    }
    i++;
  }
}

// ---------- spot checks ----------

function parseSpots(src: Source, lines: string[]): number {
  let count = 0;
  let i = 0;
  while (i < lines.length) {
    if (/^#{1,3}\s/.test(lines[i]) && /spot/i.test(lines[i])) {
      const sec: string[] = [];
      i++;
      while (i < lines.length && !/^#{1,3}\s/.test(lines[i])) sec.push(lines[i++]);
      const listLines = sec.filter((l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l));
      if (listLines.length > 0) {
        listLines.forEach((l, n) => {
          const body = l.replace(/^\s*(?:[-*]|\d+\.)\s+/, '');
          let text = clean(body);
          let id = '';
          let flag = src.flag;
          if (src.prefix === 's1') {
            const m = body.match(/\((STAGED_INTAKE|POLISH|DAILY_PICK p?\d*|TEAM)[^)]*\)\s*$/);
            if (m) {
              const tag = m[1].trim();
              const f = tag.split(' ')[0];
              flag = SET1_FLAGS[f] ?? flag;
              id = tag;
              text = clean(body.slice(0, body.length - m[0].length));
            }
          } else {
            const m = text.match(/^([A-Za-z0-9_ ./'’-]+?)(?:\s*\(|:)/);
            if (m) id = m[1].trim();
          }
          if (!id) id = 'spot ' + (n + 1);
          add(src, { flag, id, field: 'spot-check', original: text, suggested: '', verdict: 'OK', reason: '' });
          count++;
        });
      } else {
        // a paragraph of backticked ids followed by a shared description
        const para = sec.join(' ');
        const ids = [...para.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
        const desc = clean(para.replace(/^[^:]*:\s*/, '').replace(/`[^`]*`/g, ''));
        const shared = clean(para.slice(para.lastIndexOf('`') + 1).replace(/^[\s,:]+/, ''));
        ids.forEach((id) => {
          add(src, { flag: src.flag, id, field: 'spot-check', original: shared || desc, suggested: '', verdict: 'OK', reason: '' });
          count++;
        });
      }
      continue;
    }
    i++;
  }
  return count;
}

// ---------- set 9 prose findings (A1..A7) ----------

function parseProse9(src: Source, lines: string[]): void {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\*\*A(\d)\.\s+(.+?)\*\*\s*(.*)$/);
    if (!m) continue;
    const n = m[1];
    const titleRaw = m[2];
    const body: string[] = m[3] ? [m[3]] : [];
    let j = i + 1;
    while (j < lines.length && !/^\*\*A\d/.test(lines[j]) && !/^---/.test(lines[j]) && !/^## /.test(lines[j])) {
      body.push(lines[j]);
      j++;
    }
    if (body.some((l) => l.trim().startsWith('|'))) continue; // table (A5), parsed elsewhere
    const codes: string[] = [];
    const prose: string[] = [];
    let inCode = false;
    let buf: string[] = [];
    for (const l of body) {
      if (l.trim().startsWith('```')) {
        if (inCode) {
          codes.push(buf.join('\n'));
          buf = [];
        }
        inCode = !inCode;
        continue;
      }
      if (inCode) buf.push(l);
      else prose.push(l);
    }
    const text = prose.join(' ').replace(/\s+/g, ' ').trim();
    const vm = titleRaw.match(/\((FIX|REMOVE|UNSURE|OK)\b/i);
    const verdict = (vm ? vm[1].toUpperCase() : 'FIX') as Verdict;
    const title = clean(titleRaw.replace(/\s*\([^)]*\)\.?\s*$/, '').replace(/\.$/, ''));
    let suggested = codes.join('\n\n');
    if (!suggested) {
      const u = text.match(/Use ("[^"]+")/);
      if (u) suggested = 'Use ' + u[1];
    }
    if (!suggested) {
      const r = text.match(/Regenerate with `([^`]+)`/);
      if (r) suggested = 'Regenerate the review doc with ' + r[1];
    }
    if (!suggested) {
      const inline = [...text.matchAll(/`([^`]{30,})`/g)].map((x) => x[1]);
      if (inline.length) suggested = inline[inline.length - 1];
    }
    add(src, {
      flag: 'Deep dive',
      id: 'Deep dive ' + 'A' + n,
      field: title,
      original: '',
      suggested,
      verdict: verdict === 'OK' ? 'NOTE' : verdict,
      reason: clean(text),
    });
  }
}

// ---------- honest-weakness triage (emci 2026-10-19, CLAUDE.md "Honest weaknesses") ----------
// Edit THIS section to change the triage; it is re-applied on every run. The reviewers' reports are never touched.
// conflict = the suggestion or its reason softens/removes a plain, supported limitation, or bans an ordinary word,
//            or forces an upside. Becomes tier 'decide' with "Keep original" recommended.
// resolved = already changed in code by emci. Everything not listed stays honesty 'ok'.

const NOTE_SOFTEN = 'This swaps a plain limitation for a softer word. Your new rule says keep it plain unless it shames.';
const NOTE_UPSIDE = 'This replaces a real limitation with an upside-only version. Your new rule says state it plainly and kindly.';
const NOTE_RESOLVED = 'Already changed in code: the card now shows a real watch-out and one step from the insight bank.';

const HONESTY_RULES: { key: string; honesty: 'conflict' | 'resolved'; label: string; note: string }[] = [
  // profile card: fixed in code
  { key: 's1.profile-card.tsx:112', honesty: 'resolved', label: 'WEAKNESS label already fixed', note: NOTE_RESOLVED },
  { key: 's1.profile-history.ts:155', honesty: 'resolved', label: 'Less natural already fixed', note: NOTE_RESOLVED },
  { key: 's1.profile-card.tsx:109', honesty: 'resolved', label: 'Strength quotes already fixed', note: NOTE_RESOLVED },

  // questions: plain stress descriptions swapped for vaguer ones
  { key: 'q4c.steadiness_16', honesty: 'conflict', label: 'Feel sick swapped for weighs on me', note: NOTE_SOFTEN },
  { key: 'q4c.steadiness_18', honesty: 'conflict', label: 'Racing heart swapped for tense', note: NOTE_SOFTEN },

  // category bank: low cells softened
  { key: 'cat.cat_resilience-low.summary-3', honesty: 'conflict', label: 'Hard times softened to feelings', note: NOTE_SOFTEN },
  { key: 'cat.cat_resilience-low.summary-2', honesty: 'conflict', label: 'Self-doubt swapped for replaying', note: NOTE_SOFTEN },
  { key: 'cat.cat_resilience-low.watch-out-3', honesty: 'conflict', label: 'Doubt swapped for lingering', note: NOTE_SOFTEN },
  { key: 'cat.cat_agency-low.summary-3', honesty: 'conflict', label: 'Unsure swapped for upside', note: NOTE_UPSIDE },
  { key: 'cat.cat_drive-low.watch-out-3', honesty: 'conflict', label: 'Doubt swapped for waiting', note: NOTE_SOFTEN },
  { key: 'cat.cat_levity-low.summary-3', honesty: 'conflict', label: 'Without humor swapped for focus', note: NOTE_UPSIDE },
  { key: 'cat.cat_openness-low.watch-out-2', honesty: 'conflict', label: 'Friends stop inviting softened', note: NOTE_SOFTEN },
  { key: 'cat.cat_love-hl.watch-out-3', honesty: 'conflict', label: 'Calm a worry made vague', note: NOTE_SOFTEN },
  { key: 'cat.cat_love-hh.summary-2', honesty: 'conflict', label: 'Worry swapped for think a lot', note: 'This removes the ordinary word worry. Your new rule keeps ordinary words unless they diagnose.' },
  { key: 'cat.cat_independence-ll.watch-out-3', honesty: 'conflict', label: 'Friendships fade made vague', note: NOTE_SOFTEN },

  // insight bank
  { key: 'ins6b.ftw_relatedness_h_03.focus-2', honesty: 'conflict', label: 'Feel low swapped for flat', note: NOTE_SOFTEN },
  { key: 'ins6b.ftw_locus_of_control_l_01.focus-2', honesty: 'conflict', label: 'No point softened to little change', note: NOTE_SOFTEN },
  { key: 'ins6b.ftw_playfulness_l_06.why', honesty: 'conflict', label: 'Rarely get fun made gentler', note: NOTE_SOFTEN },

  // deep dive: prompt / validator / story rules
  { key: 'dd.deep-dive-a1.conflicting-voice-block', honesty: 'conflict', label: 'Prompt says no advice, no lesson', note: 'This tells the prompt to give no advice at all. Your new rule wants one practical step where it fits. The fix for the clashing examples can stay.' },
  { key: 'dd.deep-dive-a2.gentle-card-leaks-clinical-axis-ids', honesty: 'conflict', label: 'Bans worry, overthinking, fear words', note: 'This bans ordinary words like worried and overthinking, not just clinical ones. The part about not sending clinical axis names can stay.' },
  { key: 'dd.deep-dive-a3.othersnotice-can-turn-into-judgement', honesty: 'conflict', label: 'Others notice: likes only', note: 'This forces an upside-only line and bans what others find hard. Your new rule wants honest on both sides.' },
  { key: 'dd.deep-dive-a4.validator-gaps', honesty: 'conflict', label: 'Banned list adds ordinary words', note: 'This adds ordinary words like worry, lonely, lazy and selfish, and advice words like work on, to the banned list. Keep the truly clinical ones only.' },
  { key: 'dd.low-lean-card-6-tips-keyed_tips-lows', honesty: 'conflict', label: 'Low-lean tips forced to upside', note: 'The unequal tone is real, but this fixes it by making the low side upside-only. Fix it by being honest and kind on both sides instead.' },
  { key: 'dd.love_work_high.reveal-otherway', honesty: 'conflict', label: 'Caring-gap line swapped for light', note: NOTE_SOFTEN },
  { key: 'dd.love_friends_low.hook-punchline', honesty: 'conflict', label: 'Panicked swapped for rushed', note: 'This removes the ordinary word panicked. Your new rule keeps ordinary words unless they diagnose.' },
  { key: 'dd.love_friends_high.twist-reveal', honesty: 'conflict', label: 'Practice letting go made upside', note: NOTE_UPSIDE },
];

function applyHonestyRules(): { counts: Record<string, number>; conflicts: { key: string; label: string }[]; missing: string[] } {
  const missing: string[] = [];
  const conflicts: { key: string; label: string }[] = [];
  for (const r of HONESTY_RULES) {
    const it = items.find((x) => x.key === r.key);
    if (!it) {
      missing.push(r.key);
      continue;
    }
    it.honesty = r.honesty;
    it.honestyNote = r.note;
    if (r.honesty === 'conflict') {
      it.tier = 'decide';
      conflicts.push({ key: r.key, label: r.label });
    }
  }
  const counts: Record<string, number> = { conflict: 0, resolved: 0, ok: 0 };
  items.forEach((x) => counts[x.honesty]++);
  return { counts, conflicts, missing };
}

// ---------- run ----------

function main(): void {
  const perFileSpots: Record<string, number> = {};
  for (const src of SOURCES) {
    const p = path.join(DIR, src.file);
    if (!fs.existsSync(p)) {
      unparsed.push(`${src.file}: FILE MISSING`);
      continue;
    }
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    parseTables(src, lines);
    if (src.prefix === 'dd') parseProse9(src, lines);
    perFileSpots[src.file] = parseSpots(src, lines);
    if (perFileSpots[src.file] !== 8) unparsed.push(`${src.file}: found ${perFileSpots[src.file]} spot-check items (expected 8)`);
  }

  // one global decision the reports raise for the whole question bank
  add(SOURCES[1], {
    flag: 'Questions',
    id: 'All 400 questions',
    field: 'apostrophes',
    original: "Every question string uses straight apostrophes (') and quotes (\") instead of curly ones.",
    suggested: 'Convert to curly apostrophes and quotes in one scripted pass over the bank files (not item by item).',
    verdict: 'NOTE',
    reason: 'Raised by the three question reports. House style is curly. One global decision instead of hundreds of tiny fixes.',
  });

  const honesty = applyHonestyRules();

  fs.writeFileSync(path.join(DIR, 'items.json'), JSON.stringify(items, null, 2) + '\n', 'utf8');

  const html = buildHtml();
  fs.writeFileSync(path.join(DIR, 'reading-helper.html'), html, 'utf8');

  // summary
  console.log('Copy reading: ' + items.length + ' items');
  console.log('set | label                                              | decide | polish | spot');
  for (let s = 1; s <= 8; s++) {
    const inSet = items.filter((x) => x.set === s);
    const c = (t: Tier) => inSet.filter((x) => x.tier === t).length;
    console.log(
      String(s).padEnd(3) + ' | ' + SET_LABELS[s].padEnd(50) + ' | ' + String(c('decide')).padStart(6) + ' | ' + String(c('polish')).padStart(6) + ' | ' + String(c('spot')).padStart(4),
    );
  }
  const tot = (t: Tier) => items.filter((x) => x.tier === t).length;
  console.log('all | ' + ''.padEnd(50) + ' | ' + String(tot('decide')).padStart(6) + ' | ' + String(tot('polish')).padStart(6) + ' | ' + String(tot('spot')).padStart(4));
  console.log('\nPer report (non-spot rows):');
  for (const src of SOURCES) {
    const keyPrefix = src.prefix + '.';
    const n = items.filter((x) => x.key.startsWith(keyPrefix) && x.tier !== 'spot').length;
    console.log('  ' + src.file + ': ' + n + ' rows, ' + perFileSpots[src.file] + ' spot');
  }
  console.log('\nHonesty triage: conflict ' + honesty.counts.conflict + ', resolved ' + honesty.counts.resolved + ', ok ' + honesty.counts.ok);
  honesty.conflicts.forEach((c) => console.log('  conflict  ' + c.key + '  --  ' + c.label));
  honesty.missing.forEach((k) => console.log('  WARNING rule key not found: ' + k));
  if (unparsed.length) {
    console.log('\nUNPARSED / WARNINGS (' + unparsed.length + '):');
    unparsed.forEach((u) => console.log('  - ' + u));
  } else {
    console.log('\nNo unparsed rows.');
  }
  console.log('\nWrote ' + path.join(DIR, 'items.json'));
  console.log('Wrote ' + path.join(DIR, 'reading-helper.html'));
}

function buildHtml(): string {
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');
  const sets = Object.keys(SET_LABELS).map((k) => ({ n: Number(k), label: SET_LABELS[Number(k)] }));
  const safe = (o: unknown) => JSON.stringify(o).replace(/</g, '\\u003c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');
  return tpl.replace('__DATA__', () => safe(items)).replace('__SETS__', () => safe(sets));
}

main();
