---
name: visitor-roaming-facts
description: Hideout daily visitor is a static idle actor (no roaming/time rule); where the pet walk loop, bounds, depth and checks pin it
metadata:
  type: project
---

- Visitor: src/play/daily-visitor-ui.tsx DailyVisitorActor, idle clip only, face 'w', plain absolute View at VISITOR_SPOT [236,430] (daily-visitors.ts:26). Day-based rotation, no time-of-day rule, nothing about position persisted.
- Pet walk loop pet-room.tsx ~595-757 uses planHideoutStep(hideout-iso.ts ~758) with geom + bounds; position on Reanimated artX/artY; `feet` state polled 80ms for depth. Visitor narrows pet via walkBoundsRef (~983-989).
- roomGeom() (hideout-stage.tsx:71) re-parses the map each call, so hideoutGridFor's WeakMap cache misses on fresh geoms.
- Hard regex pins on pet-room.tsx: check-daily-visitors.ts:314-318, check-decor-slots.ts:320-343 (draw order strings, decorLayer call), check-hideout-rails.ts:146-161, check-circle-visits.ts:252-253.
- Pet clips: only idle/walk/dash/attack/skill/hurt (pet-actor.ts:23); no wave/talk/sit. 8 idle facings, 4 walk dirs.
