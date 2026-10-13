# ATO Story v3 (templates first)

Approved by emci, 2026-10-13. These files are the source of truth for anyone (human or AI) writing or checking Story.

| File | What it is |
|---|---|
| `writer.md` | Writer bible + system prompt (§1–§8). Paste that block for any polish model. |
| `rulebook.md` | Slot specs, compatibility, coherence, QA gates, card 6. |
| `full-samples.md` | Four approved reference stories. Story 2 is **Captain Table for Three**. |
| `topics.md` | 49 topics in 7 occasion groups. ⭐ = first 14 to author. |
| `grammar-demo.json` | Tracery-style grammar demo (syntax only; Apache-2.0). |
| `sources.md` | Licenses and credits. Keep the Tracery Apache-2.0 notice. |
| `TODO.md` | Topics not yet authored, and the map-category high/low decision. |

**Engine:** `src/lib/story-v3/`. Templates are primary. Gemini/DeepSeek polish is behind `STORY_AI_POLISH` (default off).
