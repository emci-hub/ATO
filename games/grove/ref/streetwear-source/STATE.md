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
## creeps queued: girl all; wizard all; knight Idle east -> group 834e7674-727b-4311-a767-49384f805750 needs West, then WalkSK, DeathSK
## creep chars: village-girl 8da68657-9b0c-408d-b081-ece6da0a2d50, wizard f968dd5f-76ef-49ee-9bcb-d1631e003580, knight 2fbc9bc6-bfe4-4bfb-b40f-2cef6d14dbb8
## creeps: restyle edit job 96ddbec7-0246-4d7d-9a07-86e325cc2c0d (girl, wizard, knight @64) -> then create_character v3 64px, anims Idle(template), WalkSK, DeathSK(falling-back-death) E/W; ingest with ROOT=creeps CANVAS=96 Then velkhar, void-raven, creeps.
## Next: sak 20b16c7b, frost-lich 60fd62b1, velkhar 358cfbd9, void-raven 5e3b9e12, then creeps Next: maldrath, morwen, neon-viper, raven, sak, frost-lich, velkhar, void-raven, then creeps

## Decision (QA on Corvus): template anims drift off-model at 128px; skeleton-v3 (same template) keeps identity.
Idle stays template; Walk/Dash/Attack/Skill/Hurt use mode=skeleton-v3, saved under names WalkSK/DashSK/AttackSK/SkillSK/HurtSK
and ingested as Walk/Dash/Attack/Skill/Hurt. Corvus + Archangel template clips kept in the source zip only (rerolled once).

## Clip names (template → saved clip folder)
breathing-idle→Idle, walking-8-frames→Walk, running-8-frames→Dash, cross-punch→Attack, fireball→Skill, taking-punch→Hurt. East + West only.
