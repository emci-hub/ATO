# Streetwear credit burn — working state (2026-10-10)

Raw PixelLab exports live here; clean copies go to `assets/play/skins/streetwear/` (cast layout).

## IDs
- Anchor (chosen A): char 6f045b3a-1e1a-47b4-b660-fd4ea7bc9453 (v3, 3 gen). Rejected B 513135d7-4c76-4624-8c78-c44bc523ffc4, C 9434ae64-0e11-47b3-85e0-d49d6f06cac8
- Tileset asphalt→sidewalk ea38ba0d-3230-43c4-8e03-e2dcb6612a0b (base asphalt a95d8989-5e2e-45fc-931a-271b22bea62d, sidewalk 1e472d4f-ffa1-4e44-8ea0-ba1df38b0278)
- Tileset sidewalk→lot v1 (REJECTED, all mustard) 0d0a757e-1ee8-41ca-894e-5a71046e8d0a
- Tileset sidewalk→lot v2 (reroll) 8e22f23a-cbf6-4192-a253-2ed43f27c193
- Path tiles road 19584eee-7fdf-49d1-87a9-3e6fdf2b7be1
- Sidescroller brick graffiti 2c9a9b9d-db47-4a63-87a5-7039a7401c0a
- Props A 602abbb8-4bd4-42f6-8748-e8ee1da0647f, Props B 1c2ab150-7b6e-49c4-943c-7c78ecc6f20d
- FX+icons 32px 26ddb085-1d4d-427a-a704-1a520fdac9f8
- Splat v1 (REJECTED ring) job d92ddf66-aeb4-4886-b8d8-99021886d301; splat v2 job 2907a0e8-415b-494d-9a75-1dc76dc6f13a
- UI panel c347ea5c-49d6-43ea-bbd6-3efc2c11f83c, buttons c21f4eda-b0a3-4a73-bdc3-be1e0cd8be06, health bar 8975e9f3-1df2-4d31-a0c5-a981612b6a3b, card fe1978f5-b130-45ed-8599-2fc35b9e4a21
- Restyle edit jobs: 8143ed97 (corvus,archangel,oni,aurex), c6fe6cd0 (kitsune,cyber-shinobi,elowen,kael), 86602f34 (maldrath,morwen,neon-viper,raven), 6cb0b7f8 (sak,frost-lich,velkhar,void-raven)

## Hero characters (v3 from restyled front, 128px)
- corvus 4ae9fe40-9152-41ef-b839-fc61d7a479c7
- archangel 25a894bb-d246-4f14-9a64-088451118525
- oni 2c90d0a1-0ef7-405e-bd97-4a2ddaa13a34
- aurex 7dafc460-cf9f-40c6-8cfc-4aa05c0e364f
- kitsune 19ed908a-f173-45f4-9490-dd4a5e58f254
- cyber-shinobi 95bbe1d1-8532-4831-890e-51a9ff22ad09
- elowen 535363cd-6b15-4daf-b8de-6f206b6a3747
- kael dc37a135-5822-46d1-b3a8-022ccc7c2b12
- maldrath 62e9abf1-0ac9-4538-81e4-a0d5ba57a638

- morwen 8eada467-7b76-4adc-99ba-0afb310eb6f2
- neon-viper add42923-e981-4912-b2ac-697062c67434
- raven 685ebac8-e1ad-414f-9b67-3fbf25e42621
- sak 20b16c7b-7ca6-4182-9e3c-00168386e5bd
- uploads (3 days): frost-lich upload:59b43f39-f162-4bd3-abb9-5836a13bd145, velkhar upload:3004ba5a-eab5-44be-ad05-f6e11e8323f4, void-raven upload:fecf86b9-2f44-417f-abd6-ed26c3b92759
- creep fronts (cast, 40-44px): village-girl upload:a48bfc17-932e-4da3-831d-b440e3d6bc45, wizard upload:1a28e744-7b57-40dd-b67f-d24086062db0, knight upload:b66fdc1c-75fc-49b4-8651-6a9ad7812dfe

- frost-lich 60fd62b1-1d55-4a44-8ef7-ffc8c8e65451
- velkhar 358cfbd9-31c7-49e3-ac71-2c19ed9b1bd8
- void-raven 5e3b9e12-997e-4d5c-9efa-c38707e9cc4a

## Ingested (hero.sh): corvus, archangel, oni, aurex, kitsune, cyber-shinobi, elowen, kael, morwen, maldrath
## + neon-viper, raven ingested. ALL ingested heroes normalized to 192x192 (normalize.js, feet aligned) — hero.sh now does it.
## + sak, frost-lich, velkhar ingested. void-raven: all queued except HurtSK West -> group 3c4792c9-c8d3-4237-94bc-a92d137cbbe6.
## ALL 16 HEROES INGESTED + normalized.
## WEAPON PASS (emci: each hero uses its own weapon; outranks the NS pass)
Root cause: Attack/Skill used cross-punch/fireball skeleton templates = unarmed poses, so weapons drop/glitch.
Fix: animate_character mode=v3 + action_description, frame_count 8, keep_first_frame=false. Names AttackW / SkillW (E+W) and AttackW_NS / SkillW_NS (N+S);
hero.sh WEAPON=1 maps those (and drops AttackSK/SkillSK). Raven keeps AttackSK (emci likes it), only Skill becomes SkillW.
NS pass from elowen on: only Idle_NS, WalkSK_NS, DashSK_NS, HurtSK_NS (attack/skill come from the weapon pass).
Moves:
- corvus (no weapon, crow): A "lunging forward and slashing with a clawed gloved hand while the crow flaps" / S "throwing both arms forward to release a swarm of black crows"
- archangel (one-handed flaming sword): A "a fast diagonal sword slash with the flaming sword, then back to guard" / S "raising the flaming sword overhead with wings spread, then a heavy downward strike"
- oni (single katana): A "a quick horizontal katana slash, then back to guard" / S "a two-handed rising katana slash with a burst of red flame"
- aurex (greatsword, flames): A "a heavy two-handed greatsword swing in a wide arc" / S "a spinning greatsword slash trailing flames"
- kitsune (two katanas): A "drawing both katanas and slashing in a fast X cross" / S "a dashing dual-katana flurry of slashes"
- cyber-shinobi (katana on back): A "drawing the katana from the back and slashing forward" / S "a lightning-fast iaido draw slash with a glowing trail"
- elowen (sword): A "a quick forward sword thrust then recover" / S "a spinning sword slash with green leaves swirling"
- kael (glowing cyan blade): A "a fast slash with the glowing energy blade" / S "a charged overhead slash releasing a cyan energy wave"
- maldrath (greatsword): A "a slow heavy overhead greatsword slam into the ground" / S "a wide two-handed greatsword sweep"
- morwen (staff): A "swinging the staff forward like a club" / S "raising the staff and casting a purple magic bolt forward"
- neon-viper (unarmed): A "a fast spinning roundhouse kick" / S "a neon-charged dash punch"
- raven (big axe): keep AttackSK / S "a heavy two-handed overhead axe chop slamming down"
- sak (ice sword): A "a quick ice sword slash" / S "thrusting the ice sword forward as ghost wisps rush ahead"
- frost-lich (ice greatsword): A "a heavy ice greatsword swing" / S "planting the greatsword and raising a burst of ice"
- velkhar (skull staff): A "striking forward with the skull staff" / S "raising the skull staff and casting purple flame forward"
- void-raven (scythe): A "a wide two-handed scythe sweep from back to front, then recover" / S "a full spinning scythe slash in a circle"

Weapon test groups (east only so far; add west/N/S via animation_group_id + same action_description):
archangel AttackW ff796e32-a66f-46c8-bacb-e4868fea5b3b; oni AttackW 4e1188b7-f759-409c-9e07-2c36bab5d95f; kitsune AttackW 1d5b2e24-de80-4179-8e81-706d82d1ed28; raven SkillW 95944a8e-5521-4e8b-8b9c-978294570369; void-raven AttackW 70225ffc-822f-475f-ad19-14f7e6e74933
(Adding N/S into the SAME group is fine: ingest maps AttackW -> Attack for any facing.)
Weapon groups (desc must match when appending):
| hero | AttackW group | SkillW group | queued dirs |
| archangel | ff796e32-a66f-46c8-bacb-e4868fea5b3b | 81d7fa40-e4e6-41ce-82d7-7da413ad6233 | A E,W  S E,W |
| oni | 4e1188b7-f759-409c-9e07-2c36bab5d95f | 9462230d-ecd6-4ba0-9c2f-3d0f78d73d44 | A E,W  S E,W |
| kitsune | 1d5b2e24-de80-4179-8e81-706d82d1ed28 | 434637c3-7ba7-4154-875e-ad06b9bb25ad ("a dashing flurry of slashes with a katana in each hand") | A E,W  S E |
| raven | (AttackSK kept) | 95944a8e-5521-4e8b-8b9c-978294570369 | S E,W |
| void-raven | 70225ffc-822f-475f-ad19-14f7e6e74933 | c89e4879-1ad1-46c0-a039-cb53c9b229ac | A E,W  S E,W |
| corvus | ddfebf9a-deef-445d-9643-37275b69785f | e686b5fd-a21b-4f42-8633-d1d6d20d2c87 | A E,W  S E,W |
| aurex | 5df70183-82cc-45b5-bd32-dd94125eb7e3 | 22ab82da-47b2-4bba-84d9-8f30c6655664 | A E,W  S E,W |
| cyber-shinobi | aad5f9d2-f574-4ab4-ba7d-a2358c799669 | 53a4cb39-642d-421e-85a0-d9bf94531d9a ("a lightning-fast iaido draw slash with a glowing blue trail") | A E,W  S E (needs W) |
| elowen | aa09a79e-fb8f-4bbd-98cc-73323dbb5753 ("a quick forward sword thrust, then recover") | eaf059be-57c2-4e4f-a45e-c817bb128a25 ("a spinning sword slash with green leaves swirling around") | A E,W  S E,W |
| kael | 3d6e3eb1-e629-420c-83e2-72dd6f23d70e ("a fast slash with the glowing cyan energy blade") | 8be3e0b8-3b77-4c15-aef4-92085b9a9881 ("a charged overhead slash with the energy blade releasing a cyan energy wave") | A E,W  S E (needs W) |
| maldrath | 80c27099-4b22-46f0-8533-f3f7c265897b ("a slow heavy overhead greatsword slam into the ground") | a89eb2c2-4e6e-4959-9842-336f98ffaafc ("a wide two-handed greatsword sweep") | A E,W  S E,W |
| morwen | 986308f4-0ee4-4989-82ea-caaed8dc6ad5 ("swinging the wooden staff forward like a club") | e7ba44a9-bb97-4ad1-908a-967b9f8524f1 ("raising the staff and casting a purple magic bolt forward from its tip") | A E,W  S E,W |
| neon-viper | 6e91f8a4-6e61-4dde-a305-e4124dbecabf ("a fast spinning roundhouse kick") | c4059359-17e6-4174-833c-ed20c4d6a389 ("a neon-charged dash punch with a pink and teal energy trail") | A E,W  S E,W |
| sak | aced066b-86e7-4a5b-b9ab-4de96ae7160d ("a quick ice sword slash") | 7fc6065f-307b-4e01-a9a2-e0a4f55d8b19 ("thrusting the ice sword forward as ghost wisps rush ahead") | A E,W  S E,W |
| frost-lich | 0c6f27e5-6d38-4954-aac7-73a849b3f49a ("a heavy ice greatsword swing") | 15d955da-b2e4-4d0d-be86-e0567e707136 ("planting the ice greatsword into the ground and raising a burst of ice spikes") | A E,W  S E (needs W) |
Ingested WEAPON=1 also: elowen, kael, maldrath, morwen.
| velkhar | 61915507-cae4-456c-81f6-a2fe42915f24 ("striking forward with the skull staff") | 6b674f3a-dca1-4f5d-a05b-bb2e0954800e ("raising the skull staff and casting purple flame forward") | A E,W  S E,W |
Weapon-holding idle rerolls (ingest with IDLE=IdleW; add N/S into the same group): void-raven IdleW 5d87467a-0aad-4804-bcc5-9076df712368 ("standing idle, breathing slowly while holding the scythe upright, cloak gently moving"); velkhar IdleW 76238a54-b583-4ba7-bb87-9d3f00898d79 ("standing idle, breathing slowly while holding the skull staff upright, purple flames flickering").
ALL 16 E/W WEAPON INGESTED (committed f43d8fa9). (A) progress: FULL 4-DIR INGESTED: archangel, oni, kitsune, corvus, aurex. void-raven + raven ingested (weapon 4-dir; still need Idle(raven)/Walk/Dash/Hurt NS in (B)). elowen, kael, maldrath, morwen, neon ingested (weapon 4-dir; B pending). Queued: cyber A+S; sak A+S; frost A+S; velkhar A + S north.
(A) ALL QUEUED. cyber ingested 4-dir complete.
(B) order: elowen HurtSK_NS; kael, maldrath, morwen, neon, raven, sak, frost: Idle_NS+WalkSK_NS+DashSK_NS+HurtSK_NS; velkhar, void: Walk/Dash/Hurt NS. (C) creeps.
(A) done+ingested for all except velkhar (pending). FULL 4-DIR COMPLETE+INGESTED: archangel, oni, kitsune, corvus, aurex, cyber, kael, elowen, maldrath, morwen. neon ingested complete. (B) queued: raven all (one job 35ffd10b FAILED, likely Idle_NS group 09d9b0ca-cf4c-4875-9761-505a9152a9df — check counts on ingest, requeue missing dir); sak all; frost Idle/Walk/Dash (Hurt next); raven Idle north REQUEUED (re-ingest raven after); sak, raven, frost ingested complete. velkhar all queued; void all queued. ALL 16 HEROES COMPLETE 4-DIR + INGESTED. Creeps: girl, wizard, knight ALL NS QUEUED (everything queued). Ingest each with IDLE=IdleSK CANVAS=96 hero.sh <slug> <id> creeps: IdleSK_NS/WalkSK_NS/DeathSK_NS (ingest with IDLE=IdleSK CANVAS=96 ... creeps). raven, sak, frost (I/W/D/H), velkhar, void (W/D/H), creeps.
PLAN AFTER E/W: (A) weapon N/S into each AttackW/SkillW group (+IdleW N/S for void-raven, velkhar), (B) NS Idle_NS/WalkSK_NS/DashSK_NS/HurtSK_NS for kael, maldrath, morwen, neon-viper, raven, sak, frost-lich, velkhar(no Idle), void-raven(no Idle) + elowen HurtSK_NS; raven AttackSK_NS, (C) creeps IdleSK_NS/WalkSK_NS/DeathSK_NS.
Audit: other heroes keep weapons in idle/walk/hurt; skip phase-3 for them.
ALL E/W WEAPON CLIPS QUEUED. Ingested WEAPON=1 also: neon-viper. Pending ingest: sak, frost-lich, velkhar.
(kael S W queued.) Ingested with WEAPON=1: archangel, oni, kitsune, raven (WEAPON_ATTACK=AttackSK), void-raven, corvus, aurex, cyber-shinobi.
PHASE 3 idea (leftover credits): template Idle/Walk/Dash/Hurt drop weapons too (void-raven west idle has no scythe, thin). Redo with v3 custom "idle/walking while holding the <weapon>" for weapon heroes.
Next E/W: cyber-shinobi, elowen, kael, maldrath, morwen, neon-viper, sak, frost-lich, velkhar.

## NS PASS (emci "add ns"): new groups named Idle_NS (template; creeps IdleSK_NS skeleton), WalkSK_NS, DashSK_NS, AttackSK_NS, SkillSK_NS, HurtSK_NS, DeathSK_NS with directions north+south; hero.sh maps them into the same clip folders. Order: corvus, archangel, oni, aurex, kitsune, cyber-shinobi, elowen, kael, maldrath, morwen, neon-viper, raven, sak, frost-lich, velkhar, void-raven, girl, wizard, knight.
## NS done (re-ingested): corvus, archangel, oni. aurex: all queued. kitsune: all queued. cyber-shinobi: all queued except HurtSK_NS south -> group 18b7fe81-926c-4a10-9977-885079dc1722. Next elowen 535363cd.
## creeps queued: girl all; wizard all; knight Idle east -> group 834e7674-727b-4311-a767-49384f805750 needs West, then WalkSK, DeathSK
## creep chars: village-girl 8da68657-9b0c-408d-b081-ece6da0a2d50, wizard f968dd5f-76ef-49ee-9bcb-d1631e003580, knight 2fbc9bc6-bfe4-4bfb-b40f-2cef6d14dbb8
## creeps: restyle edit job 96ddbec7-0246-4d7d-9a07-86e325cc2c0d (girl, wizard, knight @64) -> then create_character v3 64px, anims Idle(template), WalkSK, DeathSK(falling-back-death) E/W; ingest with ROOT=creeps CANVAS=96 Then velkhar, void-raven, creeps.
## Next: sak 20b16c7b, frost-lich 60fd62b1, velkhar 358cfbd9, void-raven 5e3b9e12, then creeps Next: maldrath, morwen, neon-viper, raven, sak, frost-lich, velkhar, void-raven, then creeps

## Decision (QA on Corvus): template anims drift off-model at 128px; skeleton-v3 (same template) keeps identity.
Idle stays template; Walk/Dash/Attack/Skill/Hurt use mode=skeleton-v3, saved under names WalkSK/DashSK/AttackSK/SkillSK/HurtSK
and ingested as Walk/Dash/Attack/Skill/Hurt. Corvus + Archangel template clips kept in the source zip only (rerolled once).

## TOWERS + BOSSES (2026-10-11, emci: new boss oni from hero look; titan-x rotations only)
Balance before batch 1: 2,946.
Uploads (3 days): cast fronts ghost 92459be4-9829-421c-8983-c3cf98141bab, lux 579e45ba-23d0-4cec-9e8f-82eb75ad82dd, viper e101af27-38a4-4aea-9eca-d6686fe23233, titan-x 46b8d658-f04c-4116-a6f7-9164c61dd0d0; SW oni hero south 784413f1-c661-4a5b-9a89-6705b8652a8b; anchor 21c1bbb2-9c28-4a54-9f75-b3923072635d
Restyle edit jobs (10 gen each, 1 per call >128px): ghost 711340eb-13cc-4d26-a54e-b9c221864891, lux 9fa06993-6688-4558-8cf8-67517fd63ba0, viper df8ff551-1fc2-434e-9a44-679af179129c, titan-x 0cd3dacc-d77c-4842-a321-ef5b83f0cf87, boss oni cef42ec0-41ae-4bf3-b746-549d29fe16cb
Characters (v3 from restyled front, 8 gen): tower ghost 47597b73-27eb-4773-8033-52efaa1aab77, tower lux 6159cb5b-4748-4d9a-b485-fb2ffafb5c8e, boss oni 85d9255b-ad31-4ddf-825c-256aeadf9cf1 (5 gen, 192), boss titan-x 552049dc-1093-49e1-8211-2b293544169d, tower viper 422ec80c-0e0e-4a4a-88a5-4e81844eb212 (7 gen)
Batch 1 ≈ 86 gen (5 edits x10 + chars 8+8+5+8+7). Towers ingested (rotations only, canvas = cast size 240/244/236). titan-x ingested 244.
PixelLab cycle reset mid-session: balance before batch 2 = 5,000 (next reset 2026-11-11).
Boss oni anims (E,W,N,S): IdleSK breathing-idle group 5716a92e-f7bb-4fb2-b426-f1a06dfc41a9; WalkSK walking-8-frames group 0bfc4df3-769d-4419-b8c6-4e54f944a367; RunSK running-8-frames group 9992bbf5-3e0a-4878-97a6-4901358c3684; DeathW custom v3 8f (10f refused at 256 canvas, 8/dir = 32) group 22cdfc0a-3b6f-4667-9346-d4761f9f04bc ("a dramatic death: staggering back, dropping to one knee leaning on the katana as its flame dies out, then collapsing forward onto the ground")

Batch 2 = 68 gen (balance 5,000 → 4,932). Boss oni ingested on a 264 canvas (content fills PixelLab's 256 frames), clip map IdleSK→Idle, WalkSK→Walk, RunSK→Run, DeathW→Death; all 4 facings equal frame counts. No rerolls used.
Ingest tool for this pass lived in the session scratchpad (ingest.js: centre horizontally, shift each clip/dir so first-frame feet = that dir's rotation feet, refuse to crop). hero.sh / normalize.js from the earlier session are gone.
Zips: games/grove/ref/streetwear-source/towers/{ghost,lux,viper}.zip, boss/{oni,titan-x}.zip; fronts in restyled-fronts/{tower-*,boss-*}.png

## BATCH 3 (2026-10-11, emci approved: tower clips E/W + 4 icons + UI without drips/skull + button pad)
Balance before: 4,932.
Tower AttackW custom v3 8f E/W: ghost eb0956c2-6080-4253-a974-df98b5584269 (16), lux c32c5817-f824-493f-a516-8a571eef3df9 (16), viper fb3f0610-49c3-4220-9738-6093033c894c (14)
UI v2: panel 8d6f2575-c85d-4792-af75-81a7a184f303 (15), card 41c4d8ae-d291-4357-b711-2023ec18d6fa (15), health bar bf073805-680c-4c9b-8509-05917d042d30 (25, 688x384 → crop)
Tower SkillW custom v3 8f E/W: ghost 992e0769-055e-4e94-8482-4706a7a969d8 (16), lux aff32539-db1f-4ab9-b5db-5e888ce11410 (16), viper 4ae9a363-ce25-4c52-9b8f-f6e21ec0d64f (14)
ghost AttackW REJECTED (east body flashes blue/off-model, west fires nothing) → reroll AttackW2 (16) "standing in place and pointing one hand forward while the small hovering drones around him fire thin cyan laser bolts forward; his body, hoodie and colours stay exactly the same". Ghost ingest map uses AttackW2→Attack.
Batch 3 total = 191 gen (4,932 → 4,741). All three towers ingested at their cast canvas (no crop needed). Gallery version 5.
Tower IdleSK breathing-idle E/W (≈18 total, rest of the 191): ghost 1af3750e-b558-427f-80a0-a2dee6a0b3fc, lux c23e847e-f37f-4852-a3f5-32c01ec94dfb, viper e6e83aad-8efd-4932-b9fd-278a96f4654c. Ghost Attack east f5 / west f7 bolts touch the frame edge in PixelLab's own 240 output (nothing cropped by us).
UI v2 saved: panel + card as-is, health bar cropped to 591x125; old v1 copies in rejected/v1-ui/. button-pressed padded locally to 150x68 (centred, bottom-aligned). NOTE: both buttons still carry red drips (not in the approved batch).
Icons v2 (leaf, blank price tag, chain, boxing glove; style refs sneaker/cap/spray-can/heart): object f8075fcf-57e8-414e-95f2-d899b521eb89 (10)

## BATCH 4 — FRAME CONSISTENCY (2026-10-11, emci: re-make hero idles + fix worst attack/skill frames)
Audit tools (scratchpad): audit.js (4x4-block A-B-A flicker, palette drift, area jump), debg.js (removes leftover PixelLab work-background grey #7A7C83 blobs >=200px connected to the outside).
Free fix applied: debg on boss/ only → 9 boss-oni frames (Walk W f3/f7, Run W f0/f1/f2/f5, Run N f5, Walk E f5, Idle N f1). NOT on archangel: its wing feathers are the same grey (debg ate wing chunks in dry run).
Finding: all hero Idles were template mode → hair/cape/weapon blink (oni N bald on f0/f2, aurex N cape on f3, raven W cape on f0, velkhar staff). Fix: custom v3 IdleW "standing idle, breathing slowly while holding <weapon>", 4f, keep_first_frame=false, E/W/N/S, 2 gen/dir. velkhar + void-raven already IdleW (kept).
Balance before batch 4: 4,741.
IdleW groups: oni f40769f5-af61-4765-bf67-01a017ac397b, aurex a3dd83fe-b7fa-492f-b0f1-9768ee402224, archangel 4f5d2be6-e40c-4183-8c38-8f9752e92a16, corvus 56ca4fa1-bb5a-464f-86ec-d7da825ae607, kitsune 4ccd144b-c824-41d2-ae27-03d7e03f6490 (north rerolled: IdleW2 783d0848-35ee-44d3-b40b-755131e80b2a, hair went grey), cyber-shinobi 071c01f4-0bfb-4cf6-b8c1-a8a9110159aa, elowen fed105ce-3b90-462b-b3ab-e48767f1aa65
kael b939d6c3-0d1b-4db6-ade1-76f04f5f170b (E/W rerolled IdleW2 71865eaa-7ceb-45c9-8d71-164b4cd5435a; red blade tip is in his own design), elowen W rerolled IdleW2 4648c546-4b06-4d8c-8de1-a409da874448 (head turned to camera), maldrath d00e1606-8da1-47db-890d-15325fc278b5, morwen 3a38af31-cc3c-4486-bcc9-bf17c030dca3 (E/W rerolled IdleW2 3306b522-7025-4573-8c09-a4df29c38100: staff blinked / head turned), neon-viper 2ab7e07e-6286-46f7-8f06-74941f238afa, raven e2937778-afc1-4c5b-9db5-17ef434b85e0
Installed (Idle folder only, rotations untouched; tools/idle.sh stages + sheets): oni, aurex, archangel, corvus, cyber-shinobi, kitsune (N from reroll), elowen (W from reroll), kael (E/W reroll), maldrath, morwen N/S
Also: neon-viper, raven, sak 6f533186-1cc0-4fed-bbe1-2e00cf23cfed (E/W/N, then S appended), frost-lich b913257d-deee-4670-9e8c-102daad5cc58 (E/W rerolled IdleW2 911e2bdb-f5dc-4df8-a7fd-307a03f6d053: dark blob behind head). morwen E/W reroll: W used; E = first-try frames 0,1,0,1 (staff pops in otherwise). ALL 14 installed. Batch 4 total 128 gen (4,741 → 4,613). Gallery version 7.
Attack/Skill triage (most spikes are intended slash/flash FX). Real off-model frames, NOT yet fixed (await emci's ok, ~4 gen each = re-run that facing with the same move text): kitsune Attack N f5 (both katanas vanish), morwen Skill W f5-7 (turns to camera), sak Attack W f5-6 (turns to camera).
Free frame fix: raven Attack south frame_005 (smudged dark) replaced by frame_000 (stance); original kept in rejected/v1-frames/.

## BATCH 5 (2026-10-11, emci: attack fixes + element effects + rarity/icons + aura layers "fix so it looks good")
Balance before: 4,613; after: 4,582 (31).
Attack fixes (custom v3 8f, same move text + "stays facing"): kitsune Attack N AttackFix 74a20683-62c0-41e0-9871-f51460f65bb5; morwen Skill W SkillFix 7f41abd2-514a-4c8f-a978-f420fbcf26df; sak Attack W AttackFix da330864-88a7-4458-a35c-9bc7f533aa68. Originals in rejected/v1-frames/<hero>-<clip>-<dir>/.
VFX (free, vfx_workbench, all saved to emci's PixelLab My effects as "SW <element> <kind>" / "SW aura <style>" / "SW rarity shine"): 29 element effects (plain has no status; root status is a one-shot snare, TexturePacker json) + 4 auras (game packs: behind/front) + shine. Tools: scratchpad fxget.sh (sheet+json), fxpart.sh (--part piece), fxpack.sh (--game-pack behind/front).
Status loops were made around the village-girl creep (character:8da68657…:east) so they hug a 64px body; exported effect-only.
Rarity frame base 0db9eee4-69f3-47fe-bb14-fb104e310c18 (10) → 5 tiers by local palette map (scratchpad gradmap.js). Icons object 4dda15c1-951d-466f-ac1e-146afd70a112 (10), 16 picks all kept (new object ids listed in select result; files fetched from objects/<id>/rotations/unknown.png).
Theme plan: ATO-streetwear-theme-plan.md never existed on disk (only named in a pasted prompt 2026-10-10); a new wiring plan is written to docs/streetwear-wiring-plan.md.

## BATCH 6 — MENU UI KIT (2026-10-11, emci: "change the UI menu, pet, divecore, shop … use the ui sprites")
Balance before 4,582 → after 4,502 (80 generations, no rerolls). All `create_ui_asset`, no Pro mode. Saved to `assets/play/skins/streetwear/ui/kit/`.
| file | id | gens | notes |
|---|---|---|---|
| panel.png (384×288) | 36a3b469-008e-4820-927d-7b8e308dc94b | 15 | taped asphalt panel, 9-slice inset 56 |
| button-grey.png (384×192) | 01998f9f-0c37-48f1-a814-40f839fc1016 | 15 | one greyscale button → primary/secondary/danger + pressed baked at pack time |
| header.png (688×384) | ae0579b1-bd4a-4baa-9e9d-f69cc5b93f00 | 25 | hazard-tape nameplate, inset 48/96 |
| pieces.png (512×512) | 54986e34-7f61-4d26-9eb9-39a11d53850c | 25 | used: back button, yellow chip (→ dark "off" chip baked), toggle. Brown pieces unused (off-style). |
Packed by `packSwUiKit` (play-art-pack.ts) into `sheets/streetwear/ui-kit/atlas.png`; insets + scale in `meta.json` `ui`.

## BATCH 7 — STREET SHELL KIT (2026-10-11, emci approved the redesign plan, ~300 gens budget)
Balance before 4,502 → after 4,314 (188 generations; one reroll: the toast). No Pro mode. Saved to `ui/kit/`, `ui/nav/`, `ui/rooms/`.
| file | id | gens | notes |
|---|---|---|---|
| kit/resbar.png | c44f85eb-84d0-4ed0-9179-08c6c32b020c | 25 | top resource bar plate |
| kit/tabbar.png | 916ccad9-df66-492e-abbd-49a9f2faa341 | 25 | bottom tab bar plate |
| kit/sheet.png | c2aa5f36-b36a-4313-9cbd-a475733a1f47 | 25 | sheet frame; handle cut out at pack time (bg removal punched its face out) |
| kit/toast.png | 80ed1d8b-2c80-438f-8be2-57713615defd | 25 | reroll of 42f9cef6 (had a barcode); middle repainted flat at pack time |
| kit/hud.png | 3051123d-cb49-40d7-9de2-cdb79d2acce0 | 25 | used: pause button, red alert plate; segmented meter unused (meters drawn in code) |
| kit/portrait.png | e6877009-ca7e-4907-8ccb-74d7f8fa6016 | 25 | used: portrait ring only (brown pieces off-style) |
| nav/*.png (10) | review 6e6bebe8-54a7-4217-a1f4-f3b6fdb18d8c → kept 0,2,4,6,8,10,11,12,13,15 | 10 | tab-block/turf/hideout/locker/store, cur-caps/token/shine/prism, settings (32px, style refs = spray-can + heart stickers) |
| rooms/hideout.png | 3e20ea23-3da1-4257-b766-7c173d4e3060 | 1 | pixflux 256×320 brick room diorama (Hideout backdrop) |
| rooms/underground.png | 276f5164-0cc0-4923-9209-d9cd26ecb55b | 1 | subway platform (Underground tile on The Block) |
| rooms/locker.png | 789d6b32-390e-4609-8c29-80e62c339841 | 1 | locker room (packed, not drawn yet) |
All packed into `sheets/streetwear/ui-kit/atlas-0/1.png` by `packSwUiKit`.

## BATCH 8 — HIDEOUT + UNDERGROUND (2026-10-11, emci approved; red-teamed)
Balance before 4,314 → after 4,294 (20 generations; rerolls: platform (had a commuter), sewers (badge-shaped)). No Pro mode.
| file | id | gens | notes |
|---|---|---|---|
| rooms/hideout-full.png (200×400) | b812f4c1-c9e7-4a68-bc38-c0ceb9b3bf8e | 1 | picked over cbb70cec (isometric); fitted to the 197×426 plate at pack time |
| stops/platform.png | ff239fc0-dea9-41d1-8193-886e8e050533 | 1 | reroll of 1f42bef9 |
| stops/tunnels.png | fa550f98-bad4-4c34-bc85-f0834343b3a5 | 1 | |
| stops/sewers.png | cf86521b-221d-4764-b51a-5ab28d528d95 | 1 | reroll of 8ae733a9 |
| stops/ghost.png | 3941d220-d0b4-4b30-aaed-209583965784 | 1 | sign text is garbled (fits a ghost station) |
| stops/core.png | 376258be-76d8-4893-bc8c-a25bc8158b2f | 1 | |
| stops/train.png | 71d5606e-fd0b-480b-9125-8d856870a1f6 | 1 | passing train |
| ambient/*.png (13) | review c76fc01b-3791-4199-a7c5-f6835c7a8198 → kept 0-7, 9-13 | 10 | rat, rat-run, pigeon, pigeon-peck, note, note2, steam, moth, drip, spark, wisp, star, plane |
All packed into the ui-kit atlases (`room-*`, `stop-*`, `amb-*`).

## Clip names (template → saved clip folder)
breathing-idle→Idle, walking-8-frames→Walk, running-8-frames→Dash, cross-punch→Attack, fireball→Skill, taking-punch→Hurt. East + West only.
