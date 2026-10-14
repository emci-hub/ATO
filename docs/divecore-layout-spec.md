# Divecore layout spec (Phase 1, 2026-10-14) — APPROVED by emci (2026-10-14), being built

> **emci's decisions (2026-10-14):** accept all recommendations — (a1) remove the Block (Phase 3 does the
> nav), (b1) fixed Turf War board, spec heights OK. Plus, from review of the previews: Turf War keeps the
> **TURF WAR header and the full lede** with the board **right under them**; the Hideout **room fills the
> stage** (like the Underground) with **Hideout / Loft / Call on their own row**, and on small phones the
> view **follows the pet**. Section 2a is what Phase 1 actually built.

The one layout every Divecore game screen follows. Based on the measured audit (`docs/divecore-audit/measured.md`, which checks the static `layout.md`)
and rules R1–R12 in `docs/divecore-ui-research.md`. It replaces the numbers in `layout.md` §8 where they
differ (§8 kept today's bar heights; this spec adds the NoticeLane and target heights). Mockups: `docs/divecore/mockups/*.png`
(regenerate with `python3 docs/divecore/mockups/draw-mockups.py docs/divecore/mockups`).

## 1. Region order (every game screen)

```
┌ safe area top (status bar / Dynamic Island) — art may paint under it, no controls
├ TopBar        status only: currencies / wave / stop. Fixed height.
├ NoticeLane    ONE notice, one line. Reserved and always present (empty or idle content when quiet).
├ Stage         the map / room / board / picture. Biggest region. Size computed ONCE.
├ ActionDock    the screen's actions; the primary one is here (bottom third).
├ TabBar        places (not actions). Hidden only on fullscreen arenas.
└ safe area bottom (home indicator)
  + FloatLayer  tips, sheets, speech — float over the Stage, never resize anything
  + ModalLayer  confirms, the tutorial, the reveal — block input underneath
```

Rules:
- A region's height is fixed per screen. Content changes inside it; it never grows, shrinks or collapses
  (pause, loading, a notice, a hint, a coach line, a first-visit tip — none of them change a region).
- Nothing goes inside the Stage except stage content (the art, the pet, units, spots painted on the art).
  Notices, banners, coach lines and hints go in the NoticeLane; tips and sheets go on the FloatLayer.
- A **screen switch** (Turf War setup → wave) may change the region set once, at that moment. The map
  itself does not move or resize across the switch (section 5).

## 2. Heights (pt)

Safe areas (standard iOS values, used for every measurement): **Pro Max 430×932: top 59, bottom 34. SE 375×667: top 20, bottom 0.**
TabBar = 56 + max(bottom inset, 8). Arena bottom pad = max(bottom inset, 8).

| Region | Tabbed screen (Hideout, Block, Locker, Store) | Turf War setup | Turf War wave (arena) | Dive (arena) |
|---|---|---|---|---|
| Safe top | 59 / 20 | 59 / 20 | 59 / 20 ¹ | 59 / 20 ¹ |
| TopBar | 44 | 44 | 44 | 44 |
| NoticeLane | 40 | 40 | **28** (thin) | **28** (thin) |
| **Stage** | **635 / 435** | **579 / 379** | **647 / 447** | **615 / 415** |
| ActionDock | 64 (one row of 48) | 120 (setup peek + Call wave) | 120 (two rows of 48) | 152 (Bag·Heat row + two rows) |
| TabBar / bottom pad | 90 / 64 | 90 / 64 | pad 34 / 8 | pad 34 / 8 |
| **Total** | 932 / 667 | 932 / 667 | 932 / 667 | 932 / 667 |
| **Stage share** | **68 % / 65 %** | 62 % / 57 % | **69 % / 67 %** | **66 % / 62 %** |
| Today (audit) | Hideout 66 % / 63 % | board 44 % / 53 % | board 44 % / 31 % visible | 50 % / 41 % |

¹ In immersive mode the SE status bar hides and its 20 pt top inset becomes 0 — `useStageFrame` uses the
real inset, so the Stage gets those 20 pt (467 / 435). Pro Max keeps 59 (Dynamic Island).

**Stage target: ≥ 60 % of screen height on every game screen** (Turf War setup on SE is the one exception at
57 %, and its board is still the full 359 pt — the same as the wave).

Notes per screen:
- **Hideout**: the status strip (name · stage · Hunger · Mood · grade, 36 pt today) becomes the NoticeLane's
  **idle content**. A notice replaces it for its few seconds, then the strip returns. This is how the
  Hideout gets a NoticeLane *and* a bigger room (635 vs 613 today; SE 435 vs 417). The Hideout / Loft / Call
  row stays stage content (room navigation drawn on the room's floor band).
- **Turf War board** is square and width-sized: 414 (Pro Max) / 359 (SE), 8 pt side gutters. The Stage is
  taller than the board; the board is **top-anchored** and the street art continues below it (stage content).
- **Dive**: Bag + Heat (today two rows + a "Powers 0/6" line, 250 pt dock) fold into one 24 pt row on top of
  the two button rows. The picture fills the Stage (no ink letterbox bands).
- **Pet games** are fullscreen arenas: TopBar 44 · NoticeLane 28 (the rules hint, one line; full rules behind
  "?") · Stage · ActionDock (Train: meter + TAP, 120) · pad.
- **List screens** (Block if kept, Locker, Store) use the tabbed layout; their "Stage" is the scroll body.

### 2a. What Phase 1 built (src/play/stage-frame.ts `REGIONS`)

Phase 1 wraps today's contents without redesigning them, so bars keep today's heights; targets land in Phases 2–5.
TAB = 60 + max(bottom inset, 6).

| Frame id | TopBar | NoticeLane | ActionDock | Bottom | Stage 430×932 | Stage 375×667 |
|---|---|---|---|---|---|---|
| `hideout` | 56 (resource bar) | 40 (pet strip / swipe hint) | 120 (room row 56 + Feed·Info 64) | TAB | **563** | **365** |
| `turf-setup` | 56 (resource bar) | 40 (coach line) | 64 (Setup ▲ + Call wave) | TAB | **619** | **421** |
| `turf-wave` | 56 (HUD) | 40 (coach / paused line) | 64 + TAB (Cast + Pounce·1×·2×·Leave) | — | **619** (same) | **421** (same) |
| `dive` | 109 (stop-track panel) | 28 (find / caption line) | 258 | inset | 444 | 252 |
| `pet-game` | 88 | 28 (empty for now) | 208 | inset | 515 | 323 |
| `list` (Block, Locker, Store) | 56 | 40 (empty for now) | 0 | TAB | 683 | 485 |

- **Turf War:** one stage for setup and wave (the wave dock = setup dock + tab bar). Stage = header
  (TURF WAR + full lede, 112) + the square board right under it: `boardSide = min(stageW − 24, stageH − 112)`
  → **406** on Pro Max (top y 267), **309** on SE (top y 228). Identical in setup, wave and pause (measured).
  Turf keeps a 40 pt lane in the wave too (not 28) so the board never moves.
- **Hideout:** the room covers the stage (`hideoutCoverScale`) and a lazy camera (`hideoutCameraTop`) keeps
  the pet's feet between 40 % and 88 % of the stage, floor first. Pro Max shows ~80 % of the room height,
  SE ~60 % (Play / Stash scroll into view when the pet walks up).
- **Dive** lost 24 pt of stage vs before (468 → 444 / 276 → 252) because the 28 pt lane is new and the dock is
  still 258. Phase 5 trims the dock to the 152 target (→ ~615 / ~415).

## 3. Spacing, safe areas, taps

- **Spacing scale: 4 · 8 · 12 · 16 · 24** (no other values). 8 = between neighbours and side gutter for the
  map; 16 = text gutter and dock padding; 12 = inside panels; 24 = between groups.
- **Tap targets ≥ 44×44 pt** (visual + hitSlop); **primary buttons 48 pt tall**, full-width or half-width.
  8 pt between tappable neighbours. Today's misses: Dive back (40), Dive "Gear info" / "How Dive works" (38),
  "‹ Exit Play" text link.
- **Primary action in the bottom third**, always in the ActionDock, never reached by scrolling
  (Call wave, Ride, Head up, Cast, Feed, Claim).
- **Top corners: status only.** ⚙ leaves the TopBar in Phase 3 (Exit lives under ⚙).
- **Safe areas:** art and backgrounds paint under both insets; TopBar content starts below the top inset;
  the TabBar / dock pad sits on the bottom inset; landscape left/right insets are honoured by the Stage width.
- **Text in regions:** one line per notice (`numberOfLines={1}`), TopBar values in fixed boxes, no region
  grows for long copy (word limits come in Phase 5).
- Fonts and look unchanged: Departure Mono + Rajdhani / Pixelify (Street), cyan frames, solid buttons,
  fullscreen arenas. Reduce Motion = gentle (fades, small moves), never still, never a size change.

## 4. The stage frame (what Phase 1 builds)

```
stageH = windowH − insets.top − topBar − lane − dock − (tabBar ? 56 + max(insets.bottom, 8) : max(insets.bottom, 8))
stageW = windowW − insets.left − insets.right
```
Computed once per screen id from the window size and safe area, **before first paint**; recomputed only on a
rotation or window-size change. Never from `onLayout` of content, never from a notice, tip, pause or load.

## 5. Turf War setup → wave

Built (b1 + emci's tweak): header + lede + board in the stage, top-anchored; Call wave + Setup ▲ in the
dock; drops, maps, replays, effects, the wave card and "Why?" in the Setup sheet; tower pad panel and the
won / lost cards float above the dock. The board's top y is **267 (Pro Max) / 228 (SE)** in setup, wave and pause.

## 6. Decisions (answered 2026-10-14)

- **(a) The Block:** (a1) remove it, Hideout is home with a Claim chip — **Phase 3** (nav). Phase 1 keeps the
  Block as a list screen. Mockup `docs/divecore/mockups/question-a.png`.
- **(b) Turf War setup:** (b1) fixed board + Setup sheet — **built in Phase 1**, with the header and full lede
  kept above the board. Mockups `question-b.png`, previews in the PR.

## 7. What stays the same

No economy, odds, rewards or save changes. No new native dependencies (OTA-safe). Art rules, fonts, colours,
fullscreen arenas unchanged. Nothing moves outside `src/play` (play-isolation).
