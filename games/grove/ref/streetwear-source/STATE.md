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
ALL 16 E/W WEAPON INGESTED (velkhar pending IdleW). (A) progress: archangel A+S NS queued; oni A NS queued; void IdleW north queued.
Next (A): void IdleW south, oni S, kitsune A,S, void A,S, raven S (+AttackSK_NS template), corvus, aurex, cyber, elowen, kael, maldrath, morwen, neon, sak, frost, velkhar (+IdleW NS).
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

## Clip names (template → saved clip folder)
breathing-idle→Idle, walking-8-frames→Walk, running-8-frames→Dash, cross-punch→Attack, fireball→Skill, taking-punch→Hurt. East + West only.
