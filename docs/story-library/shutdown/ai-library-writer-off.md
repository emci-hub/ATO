# ai-library writer — prepared shutdown, do not deploy

This branch does **not** edit `supabase/functions/ai-library/index.ts` and does **not** unschedule the cron. `check:ai-library` still requires the live function to claim, then `await complete(`.

Apply the two steps below only when `STORY_LIBRARY_RUNTIME` is already true in a shipped build. Until then the flag-off path still asks this function for a shared card.

## 1. Unschedule the fill

Run `unschedule-ai-library.sql` in this folder (it is not under `supabase/migrations`, so it is not the next wave). That removes the `ai-library-fill` job. It does not delete old cards.

## 2. Refuse the two kinds before the model

In `supabase/functions/ai-library/index.ts`, after the bucket check and **before** `rpc('claim_library_write'` and `await complete(`, return without calling the model when the kind is one the phone now assembles itself:

```ts
if (kind === 'deep_dive' || kind === 'legend') {
  return json({ ok: false, reason: 'library' }, 410);
}
```

Leave `story` alone until that kind is removed on purpose. Do not delete `await complete(` from the function while any kind still writes a card. Do not deploy this snippet on its own: a phone build with the flag off would lose both the model and the Story Library.
