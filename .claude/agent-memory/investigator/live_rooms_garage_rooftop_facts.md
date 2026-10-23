---
name: live-rooms-garage-rooftop-facts
description: How Loft is "live" in hideout-stage.tsx and what garage/rooftop need to go live; rails/presence/scripts touchpoints
metadata:
  type: project
---

- Live = hideout-stage.tsx: `liveIsLoft` (line ~201) + LiveLoft + StreetRoomFront branch (~284). Garage/rooftop fall to SnapshotRoom (opacity .55).
- StreetRoomArt/Front take `room: HideoutRoomId`; only loft-specific bits: `win = room==='loft'` (street-room.tsx:122), `sleepOnBed: room==='loft'` (street-room.tsx:255, hideout-stage.tsx:73). Garage/rooftop have no glow/window layers; speaker "spills" are BAKED into neon A/B PNGs by hideout-room-art.ts, no runtime option.
- Rails: RAIL_ROOM_GEOM/ORDER in hideout-rails-model.ts already cover all 4 rooms; Up = nextRoomId, Back/Up are kind 'view' -> viewHideoutRoom (playStore.ts:2855). Already wired.
- Pet only reaches garage/rooftop via Call (callPetToRoom sets viewed_room; resolvePresence call branch has no unlocked check). Schedule/tired/sleep only know loft.
- rooms_unlocked keys: hideout, loft, garage, rooftop (hideout-progress.ts:156).
- check-hideout-rails.ts:91 loop is ['hideout','loft']; check-hideout-rooms.ts:268 geometry loop already covers all 4.
