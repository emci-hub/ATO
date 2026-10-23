# Under-18 access block (emci 2026-10-20)

Sign-up is 18+ since 2026-10-19 (`wave99b_min_age_18.sql`). Some existing testers signed up at 16 or 17.
They are **not deleted**. Their account and all their data stay exactly as they are; the app just stays
closed to them until their 18th birthday. If they want, they can delete their account themselves.

## What it does

**Client (ships in the app update).**

- `src/app/_layout.tsx`: once the session and the `me` row have loaded, the age gate
  (`resolveAgeGate`, `src/lib/age.ts`) has three states:

  | `born_on` | State | Screen |
  |---|---|---|
  | a real date, 18 or older today | `open` | the app |
  | a real date, under 18 today | `blocked` | `src/app/under-18.tsx` |
  | null, empty, malformed, impossible (30 Feb) or after today | `confirm` | `src/app/confirm-age.tsx` |

  While gated (confirm or blocked) the tabs, Week, Chat, the Dev Hub, the AI lab, every lab, Play
  (Divecore), `PushRuntime` and the DEV bubble are not mounted.
- Worked out from `born_on` on the phone's **local** date **each time the layout renders**. Nothing is
  stored. Same `ageYearsOn` as sign-up and the Around 18+ check.
- **A missing birthday no longer opens the app.** It is asked once on "Confirm your age". A future date
  is treated as missing (sign-up and the server refuse one, so it can only be bad data).
- `PRE_LAUNCH_DEV` does **not** bypass any of it. There is no dev override.
- `check:age` pins all of this, including the boundaries below.

**Block screen** (`under-18.tsx`): ATO is for people 18 and older; your account and everything in it are
safe; nothing has been deleted or changed; you'll get back in on your 18th birthday (the date, in the
phone's locale); nothing to do. Actions:
- **Email support** (`support@emgens.com` since 2026-10-22, the same address as You's "Send feedback" and the legal pages).
- **Sign out** (`clearLocalSession`, the onboarding sign-out: ends the session on this phone and clears
  this phone's cache; nothing on the server).
- **Delete my account**, with the line "Deleting your account is permanent. If you leave it, we keep your
  account and everything in it just as it is." It opens the **existing** `DeleteAccountSheet` from You
  (typed DELETE, the list of what goes, the Sign in with Apple revoke line, the `delete-account` Edge
  Function). No new delete flow. The sheet needs only the theme, the session and Supabase, which the root
  layout already provides, so it works without the tabs shell.

It also cancels this phone's scheduled local reminders (`cancelAllScheduledPush`, OS only), so no
notification fires while blocked. `PushRuntime` schedules them again once they are 18. Nothing on the
screen writes to the server unless the person chooses to delete their account.

**Confirm your age** (`confirm-age.tsx`): "ATO is for people 18 and older. We don't have your birthday on
file, so we need it once before you carry on." The same YYYY / MM / DD fields as sign-up and You's Birthday
row (`BornOnFields`), then:
- **18 or older:** saved through the existing guarded path (`setBornOn`: the 18+ check on the phone, then
  `me_born_on_guard` on the server), `me` reloads, the app opens.
- **Under 18:** nothing is sent (the phone check and the server guard both refuse an under-18 birthday).
  The date is held **in memory for this app session only** (`setLocalAgeEntry`, keyed by user id) and the
  layout shows the block screen with that date. On the next launch they are asked again. This is safe:
  it is their own entry, never stored, never sent, and it can only close the app, never open it.
- **Server says under 18 anyway** (`age_under_18`, mapped by `errorMessageForAge`; happens near midnight,
  see the timezone edge): same as above, the block screen.
- Other errors show the existing inline message ("Couldn't save your birthday. Try again.").
- The same Email support, Sign out and Delete my account are on this screen too.

**Dev-test user, root, "Preview as new user".** No bypass. An account with a null `born_on` (including
`@atodev` if its row has none) sees "Confirm your age" once, types an adult date, and is never asked
again. That is one real birthday write through the normal guarded path on that account. Chosen over a
`PRE_LAUNCH_DEV` fixture bypass because a bypass is one more dev-only branch in the routing guard that a
release build must never carry. "Preview as new user" changes nothing here: it reads the real `me`
row, and it refuses writes, so confirm the birthday before starting a preview.

**Dev preview** (`src/app/age-gate-lab.tsx`): mounts the real `Under18View` and `ConfirmAgeView` with
synthetic `born_on` fixtures and a fake "today" (± day buttons). Presets: 17y 364d, exactly 18 today,
18 and 1 day, 29 Feb before / on 1 Mar, null, empty, malformed, future. No `me` row, no birthday save, no
sign-out; the Delete sheet opens with `preview` on, so its final button returns before the delete call.
Reach it from the Dev Hub → Labs ("Age gate preview", inside the `tools` branch, `DEV_TOOLS_AVAILABLE`
only) or `/age-gate-lab?preset=<id>&today=YYYY-MM-DD&bare=1` (route in the `PRE_LAUNCH_DEV` group;
redirects when dev tools are off).

## Boundaries (`check:age`)

- 17 years 364 days → blocked. Exactly 18 today → open. The day before the 18th birthday → blocked.
- 29 Feb births: blocked on 28 Feb of the 18th year, open on 1 Mar (a 29 Feb birth year + 18 is never a
  leap year). `isReadableBornOn` follows the leap rules (÷4, not ÷100 unless ÷400): 2000-02-29 is real,
  1900-02-29 and 2007-02-29 are not.
- null, undefined, empty, malformed, impossible dates, non-strings → confirm. Never throws.
- Future birthday → confirm. Born today → blocked (a real date, 0 years old).
- **Timezone edge.** The app uses the phone's local date; the server (`me_born_on_guard`,
  `is_at_least_age`, wave101) uses UTC `current_date`. Tested both ways around midnight:
  - phone ahead of UTC (Sydney, 21 Oct 09:30 local = 20 Oct 22:30 UTC): the app already opens for a
    21 Oct birthday; the server still says under 18 until 11:00 local. A confirm-age save in that window
    is refused and shows the block screen; it opens on the next try after 11:00.
  - phone behind UTC (Los Angeles, 20 Oct 20:00 local = 21 Oct 03:00 UTC): the server already says 18;
    the app stays blocked until local midnight.
  It settles the same day. No data is lost either way.

## How a tester gets back in

- **At 18, automatically.** Same account, same data, no action. On their 18th birthday (phone date) the
  next app open goes straight to Home. If the app is already open across midnight, it opens on the next
  relaunch or `me` refresh.
- A 29 February birthday opens on 1 March.
- **Age is self-reported.** ATO does not verify it. While blocked they never see You, so they cannot edit
  their birthday. With wave99b applied, the server guard refuses any new date that makes someone under 18,
  so nobody can lower their age. A date that makes them 18+ is accepted (existing self-report trust, the
  same as sign-up).
- A tester who entered the wrong birthday emails support; emci checks and corrects it by hand.

## How a missing-birthday account gets in

They see "Confirm your age", type their birthday once, and the app opens (18+) or shows the block screen
(under 18, nothing saved). They can also sign out, email support, or delete their account from there.

## Ship order

The server side's own order is in `docs/under18-server.md` ("Apply order") and is the one to follow.
In short:

1. **App update first** (this change: the block screen + Confirm your age). Gate green, then OTA. Before
   it, old builds show the app as before. From this update, every account with a null `born_on` is asked
   for it once. Count them first: `select count(*) from public.me where born_on is null;` (read-only).
2. `wave99b_min_age_18.sql` (sign-up and birthday edits need 18). If it is not applied yet, the client
   check in `setBornOn` still refuses an under-18 date on confirm-age.
3. `wave99c_daily_pick_p65.sql`, `wave99d_library_card_vocab.sql`: unrelated; any order.
4. **`wave100` + `wave100b` (the question wave)**, as its own doc says.
5. Make sure every account that must keep working (root, dev-test) has a `born_on`: open the app once
   and confirm it, or as `docs/under18-server.md` says.
6. **`wave101_under18_server_gate.sql` last** (server work), only after the OTA is confirmed running on
   testers' phones. Its `is_adult` treats a null `born_on` as not adult, the same as this app's
   "confirm" state. Applied before the OTA, an under-18 or no-birthday tester on the old app would see
   things fail with no explanation instead of these screens.

To see how many accounts the block affects (read-only):

```sql
select count(*) from public.me where born_on is not null and not public.is_at_least_age(born_on, 18);
```

## Risks

- **Client-only until wave101 is applied.** A modified app can still call the server paths it gates.
- **Self-reported age.** Anyone can claim an earlier birthday. No verification.
- **Birthday edge** (local vs UTC, above).
- **Old app versions** (before the OTA) are not gated on the device.
- **Device data stays** on the phone until they sign out (their own data, on their own phone).
- **Web only:** the shared `BornOnFields` row overflows on narrow web screens (each input ~213 px wide in
  the web preview, so the day field sits off-screen at 375 px). Same on onboarding. iOS is not affected
  (native `TextInput` flexes). Not changed here.
- Seen in a browser preview with synthetic fixtures only (`age-gate-lab`, static web export). Not run on a
  device and never with a real account. Phone check: Dev Hub → Labs → Age gate preview, and an account
  with a null `born_on` (e.g. the dev-test user) sees "Confirm your age" once.
