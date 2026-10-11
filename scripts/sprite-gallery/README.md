# Sprite gallery (the "Streetwear Skin" artifact)

A live page showing every Streetwear sprite: heroes and road enemies animated in all 4 facings,
plus map tiles, props, FX, UI frames and icons. Use it to check sprite upgrades before wiring.

**Link (always the same):** https://claude.ai/artifact/9wjcLv4FQu4S8dwqT2RBho
Private to emci; open it in any browser signed in to claude.ai, or share it from the page's Share menu.

## Update it after sprites change

1. `npx tsx scripts/sprite-gallery/build.ts` — rebuilds sheets + page into `<os tmp>/ato-sprite-gallery`.
2. In Claude Code, publish `<that folder>/streetwear-skin.html` with the Artifact tool, `url` set to the
   link above, and `files` = every `img/*.png` in that folder (one publish takes up to 255 files).
   Read the artifact first (`action: "read"`) — a publish to an artifact the session hasn't read is refused.

What to say to Claude: **"update the sprite gallery"** — it should follow these two steps.

## Notes

- Reads only `assets/play/skins/streetwear/`; never touches the app or its bundle.
- The page template is `page.html` (`__DATA__` is replaced by the build). Hero move labels live in
  its `MOVES` table; update them if a hero's Attack/Skill is redone.
- New hero/creep folders show up automatically. A new clip name must be added to `CLIPS` in `build.ts`
  and to `HERO_CLIPS` / `CREEP_CLIPS` in `page.html`.
