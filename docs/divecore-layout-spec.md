# Divecore layout spec (Phase 1, 2026-10-14) — DRAFT, waiting for emci's OK

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

### Phase 1 interim values (skeleton only, no redesign)

Phase 1 wraps today's contents without redesigning them, so where today's content is taller than the target
the skeleton reserves today's height and the target lands with the content trims in Phases 2–5:

| Screen | Region | Phase 1 (pt) | Target |
|---|---|---|---|
| All tabbed | TopBar (resource bar today 52 + 4 margin) | 56 | 44 (Phase 3) |
| Dive | TopBar (stop track panel) | 105 + 4 | 44 (Phase 5) |
| Dive | ActionDock | 250 + 8 | 152 (Phase 5) |
| Turf War wave | ActionDock | ≈148 / ≈122 (incl. pad, read off the screenshots) | 120 + pad |
| Turf War setup | (scroll kept until question b is answered) | — | 120 dock |

The Stage is still computed once from these numbers, so it can never shrink while the screen is up.

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

With question (b) = fixed board: the board's top y is the same in setup and wave — **143 (Pro Max) / 104 (SE)**
(= top inset + TopBar + 40). In the wave the lane is 28, so the Stage starts 12 pt higher and keeps a 12 pt
top pad. The dock is 120 in both; only the TabBar leaves (screen switch). The board never moves or resizes.

## 6. Open questions for emci (asked before, still unanswered — please answer before Phase 1 step 4)

### (a) Remove the Block, or keep a small Block tab?
Mockup: `docs/divecore/mockups/question-a.png`

- **(a1) Remove it — the Hideout is home.** The pet status strip sits in the NoticeLane with a **Claim**
  chip (Basecore research) at its right end. Tabs: Turf War · Hideout · Locker (+ Store). One entry per place;
  the Underground stays a spot in the room. Fewer screens, the map is the first thing you see.
- **(a2) Keep a small Block tab.** A short list (pet, Turf War, Underground) with **Claim** as the dock action.
  Keeps a "what's ready" overview, but it is a second way into every place.
- Recommendation: **(a1)**. Both keep Claim one tap away; (a1) removes three duplicate entry points.

### (b) Turf War setup: fixed board + one Setup sheet, or keep setup scrolling?
Mockup: `docs/divecore/mockups/question-b.png`

- **(b1) Fixed board + Setup sheet.** The board sits where it will be during the wave; the dock is the same
  120 pt in setup and wave and holds **Call wave** plus a "Setup ▲" peek; map, drops, replays and effects
  open in a sheet on the FloatLayer. No scrolling, Call wave always in reach, and the board never jumps at
  the switch.
- **(b2) Keep setup scrolling** (today): title, lede and board, then cards; Call wave is ~650 (Pro Max) /
  ~870 (SE) pt down. Lowest effort, but it is the cause of the SE wave bug (146 pt of board hidden).
- Recommendation: **(b1)**.

## 7. What stays the same

No economy, odds, rewards or save changes. No new native dependencies (OTA-safe). Art rules, fonts, colours,
fullscreen arenas unchanged. Nothing moves outside `src/play` (play-isolation).
