# Dead Weight

DB fields no screen ever displays. Built from the screen-by-screen pass in `docs/screen-map.md`.

## Result: no confirmed dead weight found in this pass

Every field flagged in screen-map.md as "loaded, not rendered" on a given screen was cross-checked (grep, not assumption) against the rest of `src/`, and in every case it turned out to be genuinely used — either rendered on a *different* screen, or consumed for logic/routing rather than display. None of these are safe to delete:

| Field | Flagged as unrendered on | Actually used for |
|---|---|---|
| `talk_style` (me / PeerMe / public_profile / NightFace-adjacent) | Circle (peer view), Public Profile, Around | Set and displayed on **You** tab via `TalkStylePicker` (`intake-settings.tsx`) — the peer-facing views just don't surface *other people's* talk style, likely by design (privacy), not because the field is unused |
| `today-card-events.ts` | (misread in an early batch as missing) | Real file, imported by `push-runtime.tsx`, `use-today-card.ts`, `today-card.ts` |
| `crisisYesterday` (Dawn) | Dawn screen itself | Fed into `routeVoiceCard`'s routing logic — shapes which card generates, just isn't shown as its own UI element |
| `check.source` | Week screen | Round-trips through `record_check` RPC (`p_source`) — feeds trait-write provenance logic (direct vs. inferred sources), not meant to be displayed |
| `entry.traits` (explore_entries) | Explore's Observations fold | Used by `lib/home-teaser.ts`'s `exploreTraitsFromPack` to pick which trait axis Home's daily teaser explores |
| `entry.chips` / `entry.signalKind` / `entry.sortIndex` | Explore's Observations fold | Not yet traced to a second call site beyond `explore/store.ts`'s own mapping — **verify manually**, lower confidence than the others in this table |
| `NightFace.name` | Around | `name` is a normal `me`-sourced field surfaced everywhere else (Home, Circle, etc.); Around's face list just shows `@handle` instead — a display choice for that one screen, not an orphaned column |
| `ChatMessage.deleted_for` / `thread_id` / `created_at` | Chat | Used for filtering/ordering messages, not their own UI text |

## Real gap: 4 baseline tables + 1 RPC have no schema in the repo

Per field-inventory.md's Known Gaps — `me`, `checks`, `crisis_flags`, `connections` predate migration tracking, and the screen-map pass added one more to this list: **`public_profile`** RPC has no `CREATE FUNCTION` anywhere in `supabase/migrations/` (grep-confirmed, zero matches — only comments reference it).

This means a genuine dead-weight audit of `me`'s ~70 columns (the dominant table) isn't fully provable from the repo alone — a live `supabase db dump` would be needed to enumerate every column and cross-check it against what 17 screens' worth of code actually reads. The screen-map pass covered every *screen*, but did not do a reverse per-column pass over all ~70 `me` columns specifically (that would be the next step, once a live schema is available).

## Confirmed genuinely gone (not dead weight — already removed cleanly)

Per field-inventory.md: `legends` (wave32), `archetype_defs`/`legend_archetypes`/`legend_variants`/`legend_figures`/`user_legend_history` (wave57), `category_question_batches`/`category_question_items` (wave60/61) — all confirmed dropped via migration `DROP TABLE` statements, and confirmed in this pass to have zero live code references (Legends section, screen-map.md).
