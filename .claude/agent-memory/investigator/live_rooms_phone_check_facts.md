---
name: live-rooms-phone-check-facts
description: Speech bubble ungated vs pet render gate; Call/Sleep/Light conditions in resolvePresence and rails (2026-10-16)
metadata:
  type: project
---

- Pet render gate: pet-room.tsx:1142 (presence.room===viewed). Street speech bubble pet-room.tsx:1272 has NO such gate -> shows when pet elsewhere. Idle chatter (pet-screen.tsx:622-643) only checks sheet/status/away, not presence.
- resolvePresence order (hideout-presence.ts:104): interaction, expedition, skipSchedule(<child: egg/baby/ -> home, BEFORE call/sleep), hungry(hunger<=1 -> hideout), tired(mood<=1 -> loft), sleepChosen, call, schedule. Call/Sleep silently lose to these; callPetToRoom (playStore.ts:2866) only checks expedition+unlocked, no stage/hunger check, no feedback.
- Light (toggleLoftLamp) only toggles lamp_on; glow drawn only `night && lampOn && art.glow` (street-room.tsx:147); night = clockNight && !wokeUp || sleepByChoice (pet-screen.tsx:467) -> invisible by day or after waking pet.
