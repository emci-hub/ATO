# Migration

Ordered by what a person can still get from a model today. Do not start by ripping out the insight bank. That bank is already the safe version of this idea. Start where Gemini is still in the loop.

Owner decision (2026-10-22): deep dives and Legends move together. The filler, the starter bank (including mid), and both taps are on this branch behind `STORY_LIBRARY_RUNTIME` (default **off**). The client `generateText` fallbacks are removed. The cron unschedule and the writer refusal are prepared under `shutdown/` and are **not** applied. The validator runs as `npm run check:story-library`.

The prototype in this folder stays the design sample. The shipping engine is `src/lib/story-v3/tracery.ts`.

## Step 0 — Accept the schema

Read the highlighted renders in [prototype/sample-output.md](prototype/sample-output.md). Decide whether the slot and ending shape is right before any app file changes. Open questions are at the bottom of this file.

## Step 1 — Explore deep dives

Highest impact. It is the only AI text on Explore, it spends tokens, and the fill cron spends most of its calls here (207 buckets, target 3 cards each).

Keep on the phone, with no model: category percents, the middle-vs-side flag, the angle the reader picked.

Add backbones for `people`, `work`, and `solo`, with slots that match `CategoryDive`: title, up to three shows-up lines, mix, notice, closing. Joke becomes a picked line, or it goes away.

Ship rule: a bucket renders from the library for every h/l/m combo that category can have. Until that matrix is green, the tap keeps serving cards already in the database, and the "write a new one" button is hidden. Do not fall through to `writeCategoryDeepDive`.

Then:

- Stop passing `deep_dive` to `ai-library` and `ai-library-fill`.
- Leave old cards readable until their library version is retired, the way `LIBRARY_VERSION` already drops stale cards.
- Update `AI_USE_DISCLOSURE` and the privacy note when this surface no longer calls a model. That copy is an Apple 5.1.2 string. It has to change in the same release as the behavior.

## Step 2 — Legend reveals

Second live surface. Easier than deep dives in one way: `fallbackLegendStory` already shows a full card with no model, built from the museum entry.

Replace the AI fields only (`title`, won-line, meeting scene, differ, closing, joke). The museum facts stay the hand-written entry. The filler must not introduce a name, number, or quote that is not in that entry. That rule is already what `parseLegendStory` enforces on model output. Keep it as a check on filled output.

Ending selection uses the matched sides plus the differ side. A combo ending is for a real pair (the reader's side and the legend's contrast), not for every pair of the 16.

Then remove `writeLegendStory`'s `generateText` call so a `missing` library can only hit the fallback, never a revived proxy.

## Step 3 — Close the live writer

After steps 1 and 2 no product tap needs a model.

- Unschedule `ai-library-fill`.
- Make `ai-library` refuse `story`, `deep_dive`, and `legend`, the same way `ai-generate` returns 410. Do this only once the phone no longer depends on it.
- Delete or stop exporting the dead prompt builders so they are not copied back: `buildDiveBundlePrompt` as a live caller, `buildLegendPrompt` as a live caller, `buildExplorePrompt`, `buildTitlePrompt`, `buildCategoryStatementsPrompt`, `buildStoryPrompt`, `STORY_POLISH_PROMPT_STATIC` as a server prompt, `composeRoll`.
- Fix `AI_CALL_SITES`. It still names files that do not generate.
- `pingProvider` can be removed with the lab dot, or pointed at a non-model health check. It is not a text feature.

`src/lib/story-v3/` stays. It is the runtime for the Story until step 6.

## Step 4 — Admin authoring tool

The owner asked for this inside the app. Build it only after the schema is accepted, and build it as a root tool in `dev-lab`, next to `AiLibraryDev`, not as a public screen. Two taps to publish, same rule as the other dev writes.

The tool needs:

- A kind picker: insight, legend, explore, and later play.
- A backbone editor where slots are chips. Typing `{1}` is not allowed. The readable sentence stays visible.
- A slot inspector: part of speech, form, frame, dominant / secondary / generic, tones, intensities, lock, article.
- A bank editor: trait, tier, and the same tags. Saving an entry shows which slots can accept it, and which refuse it, before it is stored.
- An ending editor: the `when` facts, a preview of which sample readers it wins for, and the fallback sitting at the bottom so it cannot be deleted by accident.
- Save runs the validator. Status cannot leave `draft` while the matrix is red. `approved` is a second tap.
- A diff against the approved version. One grammar version per ship.
- Optional "draft with AI": sends [STYLE.md](STYLE.md), the slot, and a few approved examples. Output is a draft entry list. It does not approve itself and it does not see user data.
- A button that writes `sample-output.md` for the templates you just touched, so the read-through has a file.

The first version of the tool can be this prototype plus a JSON file in the repo. The in-app screen is the same operations with a login gate. Do not block step 1 on the screen if the JSON and the CI script are enough to author the first deep-dive backbones.

Storage: JSON in the repo, one file per trait, templates in their own files. That matches the question bank and the insight bank, and CI can see the diff. A server table is only needed if an admin must publish between app releases. The phone still bundles the approved snapshot. It does not fetch prose at tap time.

## Step 5 — Tokens, consent, disclosure

When no tap calls a model:

- `AI_USE_DISCLOSURE` and the Home / You consent body stop saying Legends and deep dives are written by AI.
- The 5-token charge for those taps goes away, or the tap becomes a free library open. That is a product call. The server claim RPCs (`claim_library_write`, `refund_ai_tokens`) should stop being reachable from those buttons in the same change.
- Admin drafting uses the owner's key in the tool, not `ai_consent` on a player's row. Players are not asked to consent to a model that does not see their text.

## Step 6 — The banks that are already safe

Do these only when someone wants one authoring tool for all copy. They are not AI removals.

| Bank | Move |
|---|---|
| `src/lib/insight-bank/` | Keep the full sentences. A later import can mark each sentence as a phrase entry so the tool can edit them. Do not split a focus line into a bare verb. |
| `src/lib/category-bank/` | Same. The low/mid/high cells are already the tier grid. |
| `src/lib/story-v3/` | When the filler replaces `expandGrammar`, port object-revolt and the topics across. Until then, leave the Story on v3. |
| `src/lib/daily-line/` | Authored lines stay. Old `source: 'ai'` rows can age out. Nothing new should call `keepAiLines`. |
| `src/play/pet-knows-you-bank.ts` | Optional `play` kind. High/low only today. Add mid or map mid to generic on purpose. Keep the 10-word cap. |
| `src/play/pet-talk.ts`, visitors, hero and legend copy, street names | Leave them. They are not trait prose, and they are not AI. |

## Risks

- **A green matrix can still sound thin.** The sample's "She dives before anyone else speaks" is the proof. Phrase slots and a human read are the fix. Do not treat CI as a substitute for reading `sample-output.md`.
- **Mid is easy to forget.** A lot of current copy only has high and low (`leanHighLow` at 0.5). If mid is missing, the fallback generic line shows, and it may feel like the wrong person. Author mid, or decide in public that mid uses the generic on purpose.
- **Shared frames travel.** One verb frame used in two sentences has to work in both. Prefer a frame per backbone when the sentences diverge.
- **The cron will keep drifting until it is turned off.** Shipping the library on the phone without stopping `ai-library-fill` means new model cards still appear.
- **The 410 fallback was a trap.** Those `generateText` calls are removed. Do not put them back. With the flag off, a missing shared library uses the museum words (Legends) or says unavailable (deep dives). It does not call a model from the phone.
- **Facts in legends.** A filled line that mentions a date or a quote not in the museum entry repeats the bug the legend parser already rejects. Run that check on filled text.
- **Disclosure lag.** Shipping the library while the consent card still says AI writes the cards is the wrong claim in both directions. Change them together.
- **Play isolation.** This design touches app copy and, later, Play lines. Those are separate changes. Do not put pet lines and deep-dive templates in one commit. `check:play-isolation` will fail the mix.

## Open questions for emci

Decided on this branch: both surfaces together; mid wording for all 16 traits is in the starter bank; the dev-lab editor exists and the shipped copy still lives in TypeScript, not a separate JSON file. The Story stays on `expandGrammar`.

Still open:

1. Joke line. The starter omits it. If it comes back, it should be a picked bank.
2. Token price once the flag is on. This branch makes those taps free and skips the charge. Confirm that is the product, and whether "show me another" should walk the bank.
3. When to flip `STORY_LIBRARY_RUNTIME` and apply `shutdown/`. Not until a phone check of the library cards.
4. The means line repeats the shows-up aside. A later edit can give the ending its own sentence.
5. Legend won-lines share one museum moment. Per-trait moments are not in the starter.
6. Session edits in the dev lab do not rewrite the bundle. Saving an approved edit back into the repo is still a code change.
