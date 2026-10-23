# Turf War research (step T0, 2026-10-16)

Short notes from other mobile tower-defense / lane / auto-battler games, for `docs/turf-war-roadmap.md`.
**Layout and feel only. No art, icons or assets are copied.** Most sources are design blogs, wikis and player
forums, not studies; treat numbers as starting points to tune on a phone.

## What to copy, game by game

| Game | What works | What we take |
|---|---|---|
| **Kingdom Rush** (Ironhide) | Empty build spots are drawn on the map; tapping one opens a ring of round, thumb-sized tower buttons around it. A second tap confirms a buy / upgrade; tapping elsewhere cancels at no cost. The skull at the path entrance pulses before a wave; tapping it once shows what is coming, calling it early pays a bonus. The game pauses while a build menu is open. Weak spot: buttons too close to a build spot cause mis-taps; a selected hero is hard to tell apart. | Build menu **at the spot** (ring or small card above it), **tap-to-preview then tap-to-confirm**, outside tap cancels. Wave preview chip that is also the "start wave" button. Keep a fixed gap between HUD buttons and the nearest build spot. Selection must look selected (ring + lift). |
| **Bloons TD 6** (Ninja Kiwi) | On tall screens the tower bar sits at the bottom; on wide screens it moves to the side. The upgrade panel stays hidden until a tower is tapped, so the map gets the room; it opens on the side away from the tower. Lives / cash / round sit in a thin top strip. | Top strip = 3 numbers only (base HP, currency, wave). Upgrade panel is **on demand** and never covers the tower it belongs to. |
| **Rush Royale** / **Clash Royale** (portrait) | Board in the middle, the hand of cards / units at the bottom, the spend meter right above the hand. Every card shows the same three things: what it is, what it costs, whether you can afford it now. All key controls in the lower half for one thumb. | Bottom panel = tower / ability buttons in one row; each button shows **icon + cost + affordable / cooldown state** the same way (dimmed + cost red when not affordable, radial sweep for cooldown). |
| **Plants vs. Zombies** | The designer dropped mazing for fixed lanes because lanes read at a glance; a small loadout picked before the level + one currency. | Keep the path readable: one clear lane shape, enemies never hidden by props, placement spots obvious. A fixed, small loadout per run. |
| **Vampire Survivors / Brotato** | Both ship a toggle for damage numbers and flashing VFX, because numbers pile up into clutter at high attack speed. | Damage numbers small, short-lived, stacked with a small random offset; **merge** rapid hits into one rising number; honour Motion Off / Reduce Motion (and a future "numbers off"). |
| **Cuphead / action bosses** | Each boss attack has its own wind-up pose; a 0.5–1.5 s tell before a big attack reads as fair. | Every boss ability gets a **telegraph**: a ground marker or glow + wind-up ≥ 0.6 s before it lands, distinct per ability, plus a NoticeLane line when a boss enters (our rules ban floating banners). |

## Hit feedback ("juice") rules we will use

- **Hit flash:** the struck sprite tints white / bright for ~60–80 ms (one or two frames). Per-enemy, never all at once.
- **Hit stop:** only for big moments (boss hit, boss death, base hit), 40–80 ms. On every small hit it reads as lag.
- **Screen shake:** small, decaying, scaled to the event (base hit, boss slam, boss death). Never on normal hits.
  Off under Motion Off / Reduce Motion.
- **Impact sparks:** a 3–6 frame burst at the contact point, short and contained (long bursts cover the lane).
- **Death:** a short pop / dissolve + a small coin or shell pop if a reward drops (no new reward, just showing the
  existing one).
- **Health bars:** thin bar over the enemy, shown only once it is damaged; bosses get a wide bar in the top region.
  A short pale "chip" trail drains behind the bar to show recent damage — it must drain fast and never look like
  health that comes back. Bar empty = dead, no exceptions.
- **Projectiles:** visible travel (not instant) for slow towers so the player sees cause → effect; fast towers can be
  a streak.
- **Feedback sits above or beside the finger,** never under it (a tap on a build spot shows its menu above).

## Layout and reach

- Thumb reach (Hoober's grip field study; common zone model): bottom third / lower centre is easy, top corners are hard,
  the far top corner hardest. **Primary actions low** (tower / ability row, start wave, speed), **rare or risky actions
  high** (pause / quit, settings).
- Tap targets: Apple HIG 44 × 44 pt minimum (Material 48 dp); keep ≥ 8 pt between targets. Our Hideout rails already use
  60 pt buttons with 8 pt gaps.
- HUD density: show only what is needed often; make what stays larger, not denser. Cut by default.
- Modals: return-to-play is one tap; result screens have one primary button low on the screen.

## Sources

- Kingdom Rush UI review (2018): https://emilym.space/thumbelina-hurts-mobile-ui-blog/2018/6/26/kingdom-rush-a-tower-defense-trilogy-with-ui-design-approaching-perfection-and-entertainment-worth-missing-bedtime-for
- Kingdom Rush official site (pause while building): https://kingdom-rush.net/
- Kingdom Rush wave skull / early call: https://www.levelwinner.com/kingdom-rush-frontiers-tips-tricks-strategy-guide/ · https://kingdomrushtd.fandom.com/wiki/Encyclopedia
- BTD6 tower bar / upgrade panel (player forums): https://steamcommunity.com/app/960090/discussions/0/2986411348905563000/ · https://steamcommunity.com/app/960090/discussions/0/3114772813477599425/
- Rush Royale layout: https://en.androidayuda.com/juegos/recomendados/rush-royale/ · https://gamingonphone.com/guides/rush-royale-tower-defense-td-beginners-guide-and-tips/
- Clash Royale UX breakdown: https://discover.therookies.co/2020/02/24/game-design-ux-best-practices-detailed-breakdown-of-clash-royale/ · https://mechanicsofmagic.com/2023/04/19/short-exercise-visual-design-of-games-8
- Plants vs. Zombies design history: https://en.wikipedia.org/wiki/Plants_vs._Zombies_(video_game)
- Damage-number toggles: https://vampire.survivors.wiki/w/Options · https://www.ludo.guide/guide/brotato/getting-started/controls-keybindings/accessibility-options · https://www.wayline.io/blog/unity-floating-combat-text
- Hit stop / shake / flash: https://inkharbor.itch.io/hitfeel-kit/devlog/1704617/game-feel-checklist-for-godot-4-24-small-fixes · https://egmatic.com/blog/how-to-make-your-game-feel-good · https://jamzo.com/blog/game-feel-and-juice
- Boss telegraphs: https://gdkeys.com/keys-to-combat-design-1-anatomy-of-an-attack/ · https://bugnet.io/blog/how-to-design-enemy-attack-telegraphs · https://buildaboss.top/en/challenges/build-a-boss-boss-battle-challenge
- Health-bar pitfalls: https://us.forums.blizzard.com/en/d4/t/is-bleed-bugged/3495
- Thumb zone: https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/ · https://globalbridgelabs.co.uk/blogs/thumb-zone-design · https://www.wandr.studio/blog/mobile-game-ui-design
- Tap targets: https://dequeuniversity.com/rules/attest-ios/1.0/touch-target-size · https://adrianroselli.com/2019/06/target-size-and-2-5-5.html
