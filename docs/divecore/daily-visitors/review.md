# Daily visitors — copy review (roadmap step 4)

Flag: `VISITORS_COPY_REVIEWED` (`src/play/daily-visitors-bank.ts`, currently `true`). emci reads this and edits
any line in the bank (keep the id, change the text). Ids `dv_<hero>_<nn>` are forever.

Voice: moment voice (`src/lib/voice/moment-voice.ts`) — one concrete modern moment, teased kindly, no
advice, no slang, never "you are" / "always". The visitor is talking.

| # | When it shows |
|---|---|
| 01 | Card subtitle on the day it visits ("arrive") |
| 02 | 1st greeting — with its sticker |
| 03 | 2nd greeting — just a line |
| 04 | 3rd greeting — with its rare look (a tint) |
| 05 / 06 | 4th greeting on, and any re-tap later the same day |

Notice lane: **Visitor** · "<Name> dropped by." (one line on an SE; the "!" over the visitor says tap me)

| Hero | 01 arrive | 02 sticker | 03 line | 04 look | 05 visit | 06 visit |
|---|---|---|---|---|---|---|
| Kael-09 | Said “five minutes away” from the couch. Here now, though. | Brought a sticker. Found it in a jacket I hadn’t worn since spring. | Left my phone on silent so nobody knows I’m here. Very covert. | This colour matched my visor. Now it matches your pet. | Just passing. By passing I mean I opened maps to get here. | Sat in the car for a minute first. Normal visiting stuff. |
| Kitsune | Typed “here” in the group chat, then actually came in. | A sticker for the laptop lid, next to the other twelve. | Saw your light on and pretended it was a coincidence. | Kept this colour for a friend. Turns out that was you. | Left three voice notes on the way. All of them said “almost there.” | Came for one minute. It has been eleven. |
| Corvus | Read the message, didn’t reply, showed up instead. | Sticker. Slightly bent. It lived in my pocket all week. | Muted four group chats to make time for this one visit. | Moss suits a quiet room. Your pet agrees. | Stood at the door scrolling until it felt less like knocking. | Here for the calm. The notifications can wait outside. |
| Neon Viper | Posted “out tonight” and came here. Nobody needs the details. | A sticker, peeled with zero rips. A personal best. | Charged to 100% before leaving. Big night, clearly. | This pink glows in the dark. Mostly in photos. | Took the long way so the playlist could finish. | Battery at 9%. Staying until it says 1%. |
| Archangel | Replied “on my way” and, for once, meant it. | A sticker. Wings included, no extra charge. | Left the read receipts on today. Living dangerously. | A little halo gold. Every room deserves one. | Brought nothing but good news and a cold drink. | Checked the weather twice for a four-minute walk. |
| Crimson Oni | Knocked once, then texted “outside” just to be sure. | Sticker. The corner is chewed. Long story, short bus ride. | Said “no plans tonight” out loud and felt very rich. | Red for loud days. It goes with everything, apparently. | Heard your pet from the street. Had to say hi. | Set three alarms to leave on time. Ignored all three. |
| Elowen | Watered every plant before leaving. Even the plastic one. | A sticker, pressed flat inside a library book. | Opened a tab called “read later” in March. Still later. | Leaf green. Looks good on anyone who naps in the sun. | Took a photo of the sky on the way. It looked fine in person too. | Came in quietly, in case anyone was mid-nap. |
| Maldrath | Said “I’ll be quick.” Brought a snack for the long version. | A sticker. Warm from the pocket, nothing dramatic. | Changed my status to “busy” and came here to do nothing. | Ember orange. For the cosy kind of loud. | Left the group call “for a second.” That was an hour ago. | Here to sit by the fire. The lamp counts. |
| Cyber Shinobi | Arrived without a sound. The doorbell camera saw everything. | Sticker delivered. Stealth rating: one crinkly wrapper. | Turned location sharing off, then told everyone where I was. | Cyan, like a screen at 2 a.m. Calmer, though. | Hit snooze on the outside world for a bit. | Came in through the door. Thought about the vent. Chose the door. |
| Raven | Had a whole speech ready. Just going to say hi. | A sticker. I checked it was straight four times. | Drafted a text, deleted it, came over instead. | Slate blue. A quiet colour for a quiet corner. | Here early. Walked around the block twice to be on time. | Left someone on “seen.” Hiding here a while. |
| Frost Lich | Wore three layers for a two-minute walk. | A sticker. Slightly frosty. Keep it out of the sun. | Set the heating to 21 and called it a personality. | Ice blue. Cool in the good way. | Thawing out by the lamp. Five more minutes. | Brought the cold in with me. Sorry about the draught. |
| Sak | Found the place with no maps. Asked one person. Twice. | A sticker, a bit scuffed. Like my boots. | Sent a thumbs-up instead of a reply. It did the job. | Saddle brown. Goes with dust and long roads. | Packed a bag for a quick visit. Old habits. | Sat on the step a minute before knocking. Nice step. |
| Velkhar (stand-in) | Filling in today. The usual visitor sends their regards. | A sticker. Took longer to choose than the trip took. | Kept a reply in drafts for a week. Sent it from your doorstep. | Violet. Looks like a secret, keeps none. | Covering for a friend again. Happy to. | Brought a book. Did not open it. Good visit. |
| Void Raven (stand-in) | Standing in for someone today. Same snacks, new face. | A sticker. It glows a little when nobody is looking. | Went offline for an hour. The world kept going without me. | Deep indigo. The colour of the last tab still open. | Stepping in again. The rota likes me. | Came for the quiet. Found it. |

### Mecha heroes (stand-ins, added 2026-10-26 — 30 lines to read)

The five mecha heroes visit as stand-ins: the daily rotation of 12 is unchanged. A stand-in comes only on a day
when that day's visitor is the same hero as your own pet; it is picked by day from all 7 stand-ins (Velkhar,
Void Raven + the five mecha), skipping your pet's hero. Their stickers are baked from the streetwear sheets. A name
that would push the notice past 26 characters (today only Ironclad Kabuto) says "<Name> visited." instead of
"dropped by." so it stays one line on an SE.

Flag note: `VISITORS_COPY_REVIEWED` is `true` in code (since the first roster was read), so these 30 lines already
count as reviewed although emci has not read them yet. Setting the flag back to `false` is emci's call.

| Hero | 01 arrive | 02 sticker | 03 line | 04 look | 05 visit | 06 visit |
|---|---|---|---|---|---|---|
| Ironclad Kabuto (stand-in) | Parked the armour by the door. Took the stairs like a person. | A sticker, steel-edged. Laminated, because I overthink glue. | Replied “noted” to everything today. This is the longer reply. | Steel blue, like a cloudy Monday. Looks better on a pet. | Left a very formal voice note. Nobody has played it yet. | Bowed at the door. The doorbell camera did not bow back. |
| Zipline Shade (stand-in) | Came in through the group chat first, then the actual door. | A sticker, slid under the door. Nobody saw. Very smooth. | Muted the chat, kept the notifications on. Complicated person. | Lime, like a highlighter on someone else’s notes. | Slid in so quietly the lamp noticed first. | Rode the cable down. The stairs were right there. |
| Kabuki Gear (stand-in) | Warmed up with a dramatic entrance. The door stuck. | A sticker, fan-folded. Rehearsed handing it over twice. | Practised my hello in the mirror. It still came out loud. | Ember orange on white. A bit much, which is the point. | Took a bow for no reason. Staying for the snacks. | Waved so hard the lamp swayed. Sorry about that. |
| Hush Bot (stand-in) | Beeped once at the door, quietly, in case that is rude. | A sticker, small like me. Peeled it with both hands. | Read the room, then read it again. All clear. | Mint green, soft as a library voice. | Whispered hi. Whispered it again so it would count. | Rolled in with a grapple and a snack. Mostly the snack. |
| Gearbreaker (stand-in) | Pushed the door that said pull. It opened anyway. | A sticker. It survived my pocket, which is a first. | Fixed the squeaky hinge on the way in. No charge. | Amber, like a toaster that pops on the first go. | Dropped the heavy bag by the door. It makes a point. | Sat down gently. The chair did not agree to this. |

Rare-look tint names are "<Hero> tint" and show "From a visitor" in Info → Style.
