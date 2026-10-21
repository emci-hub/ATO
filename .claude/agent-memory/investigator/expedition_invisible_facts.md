---
name: expedition-invisible-facts
description: Pet invisible after expedition - presence flips from viewed room to schedule room; touchPet is the completion seam
metadata:
  type: project
---

- Away flag chain is consistent: playStore.petAt:1794 -> pv.away -> petStatus 'away' -> pet-room away; petShown at pet-room.tsx:1020. Sprite code (pet-anim-sprite.tsx) has no blank states.
- resolvePresence (hideout-presence.ts:121-167): interaction/expedition use visitRoom (viewed room); on return it falls to schedule/needs room (loft by clock 14-17, bedtime, tired; hideout if hungry). Viewed room != presence.room => petShown false => "invisible", no marker.
- Completion seam: touchPet playStore.ts:1937-1952 (clears pet_expedition). startCall already imported (playStore.ts:262, used 2871).
- Pins: scripts/check-hideout-rooms.ts block ~211-270 (presence priorities); no expedition-return test exists.
- Not statically proven (no phone repro): medium confidence.
