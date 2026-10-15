# Circle visits — copy review (roadmap step 6)

Ships with `CIRCLE_VISITS_COPY_REVIEWED = false` (`src/play/circle-visits.ts`). emci reads this, edits any
line in `CIRCLE_UI`, then flips the flag. Voice: short, plain UI copy; the one line with a moment in it (the
gift) follows the moment voice (`src/lib/voice/moment-voice.ts`). Curly apostrophes only.

| Where | Text |
|---|---|
| Rail button (Hideout room, 5th) | Circle |
| List card title | Circle visits |
| List card note | Pets visit when you both switch sharing on. Only your pet and room go. |
| Row status | Sharing · Waiting on them · Not sharing |
| Row button | Visit |
| List: loading / empty | Checking your Circle… · No one in your Circle yet. Scan a friend in from the Circle tab. |
| List: signed out / not live / offline | Sign in to visit your Circle. · Circle visits aren’t switched on yet. · Can’t reach your Circle right now. |
| A visit that can’t open | Their Hideout hasn’t synced yet. · Sharing is off on one side. |
| Notice lane while visiting | @name’s Hideout · Look around. Their pet stays put. |
| Dock while visiting | Leave a gift / Gift left · Back home |
| Gift refused | They switched sharing off. |
| Gift card | From @name · New sticker · <Hero> (or Circle stamp) · “Their pet left this by the door and didn’t even text first.” · It’s in your sticker book: Info → Style. · Keep it |
| Sticker book | Circle gifts: N. · VoiceOver: “<Hero> sticker, From a Circle friend” |
