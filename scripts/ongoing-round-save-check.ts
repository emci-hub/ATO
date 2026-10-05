/**
 * T-03 (core loop redesign): the ongoing-round save path + UI trigger. Run:
 * npm run check:ongoing-round-save
 *
 * store.ts/run-ongoing-round.ts import @/lib/supabase (pulls in
 * react-native, fails under plain Node) and questions-fold.tsx is a React
 * Native component — all three are checked via source assertions only, same
 * pattern rolls-store-check.ts already uses for RN-touching files.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

// --- store.ts ----------------------------------------------------------------
const storeSrc = read('src/lib/questions/store.ts');

assert.match(
  storeSrc,
  /export async function saveOngoingRoundBatch\(drafts: QuestionDraft\[\]\): Promise<QuestionPackRow> \{/,
);
assert.match(
  storeSrc,
  /if \(!draft\.bankItemId\) \{\s*\n\s*throw new Error\('Ongoing round draft missing bankItemId\.'\);/,
  'saveOngoingRoundBatch must refuse to save a draft with no bankItemId before ever calling the RPC — insert_ongoing_round_pack requires it server-side too, but failing client-side first gives a clearer error',
);
assert.match(
  storeSrc,
  /question_bank_item_id: draft\.bankItemId,/,
  'the RPC payload must map QuestionDraft.bankItemId to question_bank_item_id, the column insert_ongoing_round_pack actually requires',
);
assert.match(storeSrc, /supabase\.rpc\('insert_ongoing_round_pack', \{\s*\n\s*p_items: payload,\s*\n\s*\}\)/);
ok('saveOngoingRoundBatch validates every draft has a bankItemId, then calls insert_ongoing_round_pack once with the mapped payload');

assert.match(
  storeSrc,
  /export async function fetchLatestOngoingRoundPack\(\): Promise<QuestionPackRow \| null> \{/,
);
assert.match(
  storeSrc,
  /\.from\('question_packs'\)[\s\S]{0,120}\.eq\('kind', 'ongoing_round'\)/,
  'fetchLatestOngoingRoundPack must filter on kind=ongoing_round — without it, it would pick up an Infinite Questions pack instead',
);
ok('fetchLatestOngoingRoundPack scopes its query to kind=ongoing_round, never an Infinite Questions pack');

// REMOVED 2026-09-16 (emci): fetchLatestQuestionPack and its
// kind=infinite_questions scoping. The Infinite Questions inline feed that
// read it was deleted, so there is no second reader of this table left to
// collide with ongoing_round rows — which is a stronger guarantee than the
// scoping assertion that used to stand here, not a weaker one. The
// ongoing_round reader is still pinned above.
assert.ok(
  !/fetchLatestQuestionPack/.test(storeSrc),
  'fetchLatestQuestionPack must stay deleted — the Infinite Questions pack reader is gone',
);
ok('the Infinite Questions pack reader stays deleted, leaving ongoing_round the only reader of question_packs');

// A saveOngoingRoundBatch call must never call fetchLatestQuestionPack
// (the unscoped, any-kind reader) to verify its own save — that would
// happily "succeed" against a same-second Infinite Questions pack instead
// of the one it just wrote.
const saveFnBody = storeSrc.slice(
  storeSrc.indexOf('export async function saveOngoingRoundBatch'),
  storeSrc.indexOf('export async function saveQuestionDeferral'),
);
assert.match(saveFnBody, /fetchLatestOngoingRoundPack\(\)/);
assert.doesNotMatch(
  saveFnBody,
  /fetchLatestQuestionPack\(/,
  'saveOngoingRoundBatch must re-fetch via fetchLatestOngoingRoundPack (kind=ongoing_round), not fetchLatestQuestionPack (kind=infinite_questions) — the wrong reader would never find the pack it just wrote',
);
ok('saveOngoingRoundBatch verifies its own save via the ongoing-round-scoped reader, not the Infinite-Questions one');

assert.match(
  storeSrc,
  /if \(drafts\.length === 0\) \{\s*\n\s*throw new Error\('No questions available for a new round right now\.'\);/,
  'saveOngoingRoundBatch must refuse an empty draft array client-side with a clear message, rather than letting a 0-item payload reach insert_ongoing_round_pack\'s own "1-25 items" Postgres exception',
);
ok('saveOngoingRoundBatch refuses an empty round with a clear error before ever calling the RPC');

// --- run-ongoing-round.ts -----------------------------------------------------
const runSrc = read('src/lib/questions/run-ongoing-round.ts');

assert.match(
  runSrc,
  /export async function runOngoingRound\(\s*\n\s*me: OngoingRoundMe,\s*\n\s*history: readonly CheckHistory\[\],\s*\n\s*tracks: readonly TraitTrack\[\],\s*\n\)/,
);
// Anchored to the actual deps object passed to composeOngoingRound, not just
// anywhere in the file — an import line alone (`import { addToBankPool,
// fetchBankCandidates, ... }`) would satisfy a bare `/fetchBankCandidates,/`
// match even if a dep were silently dropped from the object itself.
const composeCallBody = runSrc.slice(
  runSrc.indexOf('const drafts = await composeOngoingRound('),
  runSrc.indexOf('return saveOngoingRoundBatch(drafts);'),
);
assert.match(composeCallBody, /generateBatch: generateOngoingRoundBatch,/);
assert.match(composeCallBody, /fetchRecentTexts,/);
assert.match(composeCallBody, /fetchBankCandidates,/);
assert.match(composeCallBody, /recordBankUsage,/);
assert.match(composeCallBody, /addToBankPool,/);
ok('runOngoingRound wires composeOngoingRound with the real generate/bank-pool/recent-text dependencies, checked against the actual deps object, not just an import line');

// The critical design constraint: saveItems must be a true no-op (never
// touches the network/DB), and saveOngoingRoundBatch must be called exactly
// once, AFTER composeOngoingRound resolves — never from inside the saveItems
// hook, which composeOngoingRound invokes once per bank draw and once per AI
// chunk (up to several times per round). Calling the real save RPC from
// there would create several partial packs instead of one 16-item round.
// A short round is never saved (the +21 claim needs a full one).
assert.match(runSrc, /if \(drafts\.length < ONGOING_ROUND_SIZE\) \{\s*throw new Error/, 'a short round throws instead of saving a pack that can never pay');
assert.match(runSrc, /saveItems: async \(\) => \{\},/, 'saveItems passed into composeOngoingRound must be a true no-op — the real save happens once, after composeOngoingRound resolves, not per chunk');
const composeCallIdx = runSrc.indexOf('await composeOngoingRound(');
const saveBatchCallIdx = runSrc.indexOf('return saveOngoingRoundBatch(drafts.slice(0, ONGOING_ROUND_SIZE));');
assert.ok(composeCallIdx > -1 && saveBatchCallIdx > composeCallIdx, 'saveOngoingRoundBatch must be called after composeOngoingRound resolves, not from within its saveItems hook');
ok('composeOngoingRound\'s saveItems hook is a true no-op; saveOngoingRoundBatch is called exactly once, after the full round is composed');

// --- questions-fold.tsx: UI trigger --------------------------------------------
const foldSrc = read('src/components/questions-fold.tsx');

// 2026-09-11, third pass on this screen the same day: the round now gets its
// own paged UI (matching the Full Profile pager) that REPLACES the finished
// 50-question bank on screen, rather than the bank staying visible (locked)
// with the round appended below as a small single-question "Submit" block —
// that stacking is exactly what read as unrelated/broken UI. Confirm the
// bank's own PagedQuestions only ever renders in the NOT-locked branch.
// One deliberate exception (staged intake, 2026-10-02): an account that
// finished the OLD 50 is offered its restored third questions above the
// round, as optional — and only that account (`optionalLegacy`).
assert.match(
  foldSrc,
  /\{fullProfileLocked \? \(\s*\n[\s\S]{0,700}?\{optionalLegacy \? \([\s\S]{0,400}?\{setPager\}\s*<\/>\s*\) : null\}\s*<OngoingRoundFold me=\{me\} history=\{history\} tracks=\{tracks \?\? \[\]\} onUpdated=\{onUpdated\}(?: onMoment=\{showMoment\})? \/>\s*<\/>\s*\) : \(/,
  'fullProfileLocked must render OngoingRoundFold in place of the bank pager — the only pager beside it is the old-50 optional set',
);
const bankBranchStart = foldSrc.indexOf(') : (', foldSrc.indexOf('{fullProfileLocked ? ('));
const bankBranchBody = foldSrc.slice(bankBranchStart, foldSrc.indexOf('</View>', bankBranchStart));
assert.match(bankBranchBody, /\{setPager\}/, 'the bank pager must live in the NOT-fullProfileLocked branch');
assert.match(foldSrc, /const setPager =\s*set && bankRows\.length > 0 \? \(/, 'the set pager renders only while a set is open');
ok('the bank pager and the ongoing-round pager are mutually exclusive — never both on screen');

// AUTO-START REMOVED (ISOLATION_PLAN §7 Card D, emci 2026-09-15). This block
// used to assert the opposite: that `load()` must call `start()` itself when no
// pack existed, so finishing the intake immediately released the next batch
// (emci's explicit choice, 2026-09-11). It is superseded by emci's harder rule
// that NO model call may fire without a press — and this was the most
// expensive one in the app: composing a 25-item round is several chunked AI
// calls, fired from a mount effect. The "no pack" branch renders the
// NEXT_ROUND_LABEL button instead, and that press is now the only way in.
const loadFnBody = foldSrc.slice(
  foldSrc.indexOf('const load = useCallback(async () => {', foldSrc.indexOf('function OngoingRoundFold')),
  foldSrc.indexOf('async function start()'),
);
assert.doesNotMatch(
  loadFnBody,
  /void start\(\);/,
  'load() must NOT start a round on its own — composing one spends several model calls',
);
assert.match(foldSrc, /NEXT_ROUND_LABEL/, 'the round must be offered as an explicit press instead');
ok('the first ongoing round waits for an explicit "Next 25 questions" press — no model call on mount');

assert.match(foldSrc, /const existing = await withTimeout\(fetchLatestOngoingRoundPack\(\), 25000, 'ongoing-round-load'\);/);
assert.match(foldSrc, /const saved = await withTimeout\(runOngoingRound\(ongoingMe, history, tracks\), 40000, 'ongoing-round-start'\);/);
ok('OngoingRoundFold loads any existing ongoing-round pack and can start a new one via runOngoingRound');

// Answering a batch of ongoing-round items goes through ONE server call per
// item since wave79 (2026-10-03): answer_round_item marks the item answered
// AND scores it in one transaction, with the value read from the stored item.
// The old two-step path (answerQuestionItem, then a client-side updateTraits)
// could mark an item answered and then fail the trait write.
const saveRoundAnswersBody = foldSrc.slice(
  foldSrc.indexOf('async function saveRoundAnswers(', foldSrc.indexOf('function OngoingRoundFold')),
  foldSrc.indexOf('async function reroll('),
);
assert.match(saveRoundAnswersBody, /await answerRoundItem\(key, optIndex\);/);
assert.doesNotMatch(saveRoundAnswersBody, /answerQuestionItem|updateTraits\(/);
// INVERTED 2026-10-01 (was: the batch also earns the old currency). The old
// currency is retired; a round now earns only its +21 ATO tokens on completion.
assert.doesNotMatch(saveRoundAnswersBody, /earnTokensQuiet\(/);
assert.match(saveRoundAnswersBody, /await onUpdated\(\);/);
// Sequential, not Promise.all — same discipline saveBankAnswers already
// uses (the server also locks the account row per write).
assert.doesNotMatch(saveRoundAnswersBody, /Promise\.all/);
ok('saveRoundAnswers answers a whole batch through the answer_round_item checkpoint + onUpdated, sequentially not concurrently');

// Completion is checked once per batch, not per item, via the same
// dedup-on-pack-id RPC as before — and via a functional setPack update
// (holder.pack), not a stale closure read of `pack`, so an overlapping
// background save/reroll can't silently revert this batch's local effect
// (found in review: the original draft used `setPack({...pack, ...})`,
// which raced when multiple pages' saves were in flight at once).
assert.match(saveRoundAnswersBody, /setPack\(\(prev\) => \{/, 'must use a functional state update, not a closure read of `pack`');
// wave68: the predicate is `roundFullyAnswered`, NOT `nextUnansweredItem`.
// The two disagree about skips, and only `roundFullyAnswered` matches
// `claim_ongoing_round_complete` (wave52), which requires every item to have
// `answered_option is not null` and ignores `skipped_at`. A skip-tolerant
// check here would fire a claim the server refuses.
assert.match(
  saveRoundAnswersBody,
  /if \(holder\.pack && roundFullyAnswered\(holder\.pack\)\) \{\s*\n\s*claimOngoingRoundCompleteQuiet\(holder\.pack\.id, \(\{ paid, fresh, capped \}\) => \{/,
);
// 2026-10-01: the claim's answer drives the round-end toast (which names the
// +21 only when the server paid it) and a fresh payout refreshes the balance.
assert.match(saveRoundAnswersBody, /setRoundToast\(\{ paid \}\);\s*\n\s*if \(fresh\) void onUpdated\(\);/);
assert.doesNotMatch(
  saveRoundAnswersBody,
  /nextUnansweredItem/,
  'the round path must not use the skip-tolerant Infinite Questions predicate',
);
ok('round-completion is evaluated once against the whole batch via a functional state update, not per item and not a stale closure, using the answer-only predicate the server agrees with');

// Reroll must be impossible on a row with a local, not-yet-saved pending
// pick — the server's own guard (wave54) only knows about PERSISTED
// answers, so this client-side check is load-bearing, not redundant.
const rerollGateBody = foldSrc.slice(
  foldSrc.indexOf('renderRowExtra={(row, isPending) => {'),
  foldSrc.indexOf('}}\n        />', foldSrc.indexOf('renderRowExtra={(row, isPending) => {')),
);
assert.match(
  rerollGateBody,
  /if \(row\.answered \|\| isPending\) return null;/,
  'reroll must be hidden for both answered rows AND rows with a local pending pick',
);
ok('reroll is hidden on any row with a local pending pick, not just persisted-answered rows');

// The round pager is keyed by pack id so a new round forces a fresh mount
// (no stale picked/pending/failed-batch state bleeding from one round into
// the next), and its storageKey/rows are scoped per pack + account.
assert.match(foldSrc, /key=\{pack\.id\}/);
assert.match(foldSrc, /storageKey=\{`ongoing-round:\$\{pack\.id\}:\$\{me\.id\}`\}/);
ok('the round pager remounts per pack id and scopes its storage key per round + account');

console.log(`\n${passed} ongoing-round-save checks passed`);
